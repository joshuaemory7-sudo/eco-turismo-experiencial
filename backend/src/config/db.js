const { Pool } = require('pg');

function construirConnectionString(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('uselibpqcompat');
    return parsed.toString();
  } catch {
    return rawUrl.replace(/([?&])(sslmode|uselibpqcompat)=[^&]+(&|$)/gi, (m, p1, _k, p3) => {
      if (p1 === '?' && p3 === '&') return '?';
      if (p3 === '&') return p1;
      return '';
    });
  }
}

const usarSsl =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase'));

const pool = new Pool({
  connectionString: construirConnectionString(process.env.DATABASE_URL),
  ssl: usarSsl ? { rejectUnauthorized: false } : false,
});

async function probarConexionDB() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() AS ahora');
    console.log('Conectado a Supabase PostgreSQL:', res.rows[0].ahora);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  probarConexionDB,
};
