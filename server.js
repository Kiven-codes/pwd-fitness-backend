// ============================================
// UPDATED BACKEND API - server.js
// All table names lowercase, safe for Linux MySQL
// ============================================

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'switchyard.proxy.rlwy.net',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'vnwFoleMcNsKJRoxPoZGanGeZEaLqrIq',
  database: process.env.DB_NAME || 'pwd_db',
  port: 57064,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL Database Connected Successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database Connection Failed:', err.message);
  });

// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
  res.send('✅ Backend is running');
});

// ============================================
// USER AUTHENTICATION ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { name, age, gender, disability_type, contact_info, username, password, role } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await connection.beginTransaction();
    
    const [result] = await connection.execute(
      `INSERT INTO \`user\` 
       (name, age, gender, disability_type, contact_info, username, password, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, age, gender, disability_type, contact_info, username, hashedPassword, role]
    );
    
    const userId = result.insertId;

    if (role === 'PWD' && disability_type) {
      const [disabilities] = await connection.execute(
        'SELECT disability_id FROM disability_type WHERE disability_name = ?',
        [disability_type]
      );
      if (disabilities.length > 0) {
        await connection.execute(
          'UPDATE pwd SET disability_id = ? WHERE user_id = ?',
          [disabilities[0].disability_id, userId]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: 'User registered successfully',
      userId: userId,
      role: role
    });
  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.execute(
      'SELECT user_id, name, username, password, role, disability_type FROM `user` WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      message: 'Login successful',
      user: {
        id: user.user_id,
        name: user.name,
        username: user.username,
        role: user.role,
        disability_type: user.disability_type
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER ROUTES
// ============================================

// Get all users
app.get('/api/users/all', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info, username, role, created_at FROM `user` ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info, username, role FROM `user` WHERE user_id = ?',
      [req.params.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all PWD users
app.get('/api/users/pwds', async (req, res) => {
  try {
    const [pwds] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info FROM `user` WHERE role = "PWD" ORDER BY name'
    );
    res.json(pwds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PWD details (with disability info)
app.get('/api/users/pwd/:id', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT * FROM v_pwd_details WHERE user_id = ?',
      [req.params.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'PWD not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user dashboard
app.get('/api/users/:id/dashboard', async (req, res) => {
  try {
    const [results] = await pool.query('CALL sp_get_user_dashboard(?)', [req.params.id]);
    res.json({
      userInfo: results[0][0] || null,
      activeAssignments: results[1] || [],
      recentProgress: results[2] || [],
      healthMetrics: results[3] || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DISABILITY TYPE ROUTES
// ============================================
app.get('/api/disability-types', async (req, res) => {
  try {
    const [types] = await pool.execute('SELECT * FROM disability_type');
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXERCISE ROUTES
// ============================================
app.get('/api/exercises', async (req, res) => {
  try {
    const [exercises] = await pool.execute('SELECT * FROM exercise ORDER BY exercise_name');
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exercises/:id', async (req, res) => {
  try {
    const [exercises] = await pool.execute('SELECT * FROM exercise WHERE exercise_id = ?', [req.params.id]);
    if (exercises.length === 0) return res.status(404).json({ error: 'Exercise not found' });
    res.json(exercises[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/exercises', async (req, res) => {
  try {
    const { exercise_name, description, difficulty_level, equipment_needed, target_muscle_group } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO exercise (exercise_name, description, difficulty_level, equipment_needed, target_muscle_group)
       VALUES (?, ?, ?, ?, ?)`,
      [exercise_name, description, difficulty_level, equipment_needed, target_muscle_group]
    );
    res.status(201).json({ message: 'Exercise added successfully', exerciseId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXERCISE ASSIGNMENT ROUTES
// ============================================
app.get('/api/assignments/user/:userId', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT ea.*, e.exercise_name, e.difficulty_level, e.target_muscle_group,
             u.name as assigned_by_name, u.role as assigned_by_role
      FROM exercise_assignment ea
      JOIN exercise e ON ea.exercise_id = e.exercise_id
      JOIN \`user\` u ON ea.assigned_by = u.user_id
      WHERE ea.user_id = ?`;
    const params = [req.params.userId];
    if (status) {
      query += ' AND ea.status = ?';
      params.push(status);
    }
    query += ' ORDER BY ea.start_date DESC';
    const [assignments] = await pool.execute(query, params);
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const { user_id, exercise_id, assigned_by, start_date, end_date, frequency } = req.body;
    const [result] = await pool.query(
      'CALL sp_assign_exercise(?, ?, ?, ?, ?, ?)',
      [user_id, exercise_id, assigned_by, start_date, end_date, frequency]
    );
    res.status(201).json({ message: 'Exercise assigned successfully', assignmentId: result[0][0].assignment_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update assignment status
app.put('/api/assignments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const [result] = await pool.execute('UPDATE exercise_assignment SET status = ? WHERE assignment_id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROGRESS TRACKING ROUTES
// ============================================
app.get('/api/progress/assignment/:assignmentId', async (req, res) => {
  try {
    const [progress] = await pool.execute('SELECT * FROM progress_tracking WHERE assignment_id = ? ORDER BY date_completed DESC', [req.params.assignmentId]);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/user/:userId/summary', async (req, res) => {
  try {
    const [summary] = await pool.execute('SELECT * FROM v_progress_summary WHERE user_id = ?', [req.params.userId]);
    res.json(summary[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/progress', async (req, res) => {
  try {
    const { assignment_id, duration_minutes, calories_burned, remarks, progress_score } = req.body;
    const [result] = await pool.query('CALL sp_log_progress(?, ?, ?, ?, ?)', [assignment_id, duration_minutes, calories_burned, remarks, progress_score]);
    res.status(201).json({ message: 'Progress logged successfully', progressId: result[0][0].progress_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/user/:userId/weekly', async (req, res) => {
  try {
    const [progress] = await pool.query(
      `SELECT 
        COUNT(DISTINCT pt.progress_id) AS total_sessions,
        SUM(CAST(pt.duration_minutes AS UNSIGNED)) AS total_minutes,
        SUM(CAST(pt.calories_burned AS UNSIGNED)) AS total_calories,
        AVG(CAST(pt.progress_score AS DECIMAL(10,2))) AS avg_progress_score
       FROM progress_tracking pt
       JOIN exercise_assignment ea ON pt.assignment_id = ea.assignment_id
       WHERE ea.user_id = ?
       AND pt.date_completed >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [req.params.userId]
    );
    res.json(progress[0] ?? { total_sessions: 0, total_minutes: 0, total_calories: 0, avg_progress_score: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH METRICS ROUTES
// ============================================
app.get('/api/health-metrics/user/:userId', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const [userCheck] = await pool.query('SELECT role FROM `user` WHERE user_id = ?', [req.params.userId]);
    if (!userCheck.length || userCheck[0].role !== 'PWD') return res.json([]);
    let query = 'SELECT * FROM health_metric WHERE user_id = ? ORDER BY date_recorded DESC';
    if (Number.isInteger(limit) && limit > 0) query += ` LIMIT ${limit}`;
    const [metrics] = await pool.query(query, [req.params.userId]);
    res.json(metrics);
  } catch (error) {
    console.error('Health metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/health-metrics', async (req, res) => {
  try {
    const { user_id, weight, blood_pressure, mobility_score, notes } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO health_metric (user_id, weight, blood_pressure, mobility_score, notes) VALUES (?, ?, ?, ?, ?)',
      [user_id, weight, blood_pressure, mobility_score, notes]
    );
    res.status(201).json({ message: 'Health metric added successfully', metricId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EDUCATIONAL CONTENT ROUTES
// ============================================
app.get('/api/education', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM educational_content';
    const params = [];
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY created_at DESC';
    const [content] = await pool.execute(query, params);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/education/:id', async (req, res) => {
  try {
    const [content] = await pool.execute('SELECT * FROM educational_content WHERE content_id = ?', [req.params.id]);
    if (content.length === 0) return res.status(404).json({ error: 'Content not found' });
    res.json(content[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/education/:id/access', async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.execute('INSERT INTO user_content_access (user_id, content_id) VALUES (?, ?)', [user_id, req.params.id]);
    res.status(201).json({ message: 'Content access logged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/education/summary/access', async (req, res) => {
  try {
    const [summary] = await pool.execute('SELECT * FROM v_content_access_summary');
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// THERAPIST/CAREGIVER ROUTES
// ============================================
app.get('/api/therapist/:therapistId/patients', async (req, res) => {
  try {
    const [patients] = await pool.execute(
      `SELECT DISTINCT u.user_id, u.name, u.age, u.gender, u.disability_type, u.contact_info
       FROM \`user\` u
       JOIN exercise_assignment ea ON u.user_id = ea.user_id
       WHERE ea.assigned_by = ? AND u.role = 'PWD'
       ORDER BY u.name`,
      [req.params.therapistId]
    );
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/therapist/:therapistId/assignments', async (req, res) => {
  try {
    const [assignments] = await pool.execute(
      'SELECT * FROM v_active_assignments WHERE assigned_by_role IN ("THERAPIST", "CAREGIVER")',
      []
    );
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'pwd_db'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});
