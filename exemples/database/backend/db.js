const express = require('express');
const router = express.Router();
const pool = require('../config/db/polarstar');
const { Client: PgClient } = require('pg');
const PgClientInternal = require('pg/lib/client');
const mysql = require('mysql2/promise');
const { Client: SshClient } = require('ssh2');
const fs = require('fs');
const net = require('net');

if (!PgClientInternal.prototype.__polarstarCopyDataGuardPatched) {
	const originalHandleCopyData = PgClientInternal.prototype._handleCopyData;

	PgClientInternal.prototype._handleCopyData = function (msg) {
		if (!this.activeQuery) {
			const error = new Error('Received unexpected copyData message from backend.');
			this._handleErrorEvent(error);
			return;
		}

		return originalHandleCopyData.call(this, msg);
	};

	PgClientInternal.prototype.__polarstarCopyDataGuardPatched = true;
}

const toNumberOrNull = (value) => {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const toStringOrNull = (value) => {
	if (value === null || value === undefined) {
		return null;
	}

	const normalized = String(value).trim();
	return normalized.length > 0 ? normalized : null;
};

const getConnectionById = async (sourceId) => {
	try {
		const query = 'SELECT * FROM connections.db WHERE db_id = $1 LIMIT 1';
		const result = await pool.query(query, [sourceId]);
		const row = result.rows[0] || null;
		if (row) {
			// Normalize engine to lowercase for consistent comparison
			row.engine = (row.engine || 'postgres').toLowerCase();
		}
		return row;
	} catch (error) {
		console.error('Error fetching connection from internal pool:', {
			code: error.code,
			message: error.sqlMessage || error.message,
			sourceId
		});
		throw Object.assign(new Error('Unable to retrieve database connection information'), {
			status: 500,
		});
	}
};

const getSshConnectionById = async (sshId) => {
	try {
		const query = 'SELECT * FROM connections.ssh WHERE ssh_id = $1 LIMIT 1';
		const result = await pool.query(query, [sshId]);
		return result.rows[0] || null;
	} catch (error) {
		console.error('Error fetching SSH connection from internal pool:', {
			code: error.code,
			message: error.sqlMessage || error.message,
			sshId
		});
		throw Object.assign(new Error('Unable to retrieve SSH connection information'), {
			status: 500,
		});
	}
};

const createSourceClientConfig = (row, overrides = {}) => {
	return {
		host: row.host || 'localhost',
		port: toNumberOrNull(row.port) || 5432,
		user: row.username || row.user || row.db_user,
		password: row.encrypted_password || row.password || row.pass || row.db_password,
		database: row.database_name || row.database || row.dbname || row.db_name || row.name,
		ssl: row.ssl === true || row.ssl === 'true' ? { rejectUnauthorized: false } : undefined,
		connectionTimeoutMillis: 10000,
		...overrides,
	};
};

const connectSourcePgClient = async (row, overrides = {}) => {
	const pgClient = new PgClient(createSourceClientConfig(row, overrides));
	await pgClient.connect();
	return pgClient;
};

const createSourceMysqlConfig = (row, overrides = {}) => {
	return {
		host: row.host || 'localhost',
		port: toNumberOrNull(row.port) || 3306,
		user: row.username || row.user || row.db_user,
		password: row.encrypted_password || row.password || row.pass || row.db_password,
		database: row.database_name || row.database || row.dbname || row.db_name || row.name,
		ssl: row.ssl === true || row.ssl === 'true' ? { rejectUnauthorized: false } : undefined,
		connectTimeout: 10000,
		...overrides,
	};
};

const connectSourceMysqlClient = async (row, overrides = {}) => {
	const mysqlConnection = await mysql.createConnection(createSourceMysqlConfig(row, overrides));
	return mysqlConnection;
};

const readPrivateKey = (row) => {
	const privateKey = row.private_key || row.privateKey || row.key;
	if (privateKey) {
		return privateKey;
	}

	const privateKeyPath = row.private_key_path || row.privateKeyPath;
	if (!privateKeyPath) {
		return undefined;
	}

	try {
		return fs.readFileSync(privateKeyPath, 'utf8');
	} catch (error) {
		throw new Error(`Unable to read SSH private key file: ${privateKeyPath}`);
	}
};

const connectSshClient = (config) =>
	new Promise((resolve, reject) => {
		const sshClient = new SshClient();

		const onReady = () => {
			cleanup();
			resolve(sshClient);
		};

		const onError = (error) => {
			cleanup();
			sshClient.end();
			reject(error);
		};

		const cleanup = () => {
			sshClient.off('ready', onReady);
			sshClient.off('error', onError);
		};

		sshClient.on('ready', onReady);
		sshClient.on('error', onError);
		sshClient.connect(config);
	});

const forwardSshStream = (sshClient, destinationHost, destinationPort) =>
	new Promise((resolve, reject) => {
		sshClient.forwardOut('127.0.0.1', 0, destinationHost, destinationPort, (error, stream) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(stream);
		});
	});

