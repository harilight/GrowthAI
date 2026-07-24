const express = require('express');
const cors = require('cors');
const { initDatabase, getPool } = require('./backend/database');

const app = express();
app.use(cors());
app.use(express.json());

// Init DB
initDatabase();

// Helper
const executeQuery = async (query, params = []) => {
    const [results] = await getPool().query(query, params);
    return results;
};

// Goals API
app.get('/api/goals', async (req, res) => {
    try { res.json(await executeQuery('SELECT * FROM goals')); } catch (e) { res.status(500).json({error: e.message}); }
});
app.get('/api/goals/:id', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM goals WHERE id = ?', [req.params.id]);
        res.json(rows[0] || null);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/goals', async (req, res) => {
    const { id, title, category, deadline, status, createdAt, updatedAt, icon, description } = req.body;
    try {
        await executeQuery('REPLACE INTO goals (id, title, category, deadline, status, createdAt, updatedAt, icon, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, title, category, deadline, status, createdAt, updatedAt, icon, description]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/goals/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM goals WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Tasks API
app.get('/api/tasks', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM tasks');
        rows.forEach(r => r.completedDates = r.completedDates ? JSON.parse(r.completedDates) : []);
        res.json(rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/tasks', async (req, res) => {
    const { id, title, goalId, priority, dueDate, recurrence, duration, completedDates, createdAt, updatedAt } = req.body;
    try {
        await executeQuery('REPLACE INTO tasks (id, title, goalId, priority, dueDate, recurrence, duration, completedDates, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, title, goalId, priority, dueDate, recurrence, duration, JSON.stringify(completedDates || []), createdAt, updatedAt]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Journal API
app.get('/api/journal', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM journal');
        rows.forEach(r => r.tags = r.tags ? JSON.parse(r.tags) : []);
        res.json(rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/journal', async (req, res) => {
    const { id, date, content, mood, tags } = req.body;
    try {
        await executeQuery('REPLACE INTO journal (id, date, content, mood, tags) VALUES (?, ?, ?, ?, ?)',
            [id, date, content, mood, JSON.stringify(tags || [])]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/journal/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM journal WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Sessions API
app.get('/api/sessions', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM sessions');
        rows.forEach(r => r.taskIds = r.taskIds ? JSON.parse(r.taskIds) : []);
        res.json(rows);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/sessions', async (req, res) => {
    const { id, duration, taskIds, mood, notes, timestamp } = req.body;
    try {
        await executeQuery('REPLACE INTO sessions (id, duration, taskIds, mood, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [id, duration, JSON.stringify(taskIds || []), mood, notes, timestamp]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Rewards API
app.get('/api/rewards', async (req, res) => {
    try { res.json(await executeQuery('SELECT * FROM rewards')); } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/rewards', async (req, res) => {
    const { id, title, cost, icon, description, createdAt } = req.body;
    try {
        await executeQuery('REPLACE INTO rewards (id, title, cost, icon, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [id, title, cost, icon, description, createdAt]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/rewards/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM rewards WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Redemptions API
app.get('/api/redemptions', async (req, res) => {
    try { res.json(await executeQuery('SELECT * FROM redemptions')); } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/redemptions', async (req, res) => {
    const { id, rewardId, title, cost, icon, timestamp } = req.body;
    try {
        await executeQuery('REPLACE INTO redemptions (id, rewardId, title, cost, icon, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [id, rewardId, title, cost, icon, timestamp]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// Settings API
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM settings');
        res.json(rows.map(r => ({key: r.key, value: r.value ? JSON.parse(r.value) : null})));
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    try {
        await executeQuery('REPLACE INTO settings (`key`, `value`) VALUES (?, ?)',
            [key, JSON.stringify(value)]);
        res.json(req.body);
    } catch (e) { res.status(500).json({error: e.message}); }
});
app.delete('/api/settings', async (req, res) => {
    try {
        await executeQuery('DELETE FROM settings');
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.listen(3000, () => console.log('Server running on port 3000'));
