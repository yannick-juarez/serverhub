import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import { getDbConnectionById } from '../connections/connections.service';

type DatabaseTree = {
  name: string;
  tables: Array<{ name: string }>;
};

export type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  column_key?: string | null;
  extra?: string | null;
  enum_values?: string[] | null;
};

function quoteIdent(engine: 'mysql' | 'postgresql', ident: string): string {
  if (engine === 'mysql') {
    return `\`${ident.replace(/`/g, '``')}\``;
  }
  return `"${ident.replace(/"/g, '""')}"`;
}

function normalizeSql(sql: string): string {
  return sql.replace(/;\s*$/g, '').trim();
}

async function withDbConnection<T>(
  dbId: string,
  handler: (ctx: {
    engine: 'mysql' | 'postgresql';
    mysqlConn?: mysql.Connection;
    pgPool?: PgPool;
    defaultDatabase: string;
  }) => Promise<T>,
  databaseOverride?: string,
): Promise<T> {
  const conn = await getDbConnectionById(dbId);
  if (!conn) throw new Error('Database source not found');

  const targetDb = databaseOverride || conn.default_database;

  if (conn.engine === 'mysql') {
    const mysqlConn = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password: conn.password,
      database: targetDb || undefined,
      multipleStatements: false,
    });

    try {
      return await handler({ engine: 'mysql', mysqlConn, defaultDatabase: targetDb });
    } finally {
      await mysqlConn.end();
    }
  }

  const pgPool = new PgPool({
    host: conn.host,
    port: conn.port,
    user: conn.username,
    password: conn.password,
    database: targetDb || 'postgres',
    max: 4,
    idleTimeoutMillis: 10_000,
  });

  try {
    return await handler({ engine: 'postgresql', pgPool, defaultDatabase: targetDb || 'postgres' });
  } finally {
    await pgPool.end();
  }
}

async function listTablesForDatabase(
  dbId: string,
  engine: 'mysql' | 'postgresql',
  database: string,
): Promise<Array<{ name: string }>> {
  if (engine === 'mysql') {
    return withDbConnection(
      dbId,
      async ({ mysqlConn }) => {
        const [rows] = await mysqlConn!.query<mysql.RowDataPacket[]>('SHOW TABLES');
        return rows
          .map((r) => Object.values(r)[0] as string)
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({ name }));
      },
      database,
    );
  }

  return withDbConnection(
    dbId,
    async ({ pgPool }) => {
      const result = await pgPool!.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      );
      return result.rows.map((r) => ({ name: r.tablename }));
    },
    database,
  );
}

export async function getSourceExplorer(dbId: string): Promise<{ databases: DatabaseTree[] }> {
  const conn = await getDbConnectionById(dbId);
  if (!conn) throw new Error('Database source not found');

  const databaseNames = await withDbConnection(dbId, async ({ engine, mysqlConn, pgPool }) => {
    if (engine === 'mysql') {
      const [rows] = await mysqlConn!.query<mysql.RowDataPacket[]>('SHOW DATABASES');
      return rows.map((r) => r['Database'] as string);
    }

    const result = await pgPool!.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
    );
    return result.rows.map((r) => r.datname);
  });

  const databases: DatabaseTree[] = [];
  for (const name of databaseNames) {
    const tables = await listTablesForDatabase(dbId, conn.engine, name).catch(() => []);
    databases.push({ name, tables });
  }

  return { databases };
}

export async function fetchTablePreview(params: {
  dbId: string;
  database: string;
  table: string;
  limit: number;
}): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
  return withDbConnection(
    params.dbId,
    async ({ engine, mysqlConn, pgPool }) => {
      const safeLimit = Math.max(1, Math.min(params.limit || 200, 5000));
      const tableRef = quoteIdent(engine, params.table);
      const sql = `SELECT * FROM ${tableRef} LIMIT ${safeLimit}`;

      if (engine === 'mysql') {
        const [rows, fields] = await mysqlConn!.query<mysql.RowDataPacket[]>(sql);
        const columns = (fields as mysql.FieldPacket[]).map((f) => f.name);
        return { columns, rows: rows as Record<string, unknown>[], rowCount: rows.length };
      }

      const result = await pgPool!.query(sql);
      const columns = result.fields.map((f) => f.name);
      return { columns, rows: result.rows, rowCount: result.rows.length };
    },
    params.database,
  );
}