const createLocalSshTunnel = async (sshClient, destinationHost, destinationPort) => {
	const server = net.createServer((socket) => {
		forwardSshStream(sshClient, destinationHost, destinationPort)
			.then((upstream) => {
				socket.pipe(upstream).pipe(socket);

				const destroyBoth = () => {
					socket.destroy();
					upstream.destroy();
				};

				socket.on('error', destroyBoth);
				upstream.on('error', destroyBoth);
				socket.on('close', () => upstream.end());
				upstream.on('close', () => socket.end());
			})
			.catch(() => {
				socket.destroy();
			});
	});

	const localPort = await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('Unable to allocate local SSH tunnel port'));
				return;
			}

			resolve(address.port);
		});
	});

	return {
		localPort,
		close: () =>
			new Promise((resolve) => {
				server.close(() => resolve());
			}),
	};
};

const createSourceClient = async (row) => {
	const engine = (row.engine || 'postgres').toLowerCase();
	const isPostgres = engine === 'postgres' || engine === 'postgresql';
	const isMysql = engine === 'mysql' || engine === 'mariadb';

	if (!isPostgres && !isMysql) {
		throw Object.assign(new Error(`Unsupported database engine: ${engine}`), {
			status: 400,
		});
	}

	const sshId = toStringOrNull(row.ssh_id ?? row.sshId);
	
	// Direct connection (no SSH tunnel)
	if (!sshId) {
		if (isPostgres) {
			const pgClient = await connectSourcePgClient(row);
			return {
				query: async (text, params) => pgClient.query(text, params),
				end: async () => {
					await pgClient.end().catch(() => undefined);
				},
			};
		} else {
			// MySQL/MariaDB
			const mysqlClient = await connectSourceMysqlClient(row);
			return {
				query: async (text, params) => {
					// Convert PostgreSQL $1, $2, etc. placeholders to MySQL ? placeholders
					let mysqlQuery = text;
					let mysqlParams = params || [];
					
					if (params && params.length > 0) {
						// Replace $1, $2, ... with ? in order
						for (let i = params.length; i >= 1; i--) {
							mysqlQuery = mysqlQuery.replace(new RegExp('\\$' + i, 'g'), '?');
						}
					}
					
					const [rows, fields] = await mysqlClient.execute(mysqlQuery, mysqlParams);
					// Adapt mysql2 result to pg-like format
					return {
						rows: Array.isArray(rows) ? rows : [],
						fields: fields ? fields.map(f => ({ name: f.name })) : [],
						rowCount: Array.isArray(rows) ? rows.length : 0,
						command: text.trim().split(/\s+/)[0].toUpperCase(),
					};
				},
				end: async () => {
					await mysqlClient.end().catch(() => undefined);
				},
			};
		}
	}

	// SSH-tunneled connection
	const sshRow = await getSshConnectionById(sshId);
	if (!sshRow) {
		throw Object.assign(new Error('SSH connection linked to database source was not found'), {
			status: 404,
		});
	}

	const sshConfig = {
		host: sshRow.host || 'localhost',
		port: toNumberOrNull(sshRow.port) || 22,
		username: sshRow.username || sshRow.user,
		password: sshRow.encrypted_password || sshRow.password || sshRow.pass,
		privateKey: readPrivateKey(sshRow),
		passphrase: sshRow.passphrase,
		readyTimeout: 10000,
	};

	if (!sshConfig.username) {
		throw new Error('SSH connection is missing username');
	}

	if (!sshConfig.password && !sshConfig.privateKey) {
		throw new Error('SSH connection is missing authentication credentials');
	}

	const sshClient = await connectSshClient(sshConfig);

	try {
		const dbHost = row.host || 'localhost';
		const defaultPort = isPostgres ? 5432 : 3306;
		const dbPort = toNumberOrNull(row.port) || defaultPort;
		
		const tunnel = await createLocalSshTunnel(
			sshClient,
			dbHost,
			dbPort
		);

		if (isPostgres) {
			const pgClient = await connectSourcePgClient(row, {
				host: '127.0.0.1',
				port: tunnel.localPort,
			});

			return {
				query: async (text, params) => pgClient.query(text, params),
				end: async () => {
					await pgClient.end().catch(() => undefined);
					await tunnel.close().catch(() => undefined);
					sshClient.end();
				},
			};
		} else {
			// MySQL/MariaDB via SSH tunnel
			const mysqlClient = await connectSourceMysqlClient(row, {
				host: '127.0.0.1',
				port: tunnel.localPort,
			});

			return {
				query: async (text, params) => {
					// Convert PostgreSQL $1, $2, etc. placeholders to MySQL ? placeholders
					let mysqlQuery = text;
					let mysqlParams = params || [];
					
					if (params && params.length > 0) {
						// Replace $1, $2, ... with ? in order
						for (let i = params.length; i >= 1; i--) {
							mysqlQuery = mysqlQuery.replace(new RegExp('\\$' + i, 'g'), '?');
						}
					}
					
					const [rows, fields] = await mysqlClient.execute(mysqlQuery, mysqlParams);
					// Adapt mysql2 result to pg-like format
					return {
						rows: Array.isArray(rows) ? rows : [],
						fields: fields ? fields.map(f => ({ name: f.name })) : [],
						rowCount: Array.isArray(rows) ? rows.length : 0,
						command: text.trim().split(/\s+/)[0].toUpperCase(),
					};
				},
				end: async () => {
					await mysqlClient.end().catch(() => undefined);
					await tunnel.close().catch(() => undefined);
					sshClient.end();
				},
			};
		}
	} catch (error) {
		sshClient.end();
		throw error;
	}
};

