// controllers/reportes.controller.js

/**
 * GET /api/reportes/vacunas?mes=2025-04&vacuna=BCG
 * Devuelve las dosis aplicadas por vacuna en un mes dado.
 * Filtro opcional por tipo de vacuna.
 */
const getVacunasPorMes = async (req, res) => {
  try {
    const { mes, vacuna } = req.query;

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'El parámetro "mes" es obligatorio y debe tener formato YYYY-MM.',
      });
    }

    // ── Construcción de la query ──────────────────────────────
    // Ajusta los nombres de tabla/columna a tu ORM o driver.
    // Ejemplo con pg (node-postgres) o Sequelize raw query:
    //
    // SELECT
    //   v.nombre        AS vacuna,
    //   SUM(a.dosis)    AS dosis,
    //   COUNT(DISTINCT a.paciente_id) AS pacientes
    // FROM aplicaciones a
    // JOIN vacunas v ON v.id = a.vacuna_id
    // WHERE TO_CHAR(a.fecha, 'YYYY-MM') = $1
    //   AND ($2::text IS NULL OR v.nombre = $2)
    // GROUP BY v.nombre
    // ORDER BY dosis DESC;

    // — Reemplaza esto con tu llamada real a la BD —
    const datos = await db.query(
      `SELECT
         v.nombre                        AS vacuna,
         SUM(a.dosis)::int               AS dosis,
         COUNT(DISTINCT a.paciente_id)::int AS pacientes
       FROM aplicaciones a
       JOIN vacunas v ON v.id = a.vacuna_id
       WHERE TO_CHAR(a.fecha, 'YYYY-MM') = $1
         AND ($2::text IS NULL OR v.nombre = $2)
       GROUP BY v.nombre
       ORDER BY dosis DESC`,
      [mes, vacuna || null],
    );

    return res.json({ ok: true, mes, datos: datos.rows });
  } catch (error) {
    console.error("[getVacunasPorMes]", error);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
};

/**
 * GET /api/reportes/inventario?periodo=mes&vacuna=BCG&tipo=entrada
 *
 * periodo: "mes"    → solo el mes en curso (fecha >= primer día del mes actual)
 *          "3meses" → últimos 3 meses
 *          "todos"  → sin filtro de fecha
 *
 * vacuna: nombre exacto de la vacuna (opcional)
 * tipo:   "entrada" | "salida"       (opcional)
 */
const getMovimientosInventario = async (req, res) => {
  try {
    const { periodo = "mes", vacuna, tipo } = req.query;

    // Validaciones
    if (!["mes", "3meses", "todos"].includes(periodo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El parámetro "periodo" debe ser "mes", "3meses" o "todos".',
      });
    }
    if (tipo && !["entrada", "salida"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El parámetro "tipo" debe ser "entrada" o "salida".',
      });
    }

    // Rango de fechas según período
    let fechaDesde = null;
    const hoy = new Date();

    if (periodo === "mes") {
      fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        .toISOString()
        .split("T")[0];
    } else if (periodo === "3meses") {
      const hace3 = new Date(hoy);
      hace3.setMonth(hace3.getMonth() - 3);
      fechaDesde = hace3.toISOString().split("T")[0];
    }

    // — Reemplaza esto con tu llamada real a la BD —
    const movimientos = await db.query(
      `SELECT
         m.id,
         v.nombre  AS vacuna,
         m.tipo,
         m.cantidad,
         m.lote,
         m.fecha::text AS fecha
       FROM movimientos_inventario m
       JOIN vacunas v ON v.id = m.vacuna_id
       WHERE ($1::date IS NULL OR m.fecha >= $1)
         AND ($2::text IS NULL OR v.nombre  = $2)
         AND ($3::text IS NULL OR m.tipo    = $3)
       ORDER BY m.fecha DESC`,
      [fechaDesde, vacuna || null, tipo || null],
    );

    // Resumen de entradas / salidas
    const rows = movimientos.rows;
    const entradas = rows
      .filter((r) => r.tipo === "entrada")
      .reduce((acc, r) => acc + r.cantidad, 0);
    const salidas = rows
      .filter((r) => r.tipo === "salida")
      .reduce((acc, r) => acc + r.cantidad, 0);

    return res.json({
      ok: true,
      periodo,
      resumen: { entradas, salidas, balance: entradas - salidas },
      datos: rows,
    });
  } catch (error) {
    console.error("[getMovimientosInventario]", error);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
};

/**
 * GET /api/reportes/vacunas/meses
 * Lista los meses disponibles (para poblar el <select> del frontend).
 * Devuelve hasta los últimos 12 meses con registros.
 */
const getMesesDisponibles = async (req, res) => {
  try {
    // — Reemplaza esto con tu llamada real a la BD —
    const resultado = await db.query(
      `SELECT DISTINCT
         TO_CHAR(fecha, 'YYYY-MM') AS value,
         TO_CHAR(fecha, 'TMMonth YYYY') AS label
       FROM aplicaciones
       ORDER BY value DESC
       LIMIT 12`,
    );

    return res.json({ ok: true, meses: resultado.rows });
  } catch (error) {
    console.error("[getMesesDisponibles]", error);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
};

/**
 * GET /api/reportes/vacunas/tipos
 * Lista los tipos de vacuna registrados en el sistema.
 */
const getTiposVacuna = async (req, res) => {
  try {
    // — Reemplaza esto con tu llamada real a la BD —
    const resultado = await db.query(
      `SELECT id, nombre FROM vacunas ORDER BY nombre ASC`,
    );

    return res.json({ ok: true, vacunas: resultado.rows });
  } catch (error) {
    console.error("[getTiposVacuna]", error);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
};

module.exports = {
  getVacunasPorMes,
  getMovimientosInventario,
  getMesesDisponibles,
  getTiposVacuna,
};
