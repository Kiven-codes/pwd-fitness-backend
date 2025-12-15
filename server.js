const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================
// DATABASE
// ============================================

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'switchyard.proxy.rlwy.net',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'vnwFoleMcNsKJRoxPoZGanGeZEaLqrIq',
  database: process.env.DB_NAME || 'pwd_db',
  port: process.env.DB_PORT || 57064,
  connectionLimit: 10
});

// ============================================
// AUTH
// ============================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  const [users] = await pool.execute(
    'SELECT * FROM user WHERE username = ?',
    [username]
  );

  if (!users.length) return res.status(401).json({ error: 'Invalid credentials' });

  const user = users[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({
    user: {
      id: user.user_id,
      name: user.name,
      role: user.role,
      disability_type: user.disability_type
    }
  });
});

// ============================================
// EXERCISES
// ============================================

app.get('/api/exercises', async (_, res) => {
  const [rows] = await pool.execute('SELECT * FROM exercise');
  res.json(rows);
});

// ============================================
// ASSIGNMENTS
// ============================================

app.get('/api/assignments/user/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM exercise_assignment WHERE user_id = ?',
    [req.params.id]
  );
  res.json(rows);
});

app.get('/api/assignments/all', async (_, res) => {
  const [rows] = await pool.execute('SELECT * FROM exercise_assignment');
  res.json(rows);
});

// ============================================
// PROGRESS
// ============================================

app.post('/api/progress', async (req, res) => {
  const { assignment_id, duration_minutes, calories_burned, progress_score, remarks } = req.body;

  const [result] = await pool.execute(
    `INSERT INTO progress_tracking
     (assignment_id, duration_minutes, calories_burned, progress_score, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [assignment_id, duration_minutes, calories_burned, progress_score, remarks]
  );

  res.status(201).json({ id: result.insertId });
});

app.get('/api/progress/user/:id/weekly', async (req, res) => {
  const [rows] = await pool.execute(
    'CALL sp_get_weekly_progress(?)',
    [req.params.id]
  );
  res.json(rows[0] || []);
});

app.get('/api/progress/user/:id/summary', async (req, res) => {
  const [rows] = await pool.execute(
    'CALL sp_get_progress_summary(?)',
    [req.params.id]
  );
  res.json(rows[0] || {});
});

// ============================================
// HEALTH METRICS
// ============================================

app.get('/api/health-metrics/user/:id', async (req, res) => {
  const limit = Number(req.query.limit) || 5;

  const [rows] = await pool.execute(
    'SELECT * FROM health_metric WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?',
    [req.params.id, limit]
  );

  res.json(rows);
});

app.post('/api/health-metrics/user/:id', async (req, res) => {
  const { metric_type, metric_value, unit } = req.body;

  const [result] = await pool.execute(
    'INSERT INTO health_metric (user_id, metric_type, metric_value, unit) VALUES (?, ?, ?, ?)',
    [req.params.id, metric_type, metric_value, unit]
  );

  res.status(201).json({ id: result.insertId });
});

// ============================================
// EDUCATION
// ============================================

app.get('/api/education', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM educational_content');
  res.json(rows);
});

app.get('/api/education/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM educational_content WHERE content_id = ?',
    [req.params.id]
  );
  res.json(rows[0]);
});

app.post('/api/education/:id/access', async (req, res) => {
  const { user_id } = req.body;

  await pool.execute(
    'INSERT INTO content_access_log (user_id, content_id) VALUES (?, ?)',
    [user_id, req.params.id]
  );

  res.status(201).json({ message: 'Logged' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
