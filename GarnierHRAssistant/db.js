const mysql = require('mysql2/promise');
require('dotenv').config();

// Standard connection options
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  port: parseInt(process.env.DB_PORT || '3306')
};

let pool = null;

async function getPool() {
  if (pool) return pool;

  try {
    // 1. First, connect to MySQL server without a database to ensure it exists
    const tempConnection = await mysql.createConnection(dbConfig);
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS garnier_hr_db;`);
    await tempConnection.end();

    // 2. Now create the main connection pool using the database
    pool = mysql.createPool({
      ...dbConfig,
      database: 'garnier_hr_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('✅ Connected to MySQL Database (garnier_hr_db).');
    return pool;
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error.message);
    throw error;
  }
}

async function initDB() {
  const connectionPool = await getPool();

  try {
    // Create Documents table
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        active INT DEFAULT 1,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create Document Chunks table
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT,
        page_number INT,
        content TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Create Queries table (for statistics)
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT NOT NULL,
        answered INT NOT NULL,
        document_source_id INT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_source_id) REFERENCES documents(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // Create Unanswered Queries table
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS unanswered_queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text VARCHAR(500) UNIQUE,
        frequency INT DEFAULT 1,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        notified INT DEFAULT 0
      ) ENGINE=InnoDB;
    `);

    // Create Escalations table
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS escalations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_name VARCHAR(255) NOT NULL,
        employee_email VARCHAR(255) NOT NULL,
        query_text TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL DEFAULT NULL
      ) ENGINE=InnoDB;
    `);

    console.log('✅ MySQL Database schemas initialized successfully.');
  } catch (error) {
    console.error('❌ Database schema initialization failed:', error.message);
    throw error;
  }
}

// Export functions to use across the project
module.exports = {
  getPool,
  initDB
};
