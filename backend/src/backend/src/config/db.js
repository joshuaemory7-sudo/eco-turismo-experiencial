const { Pool } = require('pg');
require('dotenv').config();

const usarSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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