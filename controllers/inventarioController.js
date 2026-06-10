// controllers/inventarioController.js
const db = require("../config/db");

// ── GET /api/inventario ─────────────────────────────────────
// Stock actual de todas las vacunas
async function listar(req, res) {
  try {
    const { busqueda } = req.query;

    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;

    if (busqueda) {
      where += ` AND tv.nombre ILIKE $${idx++}`;
      params.push(`%${busqueda}%`);
    }

    const result = await db.query(
      `SELECT
         i.id,
         tv.id            AS tipo_vacuna_id,
         tv.nombre        AS vacuna,
         i.stock_actual,
         i.stock_minimo,
         i.actualizado_en,
         -- Último movimiento de entrada
         (SELECT mi.lote
          FROM movimientos_inventario mi
          WHERE mi.tipo_vacuna_id = tv.id AND mi.tipo_movimiento = 'entrada'
          ORDER BY mi.creado_en DESC LIMIT 1) AS ultimo_lote,
         (SELECT mi.fecha_movimiento
          FROM movimientos_inventario mi
          WHERE mi.tipo_vacuna_id = tv.id AND mi.tipo_movimiento = 'entrada'
          ORDER BY mi.creado_en DESC LIMIT 1) AS ultima_entrada,
         -- Vencimiento del último lote
         (SELECT mi.vencimiento
          FROM movimientos_inventario mi
          WHERE mi.tipo_vacuna_id = tv.id AND mi.tipo_movimiento = 'entrada'
          ORDER BY mi.creado_en DESC LIMIT 1) AS vencimiento
       FROM inventario i
       JOIN tipos_vacuna tv ON i.tipo_vacuna_id = tv.id
       ${where}
       ORDER BY
         CASE WHEN i.stock_actual < i.stock_minimo THEN 0 ELSE 1 END,
         tv.nombre`,
      params,
    );

    return res.json({ ok: true, inventario: result.rows });
  } catch (err) {
    console.error("[listar inventario]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── GET /api/inventario/movimientos ─────────────────────────
// Historial de movimientos con paginación y filtros
async function movimientos(req, res) {
  try {
    const { vacuna, tipo, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;

    if (vacuna) {
      where += ` AND tv.nombre = $${idx++}`;
      params.push(vacuna);
    }
    if (tipo) {
      where += ` AND mi.tipo_movimiento = $${idx++}`;
      params.push(tipo);
    }

    // Total
    const countResult = await db.query(
      `SELECT COUNT(*)
       FROM movimientos_inventario mi
       JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
       ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    // Datos
    const result = await db.query(
      `SELECT
         mi.id,
         tv.nombre          AS vacuna,
         mi.tipo_movimiento AS tipo,
         mi.cantidad,
         mi.lote,
         mi.fecha_movimiento AS fecha,
         mi.vencimiento,
         mi.observaciones,
         u.nombre || ' ' || u.apellido AS responsable,
         mi.creado_en
       FROM movimientos_inventario mi
       JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON mi.usuario_id     = u.id
       ${where}
       ORDER BY mi.creado_en DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset],
    );

    return res.json({
      ok: true,
      total,
      pagina: parseInt(page),
      limite: parseInt(limit),
      movimientos: result.rows,
    });
  } catch (err) {
    console.error("[movimientos inventario]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── POST /api/inventario/entrada ────────────────────────────
// Registrar entrada de nuevo lote
async function registrarEntrada(req, res) {
  console.log("[registrar entrada] body:", JSON.stringify(req.body));

  const {
    tipo_vacuna_id,
    lote,
    cantidad,
    fecha_entrada,
    vencimiento,
    observaciones,
  } = req.body;

  // Validaciones
  if (!tipo_vacuna_id) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "Seleccione el tipo de vacuna." });
  }
  if (!lote || !lote.trim()) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "El número de lote es obligatorio." });
  }
  if (!cantidad || isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "La cantidad debe ser un número mayor a 0.",
      });
  }
  if (!fecha_entrada) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "La fecha de entrada es obligatoria." });
  }

  const cantidadNum = parseInt(cantidad);

  // Verificar que el tipo de vacuna existe
  const tipoCheck = await db.query(
    "SELECT id, nombre FROM tipos_vacuna WHERE id = $1",
    [parseInt(tipo_vacuna_id)],
  );
  if (tipoCheck.rows.length === 0) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "El tipo de vacuna no existe." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Registrar el movimiento
    await client.query(
      `INSERT INTO movimientos_inventario
         (tipo_vacuna_id, usuario_id, tipo_movimiento, cantidad, lote,
          fecha_movimiento, vencimiento, observaciones)
       VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7)`,
      [
        parseInt(tipo_vacuna_id),
        req.usuario.id,
        cantidadNum,
        lote.trim(),
        fecha_entrada,
        vencimiento || null,
        observaciones || null,
      ],
    );

    // Actualizar stock en inventario
    const invResult = await client.query(
      `UPDATE inventario SET
         stock_actual   = stock_actual + $1,
         actualizado_en = NOW()
       WHERE tipo_vacuna_id = $2
       RETURNING stock_actual`,
      [cantidadNum, parseInt(tipo_vacuna_id)],
    );

    // Si no existe registro en inventario, crearlo
    if (invResult.rowCount === 0) {
      await client.query(
        `INSERT INTO inventario (tipo_vacuna_id, stock_actual, stock_minimo)
         VALUES ($1,$2,10)`,
        [parseInt(tipo_vacuna_id), cantidadNum],
      );
    }

    await client.query("COMMIT");

    const stockNuevo = invResult.rows[0]?.stock_actual || cantidadNum;

    return res.status(201).json({
      ok: true,
      mensaje: `Entrada registrada. Stock actualizado a ${stockNuevo} dosis.`,
      stock_actual: stockNuevo,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[registrar entrada] ERROR:", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  } finally {
    client.release();
  }
}

