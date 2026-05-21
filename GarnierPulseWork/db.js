const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

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
    // 1. Ensure database exists
    const tempConnection = await mysql.createConnection(dbConfig);
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS garnier_hr_db;`);
    await tempConnection.end();

    // 2. Create the main connection pool
    pool = mysql.createPool({
      ...dbConfig,
      database: 'garnier_hr_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });

    console.log('✅ PulseWork connected to MySQL Database (garnier_hr_db).');
    return pool;
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error.message);
    throw error;
  }
}

async function initDB() {
  const connectionPool = await getPool();

  try {
    // Create Collaborators table
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS pulse_collaborators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'funcionario', 'jefatura'
        area VARCHAR(100) NOT NULL,
        avatar_url VARCHAR(255) NULL
      ) ENGINE=InnoDB;
    `);

    // Create Pulse Entries table (completely anonymized, links to area but not collaborator_id)
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS pulse_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        area VARCHAR(100) NOT NULL,
        feeling VARCHAR(50) NOT NULL, -- 'muy_bien', 'bien', 'neutral', 'estresado', 'desmotivado'
        feeling_score INT NOT NULL, -- 1 to 5
        influences TEXT NOT NULL, -- JSON array of selected influences
        comment TEXT NULL,
        sentiment_score FLOAT DEFAULT 0, -- Gemini analysis
        sentiment_label VARCHAR(50) DEFAULT 'neutral', -- 'positivo', 'neutral', 'negativo'
        topics TEXT NULL, -- JSON array of keywords
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create Streaks table to track engagement of employees (independent of raw pulse entries)
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS pulse_streaks (
        collaborator_id INT PRIMARY KEY,
        streak_count INT DEFAULT 0,
        points INT DEFAULT 0,
        last_registration DATE NULL,
        FOREIGN KEY (collaborator_id) REFERENCES pulse_collaborators(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Create Alerts table for wellness triggers
    await connectionPool.query(`
      CREATE TABLE IF NOT EXISTS pulse_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        area VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'unresolved', -- 'unresolved', 'resolved'
        severity VARCHAR(50) NOT NULL, -- 'en_observacion', 'en_alerta'
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    console.log('✅ PulseWork database tables initialized successfully.');

    // Seed mock data for collaborators
    const [rows] = await connectionPool.query(`SELECT COUNT(*) as count FROM pulse_collaborators;`);
    if (rows[0].count === 0) {
      console.log('🌱 Seeding initial collaborators...');
      const mockCollaborators = [
        ['juan.perez@garnier.com', 'Juan Pérez', 'funcionario', 'Tecnología', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'],
        ['maria.gomez@garnier.com', 'María Gómez', 'funcionario', 'Ventas', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80'],
        ['lucia.santos@garnier.com', 'Lucía Santos', 'funcionario', 'Administración', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80'],
        ['carlos.mora@garnier.com', 'Carlos Mora', 'jefatura', 'Tecnología', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'],
        ['sofia.castro@garnier.com', 'Sofía Castro', 'jefatura', 'Ventas', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80'],
        ['rh.jennifer@garnier.com', 'Jennifer Alí', 'jefatura', 'Recursos Humanos', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80']
      ];

      for (const col of mockCollaborators) {
        await connectionPool.query(
          `INSERT INTO pulse_collaborators (email, name, role, area, avatar_url) VALUES (?, ?, ?, ?, ?);`,
          col
        );
      }
      console.log('✅ Collaborators seeded.');
    }
  } catch (error) {
    console.error('❌ Database schema initialization failed:', error.message);
    throw error;
  }
}

module.exports = {
  getPool,
  initDB
};
