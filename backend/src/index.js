const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { pool, probarConexionDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
res.json({
status: 'ok',
project: 'Eco Turismo Experiencial',
timestamp: new Date().toISOString(),
});
});

app.get('/api/db-check', async (req, res) => {
try {
const result = await pool.query('SELECT PostGIS_Version() AS postgis_version');
res.json({
  db: 'connected',
  postgis: result.rows[0].postgis_version,
});
} catch (error) {
res.status(500).json({
  db: 'error',
  message: error.message,
});
}
});

app.listen(PORT, async () => {
console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
try {
await probarConexionDB();
} catch (error) {
console.error('Error al conectar con Supabase:', error.message);
}
});
