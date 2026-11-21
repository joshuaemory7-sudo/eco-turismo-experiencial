const crypto = require('crypto');
const { pool } = require('../../config/db');

async function listarReservas(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.experiencia_id,
        e.titulo AS experiencia_titulo,
        r.viajero_id,
        u.nombre AS viajero_nombre,
        u.identificacion AS viajero_identificacion,
        u.telefono AS viajero_telefono,
        r.fecha_inicio,
        r.fecha_fin,
        r.cupos,
        r.total_cop,
        r.estado,
        r.codigo_validacion
      FROM reservas r
      JOIN experiencias e ON e.id = r.experiencia_id
      JOIN usuarios u ON u.id = r.viajero_id
      ORDER BY r.creado_en DESC
    `);
    res.json({ total: result.rowCount, reservas: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al listar reservas', detalle: error.message });
  }
}

async function crearReserva(req, res) {
  try {
    const { experiencia_id, viajero_id, fecha_inicio, fecha_fin, cupos } = req.body;

    if (!experiencia_id || !viajero_id || !fecha_inicio || !fecha_fin || !cupos) {
      return res.status(400).json({ error: 'Faltan datos obligatorios de la reserva.' });
    }

    const cuposNum = Number(cupos);
    if (cuposNum <= 0) {
      return res.status(400).json({ error: 'La cantidad de cupos debe ser mayor a 0.' });
    }

    const expRes = await pool.query(
      'SELECT id, precio_cop, cupo_maximo, activa FROM experiencias WHERE id = $1',
      [Number(experiencia_id)]
    );

    if (expRes.rowCount === 0 || !expRes.rows[0].activa) {
      return res.status(404).json({ error: 'La experiencia no existe o no está activa.' });
    }

    const experiencia = expRes.rows[0];
    if (cuposNum > experiencia.cupo_maximo) {
      return res.status(400).json({ error: `Supera el cupo máximo permitido (${experiencia.cupo_maximo}).` });
    }

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const diffDias = Math.max(1, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)) || 1);
    const totalCop = Number(experiencia.precio_cop) * cuposNum * diffDias;
    const codigoValidacion = `ECO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const insertRes = await pool.query(
      `
      INSERT INTO reservas (
        experiencia_id,
        viajero_id,
        fecha_inicio,
        fecha_fin,
        cupos,
        total_cop,
        estado,
        codigo_validacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmada', $7)
      RETURNING *
      `,
      [
        Number(experiencia_id),
        Number(viajero_id),
        fecha_inicio,
        fecha_fin,
        cuposNum,
        totalCop,
        codigoValidacion,
      ]
    );

    res.status(201).json({ reserva: insertRes.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear reserva', detalle: error.message });
  }
}

async function obtenerReservaPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.cupos,
        r.total_cop,
        r.estado,
        r.codigo_validacion,
        e.titulo AS experiencia_titulo,
        u.nombre AS viajero_nombre,
        u.identificacion AS viajero_identificacion,
        u.telefono AS viajero_telefono
      FROM reservas r
      JOIN experiencias e ON e.id = r.experiencia_id
      JOIN usuarios u ON u.id = r.viajero_id
      WHERE r.codigo_validacion = $1
      `,
      [codigo.trim().toUpperCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Código de reserva no encontrado.' });
    }

    res.json({ reserva: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar la reserva', detalle: error.message });
  }
}

async function validarIngresoReserva(req, res) {
  try {
    const { codigo } = req.params;
    const codigoLimpio = codigo.trim().toUpperCase();

    const actualRes = await pool.query(
      'SELECT id, estado FROM reservas WHERE codigo_validacion = $1',
      [codigoLimpio]
    );

    if (actualRes.rowCount === 0) {
      return res.status(404).json({ error: 'Código de reserva no encontrado.' });
    }

    const actual = actualRes.rows[0];
    if (actual.estado === 'cancelada') {
      return res.status(400).json({ error: 'La reserva está cancelada y no puede ingresar.' });
    }

    const updatedRes = await pool.query(
      `
      UPDATE reservas
      SET estado = 'ingresada'
      WHERE codigo_validacion = $1
      RETURNING id, experiencia_id, viajero_id, fecha_inicio, fecha_fin, cupos, total_cop, estado, codigo_validacion
      `,
      [codigoLimpio]
    );

    res.json({
      mensaje: 'Ingreso validado correctamente.',
      reserva: updatedRes.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al validar ingreso de reserva', detalle: error.message });
  }
}

module.exports = {
  listarReservas,
  crearReserva,
  obtenerReservaPorCodigo,
  validarIngresoReserva,
};
