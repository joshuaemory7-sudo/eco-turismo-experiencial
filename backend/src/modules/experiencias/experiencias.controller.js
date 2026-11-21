const { pool } = require('../../config/db');

async function listarExperiencias(req, res) {
  try {
    const { categoria, lat, lng, radioKm } = req.query;

    const condiciones = ['e.activa = TRUE'];
    const valores = [];
    let idx = 1;

    if (categoria) {
      condiciones.push(`e.categoria = $${idx++}`);
      valores.push(categoria);
    }

    let selectDistancia = 'NULL::DOUBLE PRECISION AS distancia_metros';
    let orderBy = 'e.creado_en DESC';

    const tieneCoords = lat !== undefined && lng !== undefined && lat !== '' && lng !== '';
    if (tieneCoords) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radioMetros = (Number(radioKm) > 0 ? Number(radioKm) : 25) * 1000;

      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return res.status(400).json({ error: 'lat y lng deben ser números válidos.' });
      }

      const pLng = idx++;
      const pLat = idx++;
      const pRadio = idx++;

      valores.push(lngNum, latNum, radioMetros);

      selectDistancia = `ROUND(ST_Distance(e.ubicacion, ST_SetSRID(ST_MakePoint($${pLng}, $${pLat}), 4326)::geography)::numeric, 1) AS distancia_metros`;
      condiciones.push(`ST_DWithin(e.ubicacion, ST_SetSRID(ST_MakePoint($${pLng}, $${pLat}), 4326)::geography, $${pRadio})`);
      orderBy = 'distancia_metros ASC';
    }

    const sql = `
      SELECT
        e.id,
        e.titulo,
        e.descripcion,
        e.categoria,
        e.practicas_sostenibles,
        e.precio_cop,
        e.cupo_maximo,
        e.municipio,
        ST_Y(e.ubicacion::geometry) AS latitud,
        ST_X(e.ubicacion::geometry) AS longitud,
        ${selectDistancia},
        u.nombre AS anfitrion_nombre
      FROM experiencias e
      JOIN usuarios u ON u.id = e.anfitrion_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY ${orderBy}
    `;

    const result = await pool.query(sql, valores);
    res.json({ total: result.rowCount, experiencias: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al listar experiencias', detalle: error.message });
  }
}

async function crearExperiencia(req, res) {
  try {
    const {
      anfitrion_id,
      titulo,
      descripcion,
      categoria,
      practicas_sostenibles,
      precio_cop,
      cupo_maximo,
      latitud,
      longitud,
      municipio,
    } = req.body;

    if (!anfitrion_id || !titulo || !descripcion || !categoria || precio_cop === undefined || !cupo_maximo || latitud === undefined || longitud === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para crear la experiencia.' });
    }

    const sql = `
      INSERT INTO experiencias (
        anfitrion_id,
        titulo,
        descripcion,
        categoria,
        practicas_sostenibles,
        precio_cop,
        cupo_maximo,
        ubicacion,
        municipio
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
        $10
      )
      RETURNING
        id,
        titulo,
        categoria,
        precio_cop,
        cupo_maximo,
        municipio,
        ST_Y(ubicacion::geometry) AS latitud,
        ST_X(ubicacion::geometry) AS longitud
    `;

    const valores = [
      Number(anfitrion_id),
      titulo,
      descripcion,
      categoria,
      practicas_sostenibles || null,
      Number(precio_cop),
      Number(cupo_maximo),
      Number(longitud),
      Number(latitud),
      municipio || null,
    ];

    const result = await pool.query(sql, valores);
    res.status(201).json({ experiencia: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear experiencia', detalle: error.message });
  }
}

module.exports = {
  listarExperiencias,
  crearExperiencia,
};
