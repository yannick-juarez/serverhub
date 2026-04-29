const express = require('express');
const router = express.Router();

const pool = require('../config/db');

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM hosts');
        let hosts = result.rows;
        res.json(hosts);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'Host ID is required' });
    }

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Host ID must be a number' });
    }

    try {
        const result = await pool.query('SELECT * FROM hosts WHERE host_id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Host not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching host:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/:id/auths', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`SELECT * FROM hosts_auths WHERE host_id = $1`, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching host:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    const { type, name, protocol, domain } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO hosts (type, name, protocol, domain) VALUES ($1, $2, $3, $4) RETURNING *',
            [type, name, protocol, domain]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM hosts WHERE host_id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Host not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { type, name, protocol, domain } = req.body;

    try {
        const result = await pool.query(
            'UPDATE hosts SET type = $1, name = $2, protocol = $3, domain = $4 WHERE host_id = $5 RETURNING *',
            [type, name, protocol, domain, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Host not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;