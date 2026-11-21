const { Pool } = require('pg');
require('dotenv').config();

const usarSSL = process.env.DB_SSL === 'true';

let connectionString = process.env.DATABASE_URL || '';
if (usarSSL && connectionString.includes('sslmode=')) {
  connectionString = connectionString.replace(/([?&])sslmode=[^&]*(&?)/, (match, p1, p2) => {
    if (p1 === '?' && p2) return '?';
    if (p1 === '?' && !p2) return '';
    return p2 ? p1 : '';
  });
}

const pool = new Pool({
  connectionString,
  ssl: usarSSL ? { rejectUnauthorized: false } : false,
});

async function probarConexionDB() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    console.log('Conectado a PostgreSQL + PostGIS correctamente.');
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  probarConexionDB,
};
