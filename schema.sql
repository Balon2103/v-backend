-- ============================================================
-- SISTEMA DE VACUNACIÓN - ASIC Dr. Tulio Pineda
-- PostgreSQL - Ejecutar en Render o pgAdmin
-- ============================================================

-- Tabla: roles
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL UNIQUE,
  descripcion VARCHAR(200) DEFAULT NULL,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('administrador', 'Coordinador del ASIC. Acceso total al sistema.'),
  ('personal',      'Personal administrativo. Acceso operativo.')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  apellido       VARCHAR(100) NOT NULL,
  cedula         VARCHAR(20)  NOT NULL UNIQUE,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  rol_id         INTEGER      NOT NULL REFERENCES roles(id),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: sesiones
CREATE TABLE IF NOT EXISTS sesiones (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER      NOT NULL REFERENCES usuarios(id),
  token      VARCHAR(512) NOT NULL,
  ip_address VARCHAR(45)  DEFAULT NULL,
  user_agent VARCHAR(300) DEFAULT NULL,
  expira_en  TIMESTAMP    NOT NULL,
  creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: tipos_vacuna
CREATE TABLE IF NOT EXISTS tipos_vacuna (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT         DEFAULT NULL,
  num_dosis   SMALLINT     NOT NULL DEFAULT 1,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tipos_vacuna (nombre, num_dosis) VALUES
  ('BCG', 1),
  ('Polio Inyectable (IPV)', 4),
  ('Polio Oral', 4),
  ('Pentavalente', 3),
  ('Hepatitis B', 3),
  ('SRP', 2),
  ('Fiebre Amarilla', 1),
  ('Toxoide', 3)
ON CONFLICT (nombre) DO NOTHING;

-- Tabla: pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id               SERIAL PRIMARY KEY,
  cedula           VARCHAR(20)  NOT NULL UNIQUE,
  nombre           VARCHAR(100) NOT NULL,
  apellido         VARCHAR(100) NOT NULL,
  fecha_nacimiento DATE         NOT NULL,
  sexo             VARCHAR(10)  NOT NULL CHECK (sexo IN ('M','F','Otro')),
  telefono         VARCHAR(20)  DEFAULT NULL,
  direccion        TEXT         DEFAULT NULL,
  creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: vacunas_aplicadas
CREATE TABLE IF NOT EXISTS vacunas_aplicadas (
  id               SERIAL PRIMARY KEY,
  paciente_id      INTEGER  NOT NULL REFERENCES pacientes(id),
  tipo_vacuna_id   INTEGER  NOT NULL REFERENCES tipos_vacuna(id),
  usuario_id       INTEGER  NOT NULL REFERENCES usuarios(id),
  num_dosis        SMALLINT NOT NULL DEFAULT 1,
  lote             VARCHAR(50) DEFAULT NULL,
  fecha_aplicacion DATE        NOT NULL,
  observaciones    TEXT        DEFAULT NULL,
  creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: inventario
CREATE TABLE IF NOT EXISTS inventario (
  id             SERIAL PRIMARY KEY,
  tipo_vacuna_id INTEGER  NOT NULL UNIQUE REFERENCES tipos_vacuna(id),
  stock_actual   INTEGER  NOT NULL DEFAULT 0,
  stock_minimo   INTEGER  NOT NULL DEFAULT 10,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventario (tipo_vacuna_id, stock_actual, stock_minimo) VALUES
  (1,320,50),(2,180,30),(3,15,20),(4,8,30),
  (5,240,40),(6,6,25),(7,95,20),(8,110,30)
ON CONFLICT (tipo_vacuna_id) DO NOTHING;

-- Tabla: movimientos_inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id               SERIAL PRIMARY KEY,
  tipo_vacuna_id   INTEGER     NOT NULL REFERENCES tipos_vacuna(id),
  usuario_id       INTEGER     NOT NULL REFERENCES usuarios(id),
  tipo_movimiento  VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('entrada','salida')),
  cantidad         INTEGER     NOT NULL,
  lote             VARCHAR(50) DEFAULT NULL,
  fecha_movimiento DATE        NOT NULL,
  vencimiento      DATE        DEFAULT NULL,
  observaciones    TEXT        DEFAULT NULL,
  creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);