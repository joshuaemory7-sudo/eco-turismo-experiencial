const crypto = require('crypto');
const { pool } = require('../../config/db');

function generarCodigoValidacion() {
  return `ECO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function obtenerColumnasUsuarios(client) {
  const res = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'usuarios'`
  );
  return new Set(res.rows.map((r) => r.column_name));
}

async function obtenerOCrearViajero(client, payload) {
  const cols = await obtenerColumnasUsuarios(client);
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
      'SELECT * FROM usuarios WHERE id = $1',
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

  if (cols.has('identificacion')) {
    const buscado = await client.query(
      `SELECT * FROM usuarios
       WHERE identificacion = $1 OR identificacion = $2
       LIMIT 1`,
      [numDoc, docFormateado]
    );

    if (buscado.rows.length > 0) {
      const actual = buscado.rows[0];
      const sets = [];
      const vals = [];
      let idx = 1;

      if (cols.has('nombre')) { sets.push(`nombre = $${idx++}`); vals.push(nombreCompleto); }
      if (cols.has('nombres')) { sets.push(`nombres = $${idx++}`); vals.push(nombresLimpios); }
      if (cols.has('apellidos')) { sets.push(`apellidos = $${idx++}`); vals.push(apellidosLimpios); }
      if (cols.has('tipo_identificacion')) { sets.push(`tipo_identificacion = $${idx++}`); vals.push(tipoDoc); }
      if (cols.has('identificacion')) { sets.push(`identificacion = $${idx++}`); vals.push(numDoc); }
      if (cols.has('telefono')) { sets.push(`telefono = $${idx++}`); vals.push(telefonoLimpio); }

      if (sets.length > 0) {
        vals.push(actual.id);
        const actualizado = await client.query(
          `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
          vals
        );
        return actualizado.rows[0];
      }
      return actual;
    }
  }

  const emailGenerado = `viajero.${tipoDoc.toLowerCase()}.${numDoc.replace(/[^a-zA-Z0-9]/g, '')}@ecoturismo.local`;
  const insertCols = [];
  const insertVals = [];

  if (cols.has('nombre')) { insertCols.push('nombre'); insertVals.push(nombreCompleto); }
  if (cols.has('nombres')) { insertCols.push('nombres'); insertVals.push(nombresLimpios); }
  if (cols.has('apellidos')) { insertCols.push('apellidos'); insertVals.push(apellidosLimpios); }
  if (cols.has('email')) { insertCols.push('email'); insertVals.push(emailGenerado); }
  if (cols.has('correo')) { insertCols.push('correo'); insertVals.push(emailGenerado); }
  if (cols.has('password_hash')) { insertCols.push('password_hash'); insertVals.push('registro_rapido_reserva'); }
  if (cols.has('rol')) { insertCols.push('rol'); insertVals.push('viajero'); }
  if (cols.has('tipo_identificacion')) { insertCols.push('tipo_identificacion'); insertVals.push(tipoDoc); }
  if (cols.has('identificacion')) { insertCols.push('identificacion'); insertVals.push(numDoc); }
  if (cols.has('telefono')) { insertCols.push('telefono'); insertVals.push(telefonoLimpio); }

  const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
  const insertado = await client.query(
    `INSERT INTO usuarios (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    insertVals
  );
  return insertado.rows[0];
}

async function crearReserva(req, res) {
  const { experiencia_id, fecha_inicio, fecha_fin, cupos } = req.body;

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
      'SELECT id, titulo, precio_cop, cupo_maximo, activa FROM experiencias WHERE id = $1',
      [experiencia_id]
    );

    if (expResult.rows.length === 0 || !expResult.rows[0].activa) {
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
    const totalCop = Number(experiencia.precio_cop) * Number(cupos);
    const codigoValidacion = generarCodigoValidacion();

    const insertResult = await client.query(
      `INSERT INTO reservas (
        experiencia_id, viajero_id, fecha_inicio, fecha_fin, cupos, total_cop, estado, codigo_validacion
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmada', $7)
      RETURNING *`,
      [experiencia_id, viajero.id, fecha_inicio, fecha_fin, cupos, totalCop, codigoValidacion]
    );

    await client.query('COMMIT');

    const nombreViajero =
      viajero.nombre ||
      [viajero.nombres, viajero.apellidos].filter(Boolean).join(' ') ||
      `${req.body.nombres} ${req.body.apellidos}`;

    return res.status(201).json({
      reserva: {
        ...insertResult.rows[0],
        experiencia_titulo: experiencia.titulo,
        viajero_nombre: nombreViajero,
        viajero_tipo_identificacion: viajero.tipo_identificacion || req.body.tipo_identificacion || 'CC',
        viajero_identificacion: viajero.identificacion || req.body.identificacion,
        viajero_telefono: viajero.telefono || req.body.telefono,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(error.statusCode || 500).json({ error: error.message });
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
        to_jsonb(u) AS viajero_data
      FROM reservas r
      JOIN experiencias e ON e.id = r.experiencia_id
      JOIN usuarios u ON u.id = r.viajero_id
      WHERE UPPER(r.codigo_validacion) = UPPER($1)`,
      [codigo.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada con ese código.' });
    }

    const row = result.rows[0];
    const u = row.viajero_data || {};
    const nombreViajero =
      u.nombre || [u.nombres, u.apellidos].filter(Boolean).join(' ') || `Viajero #${row.viajero_id}`;

    delete row.viajero_data;

    return res.json({
      reserva: {
        ...row,
        viajero_nombre: nombreViajero,
        viajero_tipo_identificacion: u.tipo_identificacion || 'CC',
        viajero_identificacion: u.identificacion || null,
        viajero_telefono: u.telefono || null,
      },
    });
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
      `UPDATE reservas SET estado = 'ingresada' WHERE id = $1 RETURNING *`,
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
