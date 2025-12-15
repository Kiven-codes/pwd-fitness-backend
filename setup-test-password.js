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
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'pwd_fitness_db'
    });

    console.log('✅ Connected to database');

    // Test password
    const testPassword = 'test123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    console.log('\n🔐 Hashing password:', testPassword);
    console.log('📝 Hash generated:', hashedPassword);

    // Update existing users
    const users = [
      { username: 'johndoe', role: 'PWD' },
      { username: 'drwilliams', role: 'THERAPIST' },
      { username: 'drchen', role: 'THERAPIST' },
      { username: 'marybrown', role: 'CAREGIVER' },
      { username: 'davidg', role: 'CAREGIVER' },
      { username: 'admin', role: 'ADMIN' }
    ];

    console.log('\n🔄 Updating passwords for test users...\n');

    for (const user of users) {
      const [result] = await connection.execute(
        'UPDATE USER SET password = ? WHERE username = ?',
        [hashedPassword, user.username]
      );

      if (result.affectedRows > 0) {
        console.log(`✅ ${user.username.padEnd(15)} (${user.role.padEnd(10)}) - Password updated`);
      } else {
        console.log(`⚠️  ${user.username.padEnd(15)} (${user.role.padEnd(10)}) - User not found`);
      }
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