// ── PATCH /api/inventario/:id/minimo ───────────────────────
// Actualizar stock mínimo de una vacuna
async function actualizarMinimo(req, res) {
  const { stock_minimo } = req.body;
  const { id } = req.params;

  if (
    !stock_minimo ||
    isNaN(parseInt(stock_minimo)) ||
    parseInt(stock_minimo) < 0
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: "El stock mínimo debe ser un número mayor o igual a 0.",
    });
  }

  try {
    const result = await db.query(
      `UPDATE inventario SET stock_minimo = $1 WHERE id = $2 RETURNING *`,
      [parseInt(stock_minimo), parseInt(id)],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Registro de inventario no encontrado." });
    }

    return res.json({
      ok: true,
      mensaje: "Stock mínimo actualizado.",
      inventario: result.rows[0],
    });
  } catch (err) {
    console.error("[actualizar minimo]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── GET /api/inventario/alertas ─────────────────────────────
// Vacunas con stock crítico o bajo
async function alertas(req, res) {
  try {
    const result = await db.query(
      `SELECT
         tv.nombre AS vacuna,
         i.stock_actual,
         i.stock_minimo,
         CASE
           WHEN i.stock_actual = 0          THEN 'sin_stock'
           WHEN i.stock_actual < i.stock_minimo THEN 'critico'
           WHEN i.stock_actual < i.stock_minimo * 1.5 THEN 'bajo'
           ELSE 'ok'
         END AS estado
       FROM inventario i
       JOIN tipos_vacuna tv ON i.tipo_vacuna_id = tv.id
       WHERE i.stock_actual < i.stock_minimo * 1.5
       ORDER BY i.stock_actual ASC`,
    );

    return res.json({ ok: true, alertas: result.rows });
  } catch (err) {
    console.error("[alertas inventario]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── GET /api/inventario/resumen ─────────────────────────────
// Estadísticas generales del inventario
async function resumen(req, res) {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*)                                       AS total_tipos,
         SUM(i.stock_actual)                            AS total_dosis,
         COUNT(*) FILTER (WHERE i.stock_actual < i.stock_minimo)       AS criticos,
         COUNT(*) FILTER (WHERE i.stock_actual >= i.stock_minimo * 1.5) AS en_buen_estado
       FROM inventario i`,
    );

    return res.json({ ok: true, resumen: result.rows[0] });
  } catch (err) {
    console.error("[resumen inventario]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

module.exports = {
  listar,
  movimientos,
  registrarEntrada,
  actualizarMinimo,
  alertas,
  resumen,
};
