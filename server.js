// ============================================
// UPDATED BACKEND API - server.js
// Based on new ERD structure
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
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'JKcB@272006',
  database: process.env.DB_NAME || 'pwd_fitness_db',
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
      `INSERT INTO USER (name, age, gender, disability_type, contact_info, username, password, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, age, gender, disability_type, contact_info, username, hashedPassword, role]
    );
    const userId = result.insertId;

    if (role === 'PWD' && disability_type) {
      const [disabilities] = await connection.execute(
        'SELECT disability_id FROM DISABILITY_TYPE WHERE disability_name = ?',
        [disability_type]
      );
      if (disabilities.length > 0) {
        await connection.execute(
          'UPDATE PWD SET disability_id = ? WHERE user_id = ?',
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
      'SELECT user_id, name, username, password, role, disability_type FROM USER WHERE username = ?',
      [username]
    );
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
  id: user.user_id,
  name: user.name,
  username: user.username,
  role: user.role,
  disability_type: user.disability_type
});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER ROUTES
// ============================================

// Get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info, username, role FROM USER WHERE user_id = ?',
      [req.params.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PWD details
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

// Get user dashboard data
app.get('/api/users/:id/dashboard', async (req, res) => {
  try {
    const [results] = await pool.execute('CALL sp_get_user_dashboard(?)', [req.params.id]);
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

// Get all disability types
app.get('/api/disability-types', async (req, res) => {
  try {
    const [types] = await pool.execute('SELECT * FROM DISABILITY_TYPE');
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EXERCISE ROUTES
// ============================================

// Get all exercises
app.get('/api/exercises', async (req, res) => {
  try {
    const [exercises] = await pool.execute('SELECT * FROM EXERCISE ORDER BY exercise_name');
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exercise by ID
app.get('/api/exercises/:id', async (req, res) => {
  try {
    const [exercises] = await pool.execute('SELECT * FROM EXERCISE WHERE exercise_id = ?', [req.params.id]);
    if (exercises.length === 0) return res.status(404).json({ error: 'Exercise not found' });
    res.json(exercises[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new exercise
app.post('/api/exercises', async (req, res) => {
  try {
    const { exercise_name, description, difficulty_level, equipment_needed, target_muscle_group } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO EXERCISE (exercise_name, description, difficulty_level, equipment_needed, target_muscle_group) 
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

// Get assignments for a PWD
app.get('/api/assignments/user/:userId', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT ea.*, e.exercise_name, e.difficulty_level, e.target_muscle_group,
             u.name as assigned_by_name, u.role as assigned_by_role
      FROM EXERCISE_ASSIGNMENT ea
      JOIN EXERCISE e ON ea.exercise_id = e.exercise_id
      JOIN USER u ON ea.assigned_by = u.user_id
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

// Assign exercise to PWD
app.post('/api/assignments', async (req, res) => {
  try {
    const { user_id, exercise_id, assigned_by, start_date, end_date, frequency } = req.body;
    const [result] = await pool.execute('CALL sp_assign_exercise(?, ?, ?, ?, ?, ?)', 
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
    const [result] = await pool.execute(
      'UPDATE EXERCISE_ASSIGNMENT SET status = ? WHERE assignment_id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROGRESS TRACKING ROUTES
// ============================================

// Get progress for an assignment
app.get('/api/progress/assignment/:assignmentId', async (req, res) => {
  try {
    const [progress] = await pool.execute(
      'SELECT * FROM PROGRESS_TRACKING WHERE assignment_id = ? ORDER BY date_completed DESC',
      [req.params.assignmentId]
    );
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get progress summary for a user
app.get('/api/progress/user/:userId/summary', async (req, res) => {
  try {
    const [summary] = await pool.execute(
      'SELECT * FROM v_progress_summary WHERE user_id = ?',
      [req.params.userId]
    );
    res.json(summary[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log progress
app.post('/api/progress', async (req, res) => {
  try {
    const { assignment_id, duration_minutes, calories_burned, remarks, progress_score } = req.body;
    const [result] = await pool.execute(
      'CALL sp_log_progress(?, ?, ?, ?, ?)',
      [assignment_id, duration_minutes, calories_burned, remarks, progress_score]
    );
    res.status(201).json({ message: 'Progress logged successfully', progressId: result[0][0].progress_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly progress
app.get('/api/progress/user/:userId/weekly', async (req, res) => {
  try {
    const [progress] = await pool.execute(
      `SELECT 
        COUNT(DISTINCT pt.progress_id) as total_sessions,
        SUM(pt.duration_minutes) as total_minutes,
        SUM(pt.calories_burned) as total_calories,
        AVG(pt.progress_score) as avg_progress_score
       FROM PROGRESS_TRACKING pt
       JOIN EXERCISE_ASSIGNMENT ea ON pt.assignment_id = ea.assignment_id
       WHERE ea.user_id = ?
       AND pt.date_completed >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [req.params.userId]
    );
    res.json(progress[0] || { total_sessions: 0, total_minutes: 0, total_calories: 0, avg_progress_score: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH METRICS ROUTE (FIXED)
// ============================================
// Add a new health metric
app.post('/api/health-metrics/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const { weight, blood_pressure, mobility_score, notes } = req.body;
    if (!weight || !blood_pressure || !mobility_score) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO HEALTH_METRIC (user_id, weight, blood_pressure, mobility_score, notes, date_recorded)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    const params = [userId, weight, blood_pressure, mobility_score, notes];

    await pool.execute(query, params);

    res.status(201).json({ success: true, message: 'Metric added successfully' });
  } catch (error) {
    console.error('Error adding health metric:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get health metrics for a user
// Get health metrics for a user
app.get('/api/health-metrics/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const query = `
      SELECT metric_id, user_id, date_recorded, weight, blood_pressure, mobility_score, notes
      FROM HEALTH_METRIC
      WHERE user_id = ?
      ORDER BY date_recorded DESC
    `;
    const [metrics] = await pool.execute(query, [userId]);

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


// ============================================
// EDUCATIONAL CONTENT ROUTES
// ============================================

// Get all educational content
app.get('/api/education', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM EDUCATIONAL_CONTENT';
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

// Get educational content by ID
app.get('/api/education/:id', async (req, res) => {
  try {
    const [content] = await pool.execute(
      'SELECT * FROM EDUCATIONAL_CONTENT WHERE content_id = ?',
      [req.params.id]
    );
    if (content.length === 0) return res.status(404).json({ error: 'Content not found' });
    res.json(content[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log content access
app.post('/api/education/:id/access', async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.execute(
      'INSERT INTO USER_CONTENT_ACCESS (user_id, content_id) VALUES (?, ?)',
      [user_id, req.params.id]
    );
    res.status(201).json({ message: 'Content access logged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Content access summary
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

// Get all PWDs for a therapist/caregiver
app.get('/api/therapist/:therapistId/patients', async (req, res) => {
  try {
    const [patients] = await pool.execute(
      `SELECT DISTINCT u.user_id, u.name, u.age, u.gender, u.disability_type, u.contact_info
       FROM USER u
       JOIN EXERCISE_ASSIGNMENT ea ON u.user_id = ea.user_id
       WHERE ea.assigned_by = ? AND u.role = 'PWD'
       ORDER BY u.name`,
      [req.params.therapistId]
    );
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active assignments by therapist
app.get('/api/therapist/:therapistId/assignments', async (req, res) => {
  try {
    const [assignments] = await pool.execute(
      `SELECT * FROM v_active_assignments WHERE assigned_by_role IN ('THERAPIST', 'CAREGIVER')`,
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
  console.log(`📊 Database: ${process.env.DB_NAME || 'pwd_fitness_db'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});