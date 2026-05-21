const mysql = require('mysql2/promise');

let pool = null;
let dbReady = false;

async function ensureDatabase() {
  if (dbReady) return;
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root';
  const dbName = process.env.DB_NAME || 'garnier_hr_db';

  const adminConn = await mysql.createConnection({ host, port, user, password });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await adminConn.end();
  dbReady = true;
}

async function getPool() {
  await ensureDatabase();
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'garnier_hr_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return pool;
}

async function initDB() {
  const p = await getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS enps_surveys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      area VARCHAR(120) NOT NULL,
      puesto VARCHAR(120) NOT NULL,
      antiguedad VARCHAR(60) NOT NULL,
      enps_score INT NOT NULL,
      leadership_score INT NOT NULL,
      communication_score INT NOT NULL,
      growth_score INT NOT NULL,
      benefits_score INT NOT NULL,
      culture_score INT NOT NULL,
      work_life_score INT NOT NULL,
      open_positive TEXT,
      open_improve TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { getPool, initDB };