export async function fetchTableStructure(params: {
  dbId: string;
  database: string;
  table: string;
}): Promise<{ columns: ColumnInfo[] }> {
  return withDbConnection(
    params.dbId,
    async ({ engine, mysqlConn, pgPool }) => {
      if (engine === 'mysql') {
        const [rows] = await mysqlConn!.query<mysql.RowDataPacket[]>(
          `
            SELECT
              COLUMN_NAME AS column_name,
              DATA_TYPE AS data_type,
              IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default,
              CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
              NUMERIC_PRECISION AS numeric_precision,
              NUMERIC_SCALE AS numeric_scale,
              COLUMN_KEY AS column_key,
              EXTRA AS extra,
              COLUMN_TYPE AS column_type
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = ?
            ORDER BY ordinal_position
          `,
          [params.table],
        );

        const columns: ColumnInfo[] = rows.map((r) => {
          const columnType = String(r.column_type ?? '');
          const enumValues = columnType.startsWith('enum(')
            ? columnType
                .slice(5, -1)
                .split(',')
                .map((v) => v.trim().replace(/^'/, '').replace(/'$/, ''))
            : null;

          return {
            column_name: String(r.column_name),
            data_type: String(r.data_type),
            is_nullable: String(r.is_nullable),
            column_default: r.column_default === null ? null : String(r.column_default),
            character_maximum_length:
              r.character_maximum_length === null ? null : Number(r.character_maximum_length),
            numeric_precision: r.numeric_precision === null ? null : Number(r.numeric_precision),
            numeric_scale: r.numeric_scale === null ? null : Number(r.numeric_scale),
            column_key: r.column_key ? String(r.column_key) : null,
            extra: r.extra ? String(r.extra) : null,
            enum_values: enumValues,
          };
        });

        return { columns };
      }

      const columnsResult = await pgPool!.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        character_maximum_length: number | null;
        numeric_precision: number | null;
        numeric_scale: number | null;
      }>(
        `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `,
        [params.table],
      );

      const pkResult = await pgPool!.query<{ column_name: string }>(
        `
          SELECT a.attname AS column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass
            AND i.indisprimary
        `,
        [`public.${params.table}`],
      ).catch(() => ({ rows: [] } as { rows: Array<{ column_name: string }> }));

      const pkSet = new Set(pkResult.rows.map((r) => r.column_name));

      const columns: ColumnInfo[] = columnsResult.rows.map((r) => ({
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable,
        column_default: r.column_default,
        character_maximum_length: r.character_maximum_length,
        numeric_precision: r.numeric_precision,
        numeric_scale: r.numeric_scale,
        column_key: pkSet.has(r.column_name) ? 'PRI' : null,
        extra: null,
        enum_values: null,
      }));

      return { columns };
    },
    params.database,
  );
}

export async function runSourceSql(params: {
  dbId: string;
  database?: string;
  sql: string;
}): Promise<{
  command: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}> {
  const statement = normalizeSql(params.sql);
  if (!statement) throw new Error('SQL is empty');

  const start = Date.now();

  return withDbConnection(
    params.dbId,
    async ({ engine, mysqlConn, pgPool }) => {
      if (engine === 'mysql') {
        const [rows, fields] = await mysqlConn!.query(statement);
        const durationMs = Date.now() - start;

        if (Array.isArray(rows)) {
          const columns = (fields as mysql.FieldPacket[]).map((f) => f.name);
          return {
            command: statement.split(/\s+/)[0].toUpperCase(),
            columns,
            rows: rows as Record<string, unknown>[],
            rowCount: rows.length,
            durationMs,
          };
        }

        const packet = rows as mysql.ResultSetHeader;
        return {
          command: statement.split(/\s+/)[0].toUpperCase(),
          columns: [],
          rows: [],
          rowCount: packet.affectedRows ?? 0,
          durationMs,
        };
      }

      const result = await pgPool!.query(statement);
      const durationMs = Date.now() - start;
      return {
        command: result.command,
        columns: result.fields.map((f) => f.name),
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        durationMs,
      };
    },
    params.database,
  );
}

export async function insertTableRow(params: {
  dbId: string;
  database: string;
  table: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const entries = Object.entries(params.data);
  if (entries.length === 0) throw new Error('No values to insert');

  await withDbConnection(
    params.dbId,
    async ({ engine, mysqlConn, pgPool }) => {
      const columns = entries.map(([k]) => quoteIdent(engine, k));
      const values = entries.map(([, v]) => v);

      if (engine === 'mysql') {
        const placeholders = entries.map(() => '?').join(', ');
        const sql = `INSERT INTO ${quoteIdent(engine, params.table)} (${columns.join(', ')}) VALUES (${placeholders})`;
        await mysqlConn!.query(sql, values);
        return;
      }

      const placeholders = entries.map((_, idx) => `$${idx + 1}`).join(', ');
      const sql = `INSERT INTO ${quoteIdent(engine, params.table)} (${columns.join(', ')}) VALUES (${placeholders})`;
      await pgPool!.query(sql, values);
    },
    params.database,
  );
}
