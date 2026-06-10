// controllers/reportes.controller.js
const db = require("../config/db"); // ← tu instancia de pg existente

/**
 * GET /api/reportes/vacunas/meses
 * Lista los últimos 12 meses con registros para poblar el <select>.
 */
const getMesesDisponibles = async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT DISTINCT
        TO_CHAR(fecha, 'YYYY-MM')                          AS value,
        INITCAP(TO_CHAR(fecha, 'TMMonth')) || ' ' ||
        TO_CHAR(fecha, 'YYYY')                             AS label
      FROM vacunas_aplicadas
      ORDER BY value DESC
      LIMIT 12
    `);
    return res.json({ ok: true, meses: resultado.rows });
  } catch (error) {
    console.error("[getMesesDisponibles]", error.message);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error al obtener los meses disponibles." });
  }
};

/**
 * GET /api/reportes/vacunas/tipos
 * Lista los tipos de vacuna registrados en el sistema.
 */
const getTiposVacuna = async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT id, nombre
      FROM vacunas
      ORDER BY nombre ASC
    `);
    return res.json({ ok: true, vacunas: resultado.rows });
  } catch (error) {
    console.error("[getTiposVacuna]", error.message);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error al obtener los tipos de vacuna." });
  }
};

/**
 * GET /api/reportes/vacunas?mes=2025-04&vacuna=BCG
 * Dosis aplicadas y pacientes atendidos agrupados por vacuna en un mes.
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

    const resultado = await db.query(
      `SELECT
         v.nombre                              AS vacuna,
         COALESCE(SUM(va.dosis), 0)::int       AS dosis,
         COUNT(DISTINCT va.paciente_id)::int   AS pacientes
       FROM vacunas_aplicadas va
       JOIN vacunas v ON v.id = va.vacuna_id
       WHERE TO_CHAR(va.fecha, 'YYYY-MM') = $1
         AND ($2::text IS NULL OR v.nombre = $2)
       GROUP BY v.nombre
       ORDER BY dosis DESC`,
      [mes, vacuna || null],
    );

    return res.json({ ok: true, mes, datos: resultado.rows });
  } catch (error) {
    console.error("[getVacunasPorMes]", error.message);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error al obtener los datos de vacunas." });
  }
};

/**
 * GET /api/reportes/inventario?periodo=mes&vacuna=BCG&tipo=entrada
 *
 * periodo: "mes"    → mes en curso
 *          "3meses" → últimos 3 meses
 *          "todos"  → sin filtro de fecha
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

    // Calcular fecha de corte
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

    const resultado = await db.query(
      `SELECT
         mi.id,
         v.nombre          AS vacuna,
         mi.tipo,
         mi.cantidad,
         mi.lote,
         mi.fecha::text    AS fecha
       FROM movimientos_inventario mi
       JOIN vacunas v ON v.id = mi.vacuna_id
       WHERE ($1::date IS NULL OR mi.fecha >= $1)
         AND ($2::text  IS NULL OR v.nombre  = $2)
         AND ($3::text  IS NULL OR mi.tipo   = $3)
       ORDER BY mi.fecha DESC`,
      [fechaDesde, vacuna || null, tipo || null],
    );

    const rows = resultado.rows;

    // Resumen calculado en el servidor (el frontend lo usa directamente)
    const entradas = rows
      .filter((r) => r.tipo === "entrada")
      .reduce((a, r) => a + r.cantidad, 0);
    const salidas = rows
      .filter((r) => r.tipo === "salida")
      .reduce((a, r) => a + r.cantidad, 0);

    return res.json({
      ok: true,
      periodo,
      resumen: { entradas, salidas, balance: entradas - salidas },
      datos: rows,
    });
  } catch (error) {
    console.error("[getMovimientosInventario]", error.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error al obtener los movimientos de inventario.",
      });
  }
};

module.exports = {
  getMesesDisponibles,
  getTiposVacuna,
  getVacunasPorMes,
  getMovimientosInventario,
};
