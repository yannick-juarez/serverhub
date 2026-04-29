const express = require('express');
const router = express.Router();

const pool = require('../config/db/interface');


router.post('/', async (req, res) => {
    let { host_id, name, type, action, database, table_name, latitude_col, longitude_col, date_col, clauses } = req.body;

    try {
        latitude_col = latitude_col === '' ? null : latitude_col;
        longitude_col = longitude_col === '' ? null : longitude_col;
        date_col = date_col === '' ? null : date_col;

        const query = `INSERT INTO requests(host_id, name, type, action, database, table_name, latitude_col, longitude_col, date_col) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING request_id`;
        const insertReq = await pool.query(query, [host_id, name, type, action, database, table_name, latitude_col, longitude_col, date_col]);
        const requestId = insertReq.rows[0].request_id;

        if (Array.isArray(clauses)) {
            for (const clause of clauses) {
                const { column, condition, value } = clause;
                await pool.query(
                    `INSERT INTO requests_clauses(request_id, column_name, condition, value) VALUES ($1, $2, $3, $4)`,
                    [requestId, column, condition, value]
                );
            }
        }

        res.json({ message: 'Request created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;