const quoteIdentifier = (value, engine = 'postgres') => {
	if (!value) {
		return engine === 'postgres' || engine === 'postgresql' ? '""' : '``';
	}

	const str = String(value);
	if (engine === 'postgres' || engine === 'postgresql') {
		return `"${str.replace(/"/g, '""')}"`;
	} else {
		// MySQL/MariaDB use backticks
		return `\`${str.replace(/`/g, '``')}\``;
	}
};

const formatDatabaseError = (error, engine = 'postgres') => {
	// Extract clean error message without stack trace
	const isPostgres = engine === 'postgres' || engine === 'postgresql';
	const isMysql = engine === 'mysql' || engine === 'mariadb';

	// PostgreSQL error codes
	if (isPostgres && error.code) {
		switch (error.code) {
			case '42P01': // relation does not exist
				return { status: 404, message: `Table or view does not exist: ${error.message.split(':')[1]?.trim() || 'unknown'}` };
			case '42501': // insufficient privilege
				return { status: 403, message: 'Insufficient privileges to access this resource' };
			case '42601': // syntax error
				return { status: 400, message: `SQL syntax error: ${error.message.split('\n')[0]}` };
			case '28P01': // authentication failed
				return { status: 401, message: 'Database authentication failed' };
			case '3D000': // invalid catalog name (database doesn't exist)
				return { status: 404, message: 'Database does not exist' };
			case '42P07': // duplicate object
				return { status: 409, message: 'Object already exists' };
			case '23505': // unique violation
				return { status: 409, message: 'Duplicate entry violates unique constraint' };
			case '23503': // foreign key violation
				return { status: 400, message: 'Foreign key constraint violation' };
		}
	}

	// MySQL/MariaDB error codes
	if (isMysql && error.code) {
		switch (error.code) {
			case 'ER_TABLEACCESS_DENIED_ERROR': // table access denied
			case 'ER_COLUMNACCESS_DENIED_ERROR': // column access denied
			case 'ER_SPECIFIC_ACCESS_DENIED_ERROR': // specific access denied
				return { status: 403, message: `Access denied: ${error.sqlMessage || error.message}` };
			case 'ER_NO_SUCH_TABLE': // table doesn't exist
				return { status: 404, message: `Table does not exist: ${error.sqlMessage || error.message}` };
			case 'ER_BAD_DB_ERROR': // database doesn't exist
				return { status: 404, message: 'Database does not exist' };
			case 'ER_ACCESS_DENIED_ERROR': // access denied
				return { status: 401, message: 'Database authentication failed' };
			case 'ER_PARSE_ERROR': // syntax error
				return { status: 400, message: `SQL syntax error: ${error.sqlMessage || error.message}` };
			case 'ER_DUP_ENTRY': // duplicate entry
				return { status: 409, message: 'Duplicate entry violates unique constraint' };
			case 'ER_NO_REFERENCED_ROW': // foreign key violation
			case 'ER_ROW_IS_REFERENCED': // foreign key violation
				return { status: 400, message: 'Foreign key constraint violation' };
		}
	}

	// Connection errors
	if (error.code === 'ECONNREFUSED') {
		return { status: 503, message: 'Unable to connect to database server' };
	}
	if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
		return { status: 504, message: 'Database connection timeout' };
	}

	// Generic database error
	const message = error.sqlMessage || error.message || 'Unknown database error';
	return { status: 500, message: `Database error: ${message.split('\n')[0]}` };
};

