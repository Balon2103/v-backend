// controllers/vacunasController.js
const db = require("../config/db");

// Convierte texto de dosis al número correspondiente
const MAPA_DOSIS = {
  Única: 1,
  "1ra dosis": 1,
  "2da dosis": 2,
  "3ra dosis": 3,
  Refuerzo: 4,
};

function parsearDosis(dosis) {
  if (!dosis) return 1;
  if (MAPA_DOSIS[dosis] !== undefined) return MAPA_DOSIS[dosis];
  const n = parseInt(dosis);
  return isNaN(n) ? 1 : n;
}

// ── GET /api/vacunas ────────────────────────────────────────
async function listar(req, res) {
  try {
    const { cedula, vacuna, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;

    if (cedula) {
      where += ` AND (p.cedula ILIKE $${idx} OR CONCAT(p.nombre,' ',p.apellido) ILIKE $${idx})`;
      params.push(`%${cedula}%`);
      idx++;
    }
    if (vacuna) {
      where += ` AND tv.nombre = $${idx++}`;
      params.push(vacuna);
    }

    const countResult = await db.query(
      `SELECT COUNT(*)
       FROM vacunas_aplicadas va
       JOIN pacientes    p  ON va.paciente_id    = p.id
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT
         va.id,
         p.cedula,
         p.nombre    || ' ' || p.apellido AS paciente,
         p.telefono,
         p.email,
         tv.nombre    AS vacuna,
         va.num_dosis AS dosis,
         va.lote,
         va.fecha_aplicacion AS fecha,
         va.observaciones,
         u.nombre || ' ' || u.apellido AS vacunador,
         va.creado_en
       FROM vacunas_aplicadas va
       JOIN pacientes    p  ON va.paciente_id    = p.id
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON va.usuario_id     = u.id
       ${where}
       ORDER BY va.fecha_aplicacion DESC, va.creado_en DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset],
    );

    // Convertir num_dosis a texto legible para el frontend
    const registros = result.rows.map((r) => ({
      ...r,
      dosis: dosisATexto(r.dosis),
    }));

    return res.json({
      ok: true,
      total,
      pagina: parseInt(page),
      limite: parseInt(limit),
      registros,
    });
  } catch (err) {
    console.error("[listar vacunas]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── GET /api/vacunas/vacunadores ────────────────────────────
async function vacunadores(req, res) {
  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.nombre || ' ' || u.apellido AS nombre,
         u.email,
         r.nombre AS rol,
         COUNT(va.id)                   AS total_vacunas,
         COUNT(DISTINCT va.paciente_id) AS total_pacientes,
         MAX(va.fecha_aplicacion)       AS ultima_aplicacion,
         MIN(va.fecha_aplicacion)       AS primera_aplicacion
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN vacunas_aplicadas va ON va.usuario_id = u.id
       WHERE u.activo = true
       GROUP BY u.id, u.nombre, u.apellido, u.email, r.nombre
       ORDER BY total_vacunas DESC`,
    );

    const detalle = await db.query(
      `SELECT
         u.id AS usuario_id,
         tv.nombre AS vacuna,
         COUNT(*) AS cantidad
       FROM vacunas_aplicadas va
       JOIN usuarios     u  ON va.usuario_id     = u.id
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       GROUP BY u.id, tv.nombre
       ORDER BY u.id, cantidad DESC`,
    );

    const detalleMap = {};
    detalle.rows.forEach((d) => {
      if (!detalleMap[d.usuario_id]) detalleMap[d.usuario_id] = [];
      detalleMap[d.usuario_id].push({
        vacuna: d.vacuna,
        cantidad: parseInt(d.cantidad),
      });
    });

    const lista = result.rows.map((v) => ({
      ...v,
      total_vacunas: parseInt(v.total_vacunas),
      total_pacientes: parseInt(v.total_pacientes),
      detalle_vacunas: detalleMap[v.id] || [],
    }));

    return res.json({ ok: true, vacunadores: lista });
  } catch (err) {
    console.error("[vacunadores]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── GET /api/vacunas/paciente/:cedula ───────────────────────
async function historialPaciente(req, res) {
  try {
    const pac = await db.query(
      `SELECT cedula, nombre, apellido, fecha_nacimiento,
              sexo, telefono,
              COALESCE(email, '')     AS email,
              COALESCE(direccion, '') AS direccion
       FROM pacientes WHERE cedula = $1`,
      [req.params.cedula],
    );

    if (pac.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Paciente no encontrado." });

    const historial = await db.query(
      `SELECT
         va.id,
         tv.nombre    AS vacuna,
         va.num_dosis AS dosis,
         va.lote,
         va.fecha_aplicacion AS fecha,
         va.observaciones,
         u.nombre || ' ' || u.apellido AS vacunador
       FROM vacunas_aplicadas va
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON va.usuario_id     = u.id
       WHERE va.paciente_id = (SELECT id FROM pacientes WHERE cedula = $1)
       ORDER BY va.fecha_aplicacion DESC`,
      [req.params.cedula],
    );

    const rows = historial.rows.map((r) => ({
      ...r,
      dosis: dosisATexto(r.dosis),
    }));

    return res.json({ ok: true, paciente: pac.rows[0], historial: rows });
  } catch (err) {
    console.error("[historial paciente]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── GET /api/vacunas/:id ────────────────────────────────────
async function obtener(req, res) {
  try {
    const result = await db.query(
      `SELECT
         va.id,
         p.cedula, p.nombre, p.apellido, p.telefono,
         COALESCE(p.email,'')     AS email,
         COALESCE(p.direccion,'') AS direccion,
         p.fecha_nacimiento, p.sexo,
         tv.nombre    AS vacuna,
         tv.id        AS tipo_vacuna_id,
         va.num_dosis AS dosis,
         va.lote,
         va.fecha_aplicacion AS fecha,
         va.observaciones,
         u.id AS vacunador_id,
         u.nombre || ' ' || u.apellido AS vacunador
       FROM vacunas_aplicadas va
       JOIN pacientes    p  ON va.paciente_id    = p.id
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON va.usuario_id     = u.id
       WHERE va.id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Registro no encontrado." });

    const r = { ...result.rows[0], dosis: dosisATexto(result.rows[0].dosis) };
    return res.json({ ok: true, registro: r });
  } catch (err) {
    console.error("[obtener vacuna]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── POST /api/vacunas ───────────────────────────────────────
async function registrar(req, res) {
  console.log("[registrar vacuna] body:", JSON.stringify(req.body));

  const {
    cedula,
    nombre,
    apellido,
    fecha_nacimiento,
    sexo,
    telefono,
    email,
    direccion,
    tipo_vacuna_id,
    dosis,
    lote,
    fecha_aplicacion,
    observaciones,
    vacunador_id,
  } = req.body;

  // ── Validaciones ──────────────────────────────────────────
  if (!cedula || !nombre || !apellido) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "Cédula, nombre y apellido son obligatorios.",
      });
  }
  if (!tipo_vacuna_id) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "Debe seleccionar el tipo de vacuna." });
  }
  if (!dosis) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "Debe seleccionar el número de dosis." });
  }
  if (!fecha_aplicacion) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "La fecha de aplicación es obligatoria." });
  }

  // Convertir dosis de texto a número (SMALLINT)
  const numDosis = parsearDosis(dosis);
  const idVacunador = vacunador_id ? parseInt(vacunador_id) : req.usuario.id;

  // Verificar tipo de vacuna
  const tipoCheck = await db.query(
    "SELECT id FROM tipos_vacuna WHERE id = $1",
    [parseInt(tipo_vacuna_id)],
  );
  if (tipoCheck.rows.length === 0) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "El tipo de vacuna seleccionado no existe.",
      });
  }

  // Verificar vacunador
  const vacCheck = await db.query(
    "SELECT id FROM usuarios WHERE id = $1 AND activo = true",
    [idVacunador],
  );
  if (vacCheck.rows.length === 0) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "El vacunador seleccionado no existe o está inactivo.",
      });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // ── Buscar o crear paciente ───────────────────────────
    let pacienteId;
    const pacExiste = await client.query(
      "SELECT id FROM pacientes WHERE cedula = $1",
      [cedula.trim()],
    );

    if (pacExiste.rows.length > 0) {
      pacienteId = pacExiste.rows[0].id;
      await client.query(
        `UPDATE pacientes SET
           nombre         = $1,
           apellido       = $2,
           telefono       = COALESCE($3, telefono),
           email          = COALESCE($4, email),
           direccion      = COALESCE($5, direccion),
           actualizado_en = NOW()
         WHERE id = $6`,
        [
          nombre.trim(),
          apellido.trim(),
          telefono || null,
          email || null,
          direccion || null,
          pacienteId,
        ],
      );
      console.log("[registrar vacuna] Paciente actualizado, id:", pacienteId);
    } else {
      if (!fecha_nacimiento || !sexo) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          mensaje:
            "Para un nuevo paciente se requieren fecha de nacimiento y sexo.",
        });
      }
      const nuevo = await client.query(
        `INSERT INTO pacientes
           (cedula, nombre, apellido, fecha_nacimiento, sexo, telefono, email, direccion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          cedula.trim(),
          nombre.trim(),
          apellido.trim(),
          fecha_nacimiento,
          sexo,
          telefono || null,
          email || null,
          direccion || null,
        ],
      );
      pacienteId = nuevo.rows[0].id;
      console.log("[registrar vacuna] Nuevo paciente creado, id:", pacienteId);
    }

    // ── Registrar vacuna aplicada ─────────────────────────
    const vacResult = await client.query(
      `INSERT INTO vacunas_aplicadas
         (paciente_id, tipo_vacuna_id, usuario_id, num_dosis, lote, fecha_aplicacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        pacienteId,
        parseInt(tipo_vacuna_id),
        idVacunador,
        numDosis, // ← número, no texto
        lote || null,
        fecha_aplicacion,
        observaciones || null,
      ],
    );
    console.log(
      "[registrar vacuna] Registrada con id:",
      vacResult.rows[0].id,
      "dosis:",
      numDosis,
    );

    // ── Descontar del inventario ──────────────────────────
    await client.query(
      `UPDATE inventario SET
         stock_actual   = GREATEST(0, stock_actual - 1),
         actualizado_en = NOW()
       WHERE tipo_vacuna_id = $1`,
      [parseInt(tipo_vacuna_id)],
    );

    // ── Movimiento de salida ──────────────────────────────
    await client.query(
      `INSERT INTO movimientos_inventario
         (tipo_vacuna_id, usuario_id, tipo_movimiento, cantidad, lote, fecha_movimiento)
       VALUES ($1,$2,'salida',1,$3,$4)`,
      [parseInt(tipo_vacuna_id), idVacunador, lote || null, fecha_aplicacion],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      mensaje: "Vacuna registrada correctamente.",
      id: vacResult.rows[0].id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[registrar vacuna] ERROR:", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  } finally {
    client.release();
  }
}

// ── Helper: número de dosis → texto legible ─────────────────
function dosisATexto(num) {
  const MAPA = {
    1: "1ra dosis",
    2: "2da dosis",
    3: "3ra dosis",
    4: "Refuerzo",
  };
  return MAPA[num] || `Dosis ${num}`;
}

module.exports = { listar, obtener, registrar, historialPaciente, vacunadores };
