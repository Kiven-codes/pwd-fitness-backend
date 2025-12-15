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
  connectionLimit: 10,
});

// Test DB connection
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected');
    conn.release();
  })
  .catch(err => console.error('❌ MySQL connection failed:', err.message));

// ============================================
// AUTH
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await pool.execute('SELECT * FROM user WHERE username = ?', [username]);
    if (!users.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      user: {
        id: user.user_id,
        name: user.name,
        role: user.role,
        disability_type: user.disability_type,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// USERS
// ============================================

app.get('/api/users/all', async (_, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT user_id, name, username, role, disability_type FROM user ORDER BY name'
    );
    console.log('Users fetched:', rows.length);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================
// EXERCISES
// ============================================

app.get('/api/exercises', async (_, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exercise_id, exercise_name, description FROM exercise ORDER BY exercise_name'
    );
    console.log('Exercises fetched:', rows.length);
    if (!rows.length) console.warn('⚠️ No exercises found in database.');
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch exercises:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/exercises/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exercise_id, exercise_name, description FROM exercise WHERE exercise_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Exercise not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// EDUCATION
// ============================================

app.get('/api/education', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT content_id, title, category, url FROM educational_content';
    const params = [];
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    const [rows] = await pool.execute(query, params);
    console.log('Education fetched:', rows.length);
    if (!rows.length) console.warn('⚠️ No educational content found in database.');
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch educational content:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/education/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT content_id, title, category, url FROM educational_content WHERE content_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Content not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/education/:id/access', async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.execute(
      'INSERT INTO content_access_log (user_id, content_id) VALUES (?, ?)',
      [user_id, req.params.id]
    );
    res.status(201).json({ message: 'Access logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
