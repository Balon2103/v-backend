// controllers/vacunasController.js
const db = require("../config/db");

// ── GET /api/vacunas ────────────────────────────────────────
// Listar todas las vacunas aplicadas con datos del paciente
async function listar(req, res) {
  try {
    const { cedula, vacuna, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;

    if (cedula) {
      where += ` AND p.cedula ILIKE $${idx++}`;
      params.push(`%${cedula}%`);
    }
    if (vacuna) {
      where += ` AND tv.nombre = $${idx++}`;
      params.push(vacuna);
    }

    // Total para paginación
    const countResult = await db.query(
      `SELECT COUNT(*) FROM vacunas_aplicadas va
       JOIN pacientes    p  ON va.paciente_id    = p.id
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    // Datos paginados
    const result = await db.query(
      `SELECT
         va.id,
         p.cedula,
         p.nombre    || ' ' || p.apellido AS paciente,
         p.telefono,
         p.email,
         tv.nombre   AS vacuna,
         va.num_dosis AS dosis,
         va.lote,
         va.fecha_aplicacion AS fecha,
         va.observaciones,
         u.nombre    || ' ' || u.apellido AS vacunador,
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

    return res.json({
      ok: true,
      total,
      pagina: parseInt(page),
      limite: parseInt(limit),
      registros: result.rows,
    });
  } catch (err) {
    console.error("[listar vacunas]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

// ── GET /api/vacunas/:id ────────────────────────────────────
async function obtener(req, res) {
  try {
    const result = await db.query(
      `SELECT
         va.id,
         p.cedula, p.nombre, p.apellido, p.telefono, p.email,
         p.fecha_nacimiento, p.sexo, p.direccion,
         tv.nombre AS vacuna, tv.id AS tipo_vacuna_id,
         va.num_dosis AS dosis,
         va.lote, va.fecha_aplicacion AS fecha, va.observaciones,
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
    return res.json({ ok: true, registro: result.rows[0] });
  } catch (err) {
    console.error("[obtener vacuna]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

// ── POST /api/vacunas ───────────────────────────────────────
// Registrar vacuna aplicada (crea paciente si no existe)
async function registrar(req, res) {
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
  } = req.body;

  // Validaciones
  if (
    !cedula ||
    !nombre ||
    !apellido ||
    !tipo_vacuna_id ||
    !dosis ||
    !fecha_aplicacion
  ) {
    return res.status(400).json({
      ok: false,
      mensaje:
        "Cédula, nombre, apellido, vacuna, dosis y fecha son obligatorios.",
    });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Buscar o crear paciente
    let pacienteId;
    const pacExiste = await client.query(
      "SELECT id FROM pacientes WHERE cedula = $1",
      [cedula.trim()],
    );

    if (pacExiste.rows.length > 0) {
      pacienteId = pacExiste.rows[0].id;
      // Actualizar datos si se enviaron
      await client.query(
        `UPDATE pacientes SET
           nombre           = COALESCE($1, nombre),
           apellido         = COALESCE($2, apellido),
           telefono         = COALESCE($3, telefono),
           email            = COALESCE($4, email),
           direccion        = COALESCE($5, direccion),
           actualizado_en   = NOW()
         WHERE id = $6`,
        [
          nombre,
          apellido,
          telefono || null,
          email || null,
          direccion || null,
          pacienteId,
        ],
      );
    } else {
      // Crear nuevo paciente
      if (!fecha_nacimiento || !sexo) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          mensaje:
            "Para un nuevo paciente se requiere fecha de nacimiento y sexo.",
        });
      }
      const nuevoPac = await client.query(
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
      pacienteId = nuevoPac.rows[0].id;
    }

    // Registrar vacuna aplicada
    const vacResult = await client.query(
      `INSERT INTO vacunas_aplicadas
         (paciente_id, tipo_vacuna_id, usuario_id, num_dosis, lote, fecha_aplicacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        pacienteId,
        parseInt(tipo_vacuna_id),
        req.usuario.id,
        dosis,
        lote || null,
        fecha_aplicacion,
        observaciones || null,
      ],
    );

    // Descontar del inventario
    await client.query(
      `UPDATE inventario SET
         stock_actual   = GREATEST(0, stock_actual - 1),
         actualizado_en = NOW()
       WHERE tipo_vacuna_id = $1`,
      [parseInt(tipo_vacuna_id)],
    );

    // Registrar movimiento de salida
    await client.query(
      `INSERT INTO movimientos_inventario
         (tipo_vacuna_id, usuario_id, tipo_movimiento, cantidad, lote, fecha_movimiento)
       VALUES ($1,$2,'salida',1,$3,$4)`,
      [
        parseInt(tipo_vacuna_id),
        req.usuario.id,
        lote || null,
        fecha_aplicacion,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      mensaje: "Vacuna registrada correctamente.",
      id: vacResult.rows[0].id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[registrar vacuna]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  } finally {
    client.release();
  }
}

// ── GET /api/vacunas/paciente/:cedula ───────────────────────
// Historial de un paciente por cédula
async function historialPaciente(req, res) {
  try {
    const result = await db.query(
      `SELECT
         va.id,
         tv.nombre AS vacuna,
         va.num_dosis AS dosis,
         va.lote,
         va.fecha_aplicacion AS fecha,
         va.observaciones,
         u.nombre || ' ' || u.apellido AS vacunador
       FROM vacunas_aplicadas va
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON va.usuario_id     = u.id
       JOIN pacientes    p  ON va.paciente_id    = p.id
       WHERE p.cedula = $1
       ORDER BY va.fecha_aplicacion DESC`,
      [req.params.cedula],
    );

    // Datos del paciente
    const pac = await db.query(
      `SELECT cedula, nombre, apellido, fecha_nacimiento,
              sexo, telefono, email, direccion
       FROM pacientes WHERE cedula = $1`,
      [req.params.cedula],
    );

    if (pac.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Paciente no encontrado." });

    return res.json({
      ok: true,
      paciente: pac.rows[0],
      historial: result.rows,
    });
  } catch (err) {
    console.error("[historial paciente]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

// ── GET /api/vacunas/vacunadores ────────────────────────────
// Record de todos los vacunadores del ASIC
async function vacunadores(req, res) {
  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.nombre || ' ' || u.apellido AS nombre,
         u.email,
         r.nombre AS rol,
         COUNT(va.id)                        AS total_vacunas,
         COUNT(DISTINCT va.paciente_id)      AS total_pacientes,
         MAX(va.fecha_aplicacion)            AS ultima_aplicacion,
         MIN(va.fecha_aplicacion)            AS primera_aplicacion
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN vacunas_aplicadas va ON va.usuario_id = u.id
       WHERE u.activo = true
       GROUP BY u.id, u.nombre, u.apellido, u.email, r.nombre
       ORDER BY total_vacunas DESC`,
    );

    // Detalle por tipo de vacuna por cada vacunador
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

    // Agrupar detalle por vacunador
    const detalleMap = {};
    detalle.rows.forEach((d) => {
      if (!detalleMap[d.usuario_id]) detalleMap[d.usuario_id] = [];
      detalleMap[d.usuario_id].push({
        vacuna: d.vacuna,
        cantidad: parseInt(d.cantidad),
      });
    });

    const vacunadoresConDetalle = result.rows.map((v) => ({
      ...v,
      total_vacunas: parseInt(v.total_vacunas),
      total_pacientes: parseInt(v.total_pacientes),
      detalle_vacunas: detalleMap[v.id] || [],
    }));

    return res.json({ ok: true, vacunadores: vacunadoresConDetalle });
  } catch (err) {
    console.error("[vacunadores]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

module.exports = { listar, obtener, registrar, historialPaciente, vacunadores };
