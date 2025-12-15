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
      `INSERT INTO user (name, age, gender, disability_type, contact_info, username, password, role) 
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
      'SELECT user_id, name, username, password, role, disability_type FROM user WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
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

// Get all users (Admin only)
app.get('/api/users/all', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info, username, role, created_at FROM user ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info, username, role FROM user WHERE user_id = ?',
      [req.params.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all PWD users
app.get('/api/users/pwds', async (req, res) => {
  try {
    const [pwds] = await pool.execute(
      'SELECT user_id, name, age, gender, disability_type, contact_info FROM user WHERE role = "PWD" ORDER BY name'
    );
    console.log('PWDs fetched:', pwds);
    res.json(pwds);
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
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'PWD not found' });
    }
    
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User dashboard
app.get('/api/users/:id/dashboard', async (req, res) => {
  try {
    const [results] = await pool.query(
      'CALL sp_get_user_dashboard(?)',
      [req.params.id]
    );
    
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
    
    if (exercises.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    
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
    
    res.status(201).json({
      message: 'Exercise added successfully',
      exerciseId: result.insertId
    });
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
      JOIN user u ON ea.assigned_by = u.user_id
      WHERE ea.user_id = ?
    `;
    
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
    
    res.status(201).json({
      message: 'Exercise assigned successfully',
      assignmentId: result[0][0].assignment_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Continue same pattern for:
// - assignments/all
// - assignments/:id/status
// - progress_tracking routes
// - health_metric routes
// - educational_content routes
// - therapist/caregiver routes

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
