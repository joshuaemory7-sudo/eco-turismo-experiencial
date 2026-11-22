const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { pool, probarConexionDB } = require('./config/db');
const experienciasRoutes = require('./modules/experiencias/experiencias.routes');
const reservasRoutes = require('./modules/reservas/reservas.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    project: 'Eco Turismo Experiencial API',
    endpoints: [
      '/api/health',
      '/api/db-check',
      '/api/experiencias',
      '/api/reservas',
    ],
  });
});

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

app.use('/api/experiencias', experienciasRoutes);
app.use('/api/reservas', reservasRoutes);

app.listen(PORT, async () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
  try {
    await probarConexionDB();
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await probarConexionDB();
    } catch (error) {
      console.error('Error al conectar con Supabase:', error.message);
    }
  }
});

