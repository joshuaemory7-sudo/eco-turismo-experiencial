const crypto = require('crypto');
const { pool } = require('../../config/db');

function generarCodigoValidacion() {
  return `ECO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function obtenerOCrearViajero(client, payload) {
  const {
    viajero_id,
    nombres,
    apellidos,
    telefono,
    tipo_identificacion,
    identificacion,
  } = payload;

  if (viajero_id && !nombres && !identificacion) {
    const resExistente = await client.query(
      'SELECT id, nombre, email, tipo_identificacion, identificacion, telefono FROM usuarios WHERE id = $1',
      [viajero_id]
    );
    return resExistente.rows[0] || null;
  }

  const nombresLimpios = String(nombres || '').trim();
  const apellidosLimpios = String(apellidos || '').trim();
  const telefonoLimpio = String(telefono || '').trim();
  const tipoDoc = String(tipo_identificacion || 'CC').trim().toUpperCase();
  const numDoc = String(identificacion || '').trim();

  if (!nombresLimpios || !apellidosLimpios || !telefonoLimpio || !numDoc) {
    throw Object.assign(
      new Error('Nombres, apellidos, teléfono e identificación son obligatorios.'),
      { statusCode: 400 }
    );
  }

  if (!['CC', 'TI', 'NIT'].includes(tipoDoc)) {
    throw Object.assign(
      new Error('El tipo de identificación debe ser CC, TI o NIT.'),
      { statusCode: 400 }
    );
  }

  const nombreCompleto = `${nombresLimpios} ${apellidosLimpios}`;
  const docFormateado = `${tipoDoc} ${numDoc}`;

  const buscado = await client.query(
    `SELECT id, nombre, email, tipo_identificacion, identificacion, telefono
     FROM usuarios
     WHERE identificacion = $1 OR identificacion = $2
     LIMIT 1`,
    [numDoc, docFormateado]
  );

  if (buscado.rows.length > 0) {
    const actual = buscado.rows[0];
    const actualizado = await client.query(
      `UPDATE usuarios
       SET nombre = $1,
           tipo_identificacion = $2,
           identificacion = $3,
           telefono = $4
       WHERE id = $5
       RETURNING id, nombre, email, tipo_identificacion, identificacion, telefono`,
      [nombreCompleto, tipoDoc, numDoc, telefonoLimpio, actual.id]
    );
    return actualizado.rows[0];
  }

  const emailGenerado = `viajero.${tipoDoc.toLowerCase()}.${numDoc.replace(/[^a-zA-Z0-9]/g, '')}@ecoturismo.local`;
  const insertado = await client.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, tipo_identificacion, identificacion, telefono)
     VALUES ($1, $2, $3, 'viajero', $4, $5, $6)
     RETURNING id, nombre, email, tipo_identificacion, identificacion, telefono`,
    [nombreCompleto, emailGenerado, 'registro_rapido_reserva', tipoDoc, numDoc, telefonoLimpio]
  );
  return insertado.rows[0];
}

async function crearReserva(req, res) {
  const {
    experiencia_id,
    fecha_inicio,
    fecha_fin,
    cupos,
  } = req.body;

  if (!experiencia_id || !fecha_inicio || !fecha_fin || !cupos) {
    return res.status(400).json({
      error: 'experiencia_id, fecha_inicio, fecha_fin y cupos son obligatorios.',
    });
  }

  if (Number(cupos) <= 0) {
    return res.status(400).json({ error: 'Los cupos deben ser mayores a 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const expResult = await client.query(
      'SELECT id, titulo, precio_cop, cupo_maximo, activo FROM experiencias WHERE id = $1',
      [experiencia_id]
    );

    if (expResult.rows.length === 0 || !expResult.rows[0].activo) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Experiencia no encontrada o inactiva.' });
    }

    const experiencia = expResult.rows[0];
    if (Number(cupos) > Number(experiencia.cupo_maximo)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Los cupos solicitados (${cupos}) superan el cupo máximo (${experiencia.cupo_maximo}).`,
      });
    }

    const viajero = await obtenerOCrearViajero(client, req.body);
    if (!viajero) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Viajero no encontrado.' });
    }

    const totalCop = Number(experiencia.precio_cop) * Number(cupos);
    const codigoValidacion = generarCodigoValidacion();

    const insertResult = await client.query(
      `INSERT INTO reservas (
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
      RETURNING *`,
      [
        experiencia_id,
        viajero.id,
        fecha_inicio,
        fecha_fin,
        cupos,
        totalCop,
        codigoValidacion,
      ]
    );

    await client.query('COMMIT');

    const reserva = insertResult.rows[0];
    return res.status(201).json({
      reserva: {
        ...reserva,
        experiencia_titulo: experiencia.titulo,
        viajero_nombre: viajero.nombre,
        viajero_tipo_identificacion: viajero.tipo_identificacion,
        viajero_identificacion: viajero.identificacion,
        viajero_telefono: viajero.telefono,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message });
  } finally {
    client.release();
  }
}

async function consultarReservaPorCodigo(req, res) {
  const { codigo } = req.params;
  try {
    const result = await pool.query(
      `SELECT
        r.*,
        e.titulo AS experiencia_titulo,
        e.municipio AS experiencia_municipio,
        u.nombre AS viajero_nombre,
        u.tipo_identificacion AS viajero_tipo_identificacion,
        u.identificacion AS viajero_identificacion,
        u.telefono AS viajero_telefono
      FROM reservas r
      JOIN experiencias e ON e.id = r.experiencia_id
      JOIN usuarios u ON u.id = r.viajero_id
      WHERE UPPER(r.codigo_validacion) = UPPER($1)`,
      [codigo.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada con ese código.' });
    }

    return res.json({ reserva: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function validarIngresoReserva(req, res) {
  const { codigo } = req.params;
  try {
    const actual = await pool.query(
      'SELECT id, estado, codigo_validacion FROM reservas WHERE UPPER(codigo_validacion) = UPPER($1)',
      [codigo.trim()]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada con ese código.' });
    }

    const reserva = actual.rows[0];
    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ error: 'No se puede validar ingreso: la reserva está cancelada.' });
    }

    if (reserva.estado === 'ingresada') {
      return res.json({
        mensaje: 'La reserva ya tenía el ingreso registrado previamente.',
        reserva,
      });
    }

    const updated = await pool.query(
      `UPDATE reservas
       SET estado = 'ingresada'
       WHERE id = $1
       RETURNING *`,
      [reserva.id]
    );

    return res.json({
      mensaje: 'Ingreso validado correctamente.',
      reserva: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  crearReserva,
  consultarReservaPorCodigo,
  validarIngresoReserva,
};
