// ============================================
// insert-users.js
// Creates test users with proper password hashing
// ============================================

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertUsers() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'switchyard.proxy.rlwy.net',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'vnwFoleMcNsKJRoxPoZGanGeZEaLqrIq',
      database: process.env.DB_NAME || 'pwd_db',
      port: process.env.DB_PORT || 57064
    });

    console.log('✅ Connected to database');
    console.log('📍 Host:', connection.config.host);
    console.log('📁 Database:', connection.config.database);
    console.log('');

    // Password for all test users
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('🔐 Password:', password);
    console.log('🔒 Hashed:', hashedPassword.substring(0, 30) + '...\n');

    // Test users to insert
    const users = [
      {
        name: 'John Doe',
        age: 35,
        gender: 'Male',
        disability_type: 'Wheelchair User',
        contact_info: 'john@example.com',
        username: 'johndoe',
        password: hashedPassword,
        role: 'PWD'
      },
      {
        name: 'Jane Smith',
        age: 28,
        gender: 'Female',
        disability_type: 'Visually Impaired',
        contact_info: 'jane@example.com',
        username: 'janesmith',
        password: hashedPassword,
        role: 'PWD'
      },
      {
        name: 'Dr. Sarah Williams',
        age: 45,
        gender: 'Female',
        disability_type: null,
        contact_info: 'sarah@clinic.com',
        username: 'drwilliams',
        password: hashedPassword,
        role: 'THERAPIST'
      },
      {
        name: 'Dr. Robert Chen',
        age: 38,
        gender: 'Male',
        disability_type: null,
        contact_info: 'robert@clinic.com',
        username: 'drchen',
        password: hashedPassword,
        role: 'THERAPIST'
      },
      {
        name: 'Mary Brown',
        age: 50,
        gender: 'Female',
        disability_type: null,
        contact_info: 'mary@care.com',
        username: 'marybrown',
        password: hashedPassword,
        role: 'CAREGIVER'
      },
      {
        name: 'David Garcia',
        age: 55,
        gender: 'Male',
        disability_type: null,
        contact_info: 'david@care.com',
        username: 'davidg',
        password: hashedPassword,
        role: 'CAREGIVER'
      },
      {
        name: 'System Admin',
        age: 30,
        gender: 'Other',
        disability_type: null,
        contact_info: 'admin@system.com',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN'
      }
    ];

    console.log('📝 Inserting users...\n');

    for (const user of users) {
      try {
        // Check if user already exists
        const [existing] = await connection.execute(
          'SELECT username FROM user WHERE username = ?',
          [user.username]
        );

        if (existing.length > 0) {
          // Update existing user
          await connection.execute(
            `UPDATE user SET 
              name = ?, 
              age = ?, 
              gender = ?, 
              disability_type = ?, 
              contact_info = ?, 
              password = ?, 
              role = ?
            WHERE username = ?`,
            [
              user.name,
              user.age,
              user.gender,
              user.disability_type,
              user.contact_info,
              user.password,
              user.role,
              user.username
            ]
          );
          console.log(`🔄 Updated: ${user.username.padEnd(15)} (${user.role.padEnd(10)}) - ${user.name}`);
        } else {
          // Insert new user
          await connection.execute(
            `INSERT INTO user 
              (name, age, gender, disability_type, contact_info, username, password, role) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user.name,
              user.age,
              user.gender,
              user.disability_type,
              user.contact_info,
              user.username,
              user.password,
              user.role
            ]
          );
          console.log(`✅ Inserted: ${user.username.padEnd(15)} (${user.role.padEnd(10)}) - ${user.name}`);
        }
      } catch (err) {
        console.error(`❌ Error with ${user.username}:`, err.message);
      }
    }

    // Verify insertion
    console.log('\n📊 Verifying users in database...\n');
    const [allUsers] = await connection.execute(
      'SELECT user_id, username, name, role FROM user ORDER BY role, username'
    );

    console.log('┌─────┬─────────────────┬──────────────────────────┬────────────┐');
    console.log('│ ID  │ Username        │ Name                     │ Role       │');
    console.log('├─────┼─────────────────┼──────────────────────────┼────────────┤');
    allUsers.forEach(u => {
      console.log(
        `│ ${String(u.user_id).padEnd(3)} │ ${u.username.padEnd(15)} │ ${u.name.padEnd(24)} │ ${u.role.padEnd(10)} │`
      );
    });
    console.log('└─────┴─────────────────┴──────────────────────────┴────────────┘');

    console.log('\n✨ Setup Complete!\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run the script
insertUsers();
