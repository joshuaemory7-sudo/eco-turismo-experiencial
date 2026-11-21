CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(160) NOT NULL UNIQUE,
  telefono VARCHAR(30),
  identificacion VARCHAR(40),
  rol VARCHAR(20) NOT NULL DEFAULT 'viajero'
    CHECK (rol IN ('viajero', 'anfitrion', 'admin')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiencias (
  id SERIAL PRIMARY KEY,
  anfitrion_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(160) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria VARCHAR(40) NOT NULL
    CHECK (categoria IN ('alojamiento_eco', 'senderismo', 'avistamiento', 'comunitaria', 'taller_sostenible')),
  practicas_sostenibles TEXT,
  precio_cop NUMERIC(12, 2) NOT NULL CHECK (precio_cop >= 0),
  cupo_maximo INTEGER NOT NULL CHECK (cupo_maximo > 0),
  ubicacion GEOGRAPHY(POINT, 4326) NOT NULL,
  municipio VARCHAR(100),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiencias_ubicacion
  ON experiencias USING GIST (ubicacion);

CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  experiencia_id INTEGER NOT NULL REFERENCES experiencias(id) ON DELETE RESTRICT,
  viajero_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  cupos INTEGER NOT NULL CHECK (cupos > 0),
  total_cop NUMERIC(12, 2) NOT NULL CHECK (total_cop >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'confirmada'
    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'ingresada')),
  codigo_validacion VARCHAR(80) NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fechas_reserva CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_reservas_experiencia ON reservas(experiencia_id);
CREATE INDEX IF NOT EXISTS idx_reservas_viajero ON reservas(viajero_id);
