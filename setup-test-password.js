// ============================================
// setup-test-users.js
// Run this to create/update test user passwords
// ============================================

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupTestUsers() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'switchyard.proxy.rlwy.net',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'vnwFoleMcNsKJRoxPoZGanGeZEaLqrIq',
      database: process.env.DB_NAME || 'pwd_db'
    });

    console.log('✅ Connected to database');

    // Test password
    const testPassword = 'test123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    console.log('\n🔐 Hashing password:', testPassword);
    console.log('📝 Hash generated:', hashedPassword);

    // Test users
    const users = [
      { name: 'John Doe', username: 'johndoe', role: 'PWD' },
      { name: 'Dr Williams', username: 'drwilliams', role: 'THERAPIST' },
      { name: 'Dr Chen', username: 'drchen', role: 'THERAPIST' },
      { name: 'Mary Brown', username: 'marybrown', role: 'CAREGIVER' },
      { name: 'David G', username: 'davidg', role: 'CAREGIVER' },
      { name: 'Admin', username: 'admin', role: 'ADMIN' }
    ];

    console.log('\n🔄 Inserting/updating test users...\n');

    for (const user of users) {
      // Insert or update password if user already exists
      const [result] = await connection.execute(
        `INSERT INTO user (name, username, password, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [user.name, user.username, hashedPassword, user.role]
      );

      console.log(`✅ ${user.username.padEnd(15)} (${user.role.padEnd(10)}) - Inserted/Updated`);
    }

    console.log('\n✨ Setup complete!\n');
    console.log('📋 Test Credentials:');
    console.log('═══════════════════════════════════════');
    console.log('PWD User:       johndoe / test123');
    console.log('Therapist:      drwilliams / test123');
    console.log('Therapist 2:    drchen / test123');
    console.log('Caregiver:      marybrown / test123');
    console.log('Caregiver 2:    davidg / test123');
    console.log('Admin:          admin / test123');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the setup
setupTestUsers();