const withSourceClient = async (sourceId, handler) => {
	let source;
	try {
		source = await getConnectionById(sourceId);
	} catch (error) {
		console.error('Failed to retrieve database source:', error.message);
		return { status: 500, payload: { error: 'Unable to access database source configuration' } };
	}

	if (!source) {
		console.warn(`Database source with id ${sourceId} not found`);
		return { status: 404, payload: { error: 'Database source not found' } };
	}

	let sourceClient;

	try {
		sourceClient = await createSourceClient(source);
		const payload = await handler(sourceClient, source);
		return { status: 200, payload };
	} catch (error) {
		const errorInfo = {
			code: error.code,
			message: error.sqlMessage || error.message,
			engine: source.engine || 'postgres',
		};
		console.error('Database query failed:', errorInfo);

		if (error.status) {
			return { status: error.status, payload: { error: error.message } };
		}

		const formatted = formatDatabaseError(error, source.engine || 'postgres');
		console.error('Formatted database error response:', formatted);
		return { status: formatted.status, payload: { error: formatted.message } };
	} finally {
		if (sourceClient) {
			await sourceClient.end().catch(() => undefined);
		}
	}
};

router.get('/sources/:sourceId/schemas', async (req, res) => {
	const sourceId = req.params.sourceId;

	if (!sourceId) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const isPostgres = engine === 'postgres' || engine === 'postgresql';
		const defaultPort = isPostgres ? 5432 : 3306;

		let schemaResult;
		if (isPostgres) {
			schemaResult = await sourcePool.query(
				`SELECT schema_name
				 FROM information_schema.schemata
				 WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
				 ORDER BY schema_name ASC`
			);
		} else {
			// MySQL/MariaDB: list databases
			schemaResult = await sourcePool.query(
				`SELECT SCHEMA_NAME as schema_name
				 FROM information_schema.SCHEMATA
				 WHERE SCHEMA_NAME NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
				 ORDER BY SCHEMA_NAME ASC`
			);
		}

		return {
			source: {
				id: source.id,
				name: source.name || 'Unnamed database connection',
				host: source.host || '',
				port: toNumberOrNull(source.port) || defaultPort,
				username: source.username || '',
				sshId: source.ssh_id ?? source.sshId,
				engine: source.engine || 'postgres',
			},
			schemas: schemaResult.rows.map((row) => ({ name: row.schema_name })),
		};
	});

	res.status(result.status).json(result.payload);
});

router.get('/sources/:sourceId/tables', async (req, res) => {
	const sourceId = req.params.sourceId;
	const schema = String(req.query.schema || '').trim();

	if (sourceId === null) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	if (!schema) {
		res.status(400).json({ error: 'Missing schema query parameter' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const isPostgres = engine === 'postgres' || engine === 'postgresql';

		let tablesResult;
		if (isPostgres) {
			tablesResult = await sourcePool.query(
				`SELECT table_name
				 FROM information_schema.tables
				 WHERE table_schema = $1
				   AND table_type = 'BASE TABLE'
				 ORDER BY table_name ASC`,
				[schema]
			);
		} else {
			// MySQL/MariaDB
			tablesResult = await sourcePool.query(
				`SELECT TABLE_NAME as table_name
				 FROM information_schema.TABLES
				 WHERE TABLE_SCHEMA = $1
				   AND TABLE_TYPE = 'BASE TABLE'
				 ORDER BY TABLE_NAME ASC`,
				[schema]
			);
		}

		return {
			schema,
			tables: tablesResult.rows.map((row) => ({ name: row.table_name })),
		};
	});

	res.status(result.status).json(result.payload);
});

router.get('/sources/:sourceId/explorer', async (req, res) => {
	const sourceId = req.params.sourceId;
	if (!sourceId) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const isPostgres = engine === 'postgres' || engine === 'postgresql';
		const defaultPort = isPostgres ? 5432 : 3306;

		let schemaResult;
		if (isPostgres) {
			schemaResult = await sourcePool.query(
				`SELECT schema_name
				 FROM information_schema.schemata
				 WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
				 ORDER BY schema_name ASC`
			);
		} else {
			// MySQL/MariaDB
			schemaResult = await sourcePool.query(
				`SELECT SCHEMA_NAME as schema_name
				 FROM information_schema.SCHEMATA
				 WHERE SCHEMA_NAME NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
				 ORDER BY SCHEMA_NAME ASC`
			);
		}

		const schemas = schemaResult.rows.map((row) => row.schema_name);

		const schemaGroups = await Promise.all(
			schemas.map(async (schemaName) => {
				let tableResult;
				if (isPostgres) {
					tableResult = await sourcePool.query(
						`SELECT table_name
						 FROM information_schema.tables
						 WHERE table_schema = $1
						   AND table_type = 'BASE TABLE'
						 ORDER BY table_name ASC`,
						[schemaName]
					);
				} else {
					// MySQL/MariaDB
					tableResult = await sourcePool.query(
						`SELECT TABLE_NAME as table_name
						 FROM information_schema.TABLES
						 WHERE TABLE_SCHEMA = $1
						   AND TABLE_TYPE = 'BASE TABLE'
						 ORDER BY TABLE_NAME ASC`,
						[schemaName]
					);
				}

				return {
					name: schemaName,
					tables: tableResult.rows.map((row) => ({
						name: row.table_name,
					})),
				};
			})
		);

		return {
			source: {
				id: source.id,
				name: source.name || 'Unnamed database connection',
				host: source.host || '',
				port: toNumberOrNull(source.port) || defaultPort,
				username: source.username || '',
				sshId: source.ssh_id ?? source.sshId,
				engine: source.engine || 'postgres',
			},
			schemas: schemaGroups,
		};
	});

	res.status(result.status).json(result.payload);
});

router.get('/sources/:sourceId/rows', async (req, res) => {
	const sourceId = req.params.sourceId;
	const schema = String(req.query.schema || '').trim();
	const table = String(req.query.table || '').trim();
	const requestedLimit = toNumberOrNull(req.query.limit);
	const limit = requestedLimit && requestedLimit > 0 ? Math.min(requestedLimit, 500) : 200;

	if (!sourceId) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	if (!schema || !table) {
		res.status(400).json({ error: 'Missing schema or table query parameter' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const sql = `SELECT * FROM ${quoteIdentifier(schema, engine)}.${quoteIdentifier(table, engine)} LIMIT $1`;
		const previewResult = await sourcePool.query(sql, [limit]);

		return {
			schema,
			table,
			columns: previewResult.fields.map((field) => field.name),
			rows: previewResult.rows,
			rowCount: previewResult.rowCount,
			limit,
		};
	});

	res.status(result.status).json(result.payload);
});

router.get('/sources/:sourceId/structure', async (req, res) => {
	const sourceId = req.params.sourceId;
	const schema = String(req.query.schema || '').trim();
	const table = String(req.query.table || '').trim();

	if (!sourceId) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	if (!schema || !table) {
		res.status(400).json({ error: 'Missing schema or table query parameter' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const isPostgres = engine === 'postgres' || engine === 'postgresql';

		let columnsResult;
		if (isPostgres) {
			// PostgreSQL: Get columns with detailed info
			columnsResult = await sourcePool.query(
				`SELECT 
					c.column_name,
					c.data_type,
					c.column_default,
					c.is_nullable,
					c.character_maximum_length,
					c.numeric_precision,
					c.numeric_scale,
					c.udt_name,
					CASE
						WHEN EXISTS (
							SELECT 1
							FROM information_schema.table_constraints tc
							JOIN information_schema.key_column_usage kcu
							  ON tc.constraint_name = kcu.constraint_name
							 AND tc.table_schema = kcu.table_schema
							 AND tc.table_name = kcu.table_name
							WHERE tc.constraint_type = 'PRIMARY KEY'
							  AND kcu.table_schema = c.table_schema
							  AND kcu.table_name = c.table_name
							  AND kcu.column_name = c.column_name
						) THEN 'PRI'
						WHEN EXISTS (
							SELECT 1
							FROM information_schema.table_constraints tc
							JOIN information_schema.key_column_usage kcu
							  ON tc.constraint_name = kcu.constraint_name
							 AND tc.table_schema = kcu.table_schema
							 AND tc.table_name = kcu.table_name
							WHERE tc.constraint_type = 'UNIQUE'
							  AND kcu.table_schema = c.table_schema
							  AND kcu.table_name = c.table_name
							  AND kcu.column_name = c.column_name
						) THEN 'UNI'
						ELSE NULL
					END AS column_key
				FROM information_schema.columns c
				WHERE c.table_schema = $1 AND c.table_name = $2
				ORDER BY c.ordinal_position ASC`,
				[schema, table]
			);

			// For PostgreSQL enums, fetch the enum values
			const enumColumns = columnsResult.rows.filter(col => col.data_type === 'USER-DEFINED');
			if (enumColumns.length > 0) {
				const enumTypes = [...new Set(enumColumns.map(col => col.udt_name))];
				const enumValuesResult = await sourcePool.query(
					`SELECT 
						t.typname as type_name,
						array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
					FROM pg_type t
					JOIN pg_enum e ON t.oid = e.enumtypid
					WHERE t.typname = ANY($1)
					GROUP BY t.typname`,
					[enumTypes]
				);

				const enumValuesMap = {};
				enumValuesResult.rows.forEach(row => {
					// Ensure enum_values is always an array
					const values = Array.isArray(row.enum_values) ? row.enum_values : [];
					if (values.length > 0) {
						enumValuesMap[row.type_name] = values;
					}
				});

				// Add enum_values to columns
				columnsResult.rows.forEach(col => {
					if (col.data_type === 'USER-DEFINED' && enumValuesMap[col.udt_name]) {
						col.enum_values = enumValuesMap[col.udt_name];
					}
				});
			}
		} else {
			// MySQL/MariaDB: Get columns with detailed info
			columnsResult = await sourcePool.query(
				`SELECT 
					COLUMN_NAME as column_name,
					DATA_TYPE as data_type,
					COLUMN_DEFAULT as column_default,
					IS_NULLABLE as is_nullable,
					CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
					NUMERIC_PRECISION as numeric_precision,
					NUMERIC_SCALE as numeric_scale,
					COLUMN_TYPE as udt_name,
					COLUMN_KEY as column_key,
					EXTRA as extra
				FROM information_schema.COLUMNS
				WHERE TABLE_SCHEMA = $1 AND TABLE_NAME = $2
				ORDER BY ORDINAL_POSITION ASC`,
				[schema, table]
			);

			// For MySQL/MariaDB enums, parse from COLUMN_TYPE
			columnsResult.rows.forEach(col => {
				if (col.data_type === 'enum' && col.udt_name) {
					// Parse enum('val1','val2','val3') format
					const match = col.udt_name.match(/^enum\((.*)\)$/i);
					if (match) {
						const enumString = match[1];
						// Split by comma but respect quoted strings
						const values = [];
						let current = '';
						let inQuote = false;
						let escapeNext = false;

						for (let i = 0; i < enumString.length; i++) {
							const char = enumString[i];
							
							if (escapeNext) {
								current += char;
								escapeNext = false;
							} else if (char === '\\') {
								escapeNext = true;
							} else if (char === "'" && !escapeNext) {
								if (inQuote) {
									values.push(current);
									current = '';
									inQuote = false;
								} else {
									inQuote = true;
								}
							} else if (inQuote) {
								current += char;
							}
						}

						col.enum_values = values.length > 0 ? values : undefined;
					}
				}
			});
		}

		return {
			schema,
			table,
			columns: columnsResult.rows,
		};
	});

	res.status(result.status).json(result.payload);
});

router.post('/sources/:sourceId/insert', async (req, res) => {
	const sourceId = req.params.sourceId;
	const schema = String(req.body?.schema || '').trim();
	const table = String(req.body?.table || '').trim();
	const data = req.body?.data || {};

	if (!sourceId) {
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	if (!schema || !table) {
		res.status(400).json({ error: 'Missing schema or table' });
		return;
	}

	if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
		res.status(400).json({ error: 'Missing or invalid data' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool, source) => {
		const engine = (source.engine || 'postgres').toLowerCase();
		const columns = Object.keys(data);
		const values = Object.values(data);
		
		// Build INSERT query
		const quotedColumns = columns.map(col => quoteIdentifier(col, engine)).join(', ');
		const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
		const sql = `INSERT INTO ${quoteIdentifier(schema, engine)}.${quoteIdentifier(table, engine)} (${quotedColumns}) VALUES (${placeholders})`;
		
		await sourcePool.query(sql, values);

		return {
			success: true,
			message: `Row inserted successfully into ${schema}.${table}`,
		};
	});

	res.status(result.status).json(result.payload);
});

router.post('/sources/:sourceId/query', async (req, res) => {
	const sourceId = req.params.sourceId;
	const sql = String(req.body?.sql || '').trim();

	if (!sourceId) {
		console.error('Query execution failed: Missing source id');
		res.status(400).json({ error: 'Invalid source id' });
		return;
	}

	if (!sql) {
		console.error('Query execution failed: Missing SQL query');
		res.status(400).json({ error: 'Missing SQL query' });
		return;
	}

	if (/\b(copy|start_replication|base_backup)\b/i.test(sql)) {
		console.error('Query execution failed: Attempt to execute unsupported COPY or replication command');
		res.status(400).json({ error: 'COPY and replication commands are not supported in this endpoint' });
		return;
	}

	const result = await withSourceClient(sourceId, async (sourcePool) => {
		const startedAt = Date.now();
		const queryResult = await sourcePool.query(sql);
		const durationMs = Date.now() - startedAt;

		return {
			columns: queryResult.fields.map((field) => field.name),
			rows: queryResult.rows,
			rowCount: queryResult.rowCount,
			command: queryResult.command,
			durationMs,
		};
	});

	res.status(result.status).json(result.payload);
});

const mapRequestFolder = (row) => ({
	request_folder_id: row.request_folder_id,
	db_id: row.db_id,
	parent_request_folder_id: row.parent_request_folder_id ?? null,
	folder_name: row.folder_name,
	folder_description: row.folder_description ?? null,
	sort_order: toNumberOrNull(row.sort_order) ?? 0,
	created_at: row.created_at,
	updated_at: row.updated_at,
});

const mapSqlRequest = (row) => ({
	request_id: row.request_id,
	db_id: row.db_id,
	request_folder_id: row.request_folder_id ?? null,
	request_name: row.request_name,
	request_description: row.request_description ?? null,
	sql_text: row.sql_text,
	is_favorite: row.is_favorite === true,
	sort_order: toNumberOrNull(row.sort_order) ?? 0,
	created_at: row.created_at,
	updated_at: row.updated_at,
});

router.get('/requests', async (req, res) => {
	const dbId = String(req.query.db_id || '').trim();

	if (!dbId) {
		res.status(400).json({ error: 'Missing db_id query parameter' });
		return;
	}

	try {
		const [foldersResult, requestsResult] = await Promise.all([
			pool.query(
				`SELECT request_folder_id, db_id, parent_request_folder_id, folder_name, folder_description, sort_order, created_at, updated_at
				 FROM connections.request_folders
				 WHERE db_id = $1
				 ORDER BY sort_order ASC, folder_name ASC`,
				[dbId]
			),
			pool.query(
				`SELECT request_id, db_id, request_folder_id, request_name, request_description, sql_text, is_favorite, sort_order, created_at, updated_at
				 FROM connections.requests
				 WHERE db_id = $1
				 ORDER BY sort_order ASC, request_name ASC`,
				[dbId]
			),
		]);

		res.json({
			folders: foldersResult.rows.map(mapRequestFolder),
			requests: requestsResult.rows.map(mapSqlRequest),
		});
	} catch (error) {
		console.error('Failed to load SQL requests:', error);
		res.status(500).json({ error: 'Failed to load SQL requests' });
	}
});

router.post('/requests/folders', async (req, res) => {
	const dbId = toStringOrNull(req.body?.db_id);
	const folderName = toStringOrNull(req.body?.folder_name);
	const folderDescription = toStringOrNull(req.body?.folder_description);
	const parentFolderId = toStringOrNull(req.body?.parent_request_folder_id);
	const sortOrder = toNumberOrNull(req.body?.sort_order) ?? 0;

	if (!dbId) {
		res.status(400).json({ error: 'Missing db_id' });
		return;
	}

	if (!folderName) {
		res.status(400).json({ error: 'Folder name is required' });
		return;
	}

	try {
		const result = await pool.query(
			`INSERT INTO connections.request_folders
				(db_id, parent_request_folder_id, folder_name, folder_description, sort_order)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING request_folder_id, db_id, parent_request_folder_id, folder_name, folder_description, sort_order, created_at, updated_at`,
			[dbId, parentFolderId, folderName, folderDescription, sortOrder]
		);

		res.status(201).json(mapRequestFolder(result.rows[0]));
	} catch (error) {
		console.error('Failed to create request folder:', error);
		res.status(500).json({ error: 'Failed to create request folder' });
	}
});

router.delete('/requests/folders/:folderId', async (req, res) => {
	const folderId = String(req.params.folderId || '').trim();

	if (!folderId) {
		res.status(400).json({ error: 'Invalid folder id' });
		return;
	}

	try {
		const result = await pool.query(
			`DELETE FROM connections.request_folders
			 WHERE request_folder_id = $1
			 RETURNING request_folder_id`,
			[folderId]
		);

		if (result.rowCount === 0) {
			res.status(404).json({ error: 'Folder not found' });
			return;
		}

		res.json({ success: true });
	} catch (error) {
		console.error('Failed to delete request folder:', error);
		res.status(500).json({ error: 'Failed to delete request folder' });
	}
});

router.post('/requests', async (req, res) => {
	const dbId = toStringOrNull(req.body?.db_id);
	const requestName = toStringOrNull(req.body?.request_name);
	const requestDescription = toStringOrNull(req.body?.request_description);
	const sqlText = toStringOrNull(req.body?.sql_text);
	const requestFolderId = toStringOrNull(req.body?.request_folder_id);
	const sortOrder = toNumberOrNull(req.body?.sort_order) ?? 0;
	const isFavorite = req.body?.is_favorite === true;

	if (!dbId) {
		res.status(400).json({ error: 'Missing db_id' });
		return;
	}

	if (!requestName) {
		res.status(400).json({ error: 'Request name is required' });
		return;
	}

	if (!sqlText) {
		res.status(400).json({ error: 'SQL text is required' });
		return;
	}

	try {
		const result = await pool.query(
			`INSERT INTO connections.requests
				(db_id, request_folder_id, request_name, request_description, sql_text, is_favorite, sort_order)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING request_id, db_id, request_folder_id, request_name, request_description, sql_text, is_favorite, sort_order, created_at, updated_at`,
			[dbId, requestFolderId, requestName, requestDescription, sqlText, isFavorite, sortOrder]
		);

		res.status(201).json(mapSqlRequest(result.rows[0]));
	} catch (error) {
		console.error('Failed to create SQL request:', error);
		res.status(500).json({ error: 'Failed to create SQL request' });
	}
});

router.put('/requests/:requestId', async (req, res) => {
	const requestId = String(req.params.requestId || '').trim();

	if (!requestId) {
		res.status(400).json({ error: 'Invalid request id' });
		return;
	}

	const fields = [];
	const values = [];
	let index = 1;

	const hasRequestName = Object.prototype.hasOwnProperty.call(req.body || {}, 'request_name');
	if (hasRequestName) {
		const requestName = toStringOrNull(req.body?.request_name);
		if (!requestName) {
			res.status(400).json({ error: 'Request name cannot be empty' });
			return;
		}
		fields.push(`request_name = $${index++}`);
		values.push(requestName);
	}

	if (Object.prototype.hasOwnProperty.call(req.body || {}, 'request_description')) {
		fields.push(`request_description = $${index++}`);
		values.push(toStringOrNull(req.body?.request_description));
	}

	if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sql_text')) {
		const sqlText = toStringOrNull(req.body?.sql_text);
		if (!sqlText) {
			res.status(400).json({ error: 'SQL text cannot be empty' });
			return;
		}
		fields.push(`sql_text = $${index++}`);
		values.push(sqlText);
	}

	if (Object.prototype.hasOwnProperty.call(req.body || {}, 'request_folder_id')) {
		fields.push(`request_folder_id = $${index++}`);
		values.push(toStringOrNull(req.body?.request_folder_id));
	}

	if (Object.prototype.hasOwnProperty.call(req.body || {}, 'is_favorite')) {
		fields.push(`is_favorite = $${index++}`);
		values.push(req.body?.is_favorite === true);
	}

	if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sort_order')) {
		fields.push(`sort_order = $${index++}`);
		values.push(toNumberOrNull(req.body?.sort_order) ?? 0);
	}

	if (fields.length === 0) {
		res.status(400).json({ error: 'No fields provided for update' });
		return;
	}

	fields.push('updated_at = NOW()');
	values.push(requestId);

	try {
		const result = await pool.query(
			`UPDATE connections.requests
			 SET ${fields.join(', ')}
			 WHERE request_id = $${index}
			 RETURNING request_id, db_id, request_folder_id, request_name, request_description, sql_text, is_favorite, sort_order, created_at, updated_at`,
			values
		);

		if (result.rowCount === 0) {
			res.status(404).json({ error: 'Request not found' });
			return;
		}

		res.json(mapSqlRequest(result.rows[0]));
	} catch (error) {
		console.error('Failed to update SQL request:', error);
		res.status(500).json({ error: 'Failed to update SQL request' });
	}
});

router.delete('/requests/:requestId', async (req, res) => {
	const requestId = String(req.params.requestId || '').trim();

	if (!requestId) {
		res.status(400).json({ error: 'Invalid request id' });
		return;
	}

	try {
		const result = await pool.query(
			`DELETE FROM connections.requests
			 WHERE request_id = $1
			 RETURNING request_id`,
			[requestId]
		);

		if (result.rowCount === 0) {
			res.status(404).json({ error: 'Request not found' });
			return;
		}

		res.json({ success: true });
	} catch (error) {
		console.error('Failed to delete SQL request:', error);
		res.status(500).json({ error: 'Failed to delete SQL request' });
	}
});


module.exports = router;