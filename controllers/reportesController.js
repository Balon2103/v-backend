// controllers/reportesController.js
const db = require("../config/db");

// ── Helpers ─────────────────────────────────────────────────
function primerDiaDelMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}
function ultimoDiaDelMes(anio, mes) {
  const d = new Date(anio, mes, 0); // día 0 del mes siguiente = último día del mes actual
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── GET /api/reportes/vacunas ───────────────────────────────
// Vacunas aplicadas por período con agrupación por tipo
async function vacunasPorPeriodo(req, res) {
  try {
    const { anio, mes, vacuna } = req.query;

    // Período por defecto: mes actual
    const hoy = new Date();
    const anioNum = parseInt(anio) || hoy.getFullYear();
    const mesNum = parseInt(mes) || hoy.getMonth() + 1;
    const desde = primerDiaDelMes(anioNum, mesNum);
    const hasta = ultimoDiaDelMes(anioNum, mesNum);

    let where = "WHERE va.fecha_aplicacion BETWEEN $1 AND $2";
    const params = [desde, hasta];
    let idx = 3;

    if (vacuna) {
      where += ` AND tv.nombre = $${idx++}`;
      params.push(vacuna);
    }

    // Agrupado por tipo de vacuna
    const porVacuna = await db.query(
      `SELECT
         tv.nombre                          AS vacuna,
         COUNT(va.id)                       AS dosis,
         COUNT(DISTINCT va.paciente_id)     AS pacientes
       FROM vacunas_aplicadas va
       JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
       ${where}
       GROUP BY tv.nombre
       ORDER BY dosis DESC`,
      params,
    );

    // Totales generales del período
    const totales = await db.query(
      `SELECT
         COUNT(va.id)                   AS total_dosis,
         COUNT(DISTINCT va.paciente_id) AS total_pacientes
       FROM vacunas_aplicadas va
       ${where}`,
      params,
    );

    // Agrupado por día (para gráfica de tendencia)
    const porDia = await db.query(
      `SELECT
         va.fecha_aplicacion::date       AS fecha,
         COUNT(va.id)                    AS dosis
       FROM vacunas_aplicadas va
       ${where}
       GROUP BY va.fecha_aplicacion::date
       ORDER BY fecha ASC`,
      params,
    );

    return res.json({
      ok: true,
      periodo: {
        anio: anioNum,
        mes: mesNum,
        desde,
        hasta,
      },
      resumen: {
        total_dosis: parseInt(totales.rows[0]?.total_dosis || 0),
        total_pacientes: parseInt(totales.rows[0]?.total_pacientes || 0),
        tipos_vacuna: porVacuna.rows.length,
      },
      por_vacuna: porVacuna.rows.map((r) => ({
        vacuna: r.vacuna,
        dosis: parseInt(r.dosis),
        pacientes: parseInt(r.pacientes),
      })),
      por_dia: porDia.rows.map((r) => ({
        fecha: r.fecha,
        dosis: parseInt(r.dosis),
      })),
    });
  } catch (err) {
    console.error("[reporte vacunas]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── GET /api/reportes/inventario ────────────────────────────
// Movimientos de inventario por período
async function movimientosInventario(req, res) {
  try {
    const { periodo, vacuna, tipo } = req.query;

    // Calcular fechas según período
    const hoy = new Date();
    let desde, hasta;

    hasta = hoy.toISOString().split("T")[0];

    if (periodo === "3meses") {
      const d = new Date(hoy);
      d.setMonth(d.getMonth() - 3);
      desde = d.toISOString().split("T")[0];
    } else if (periodo === "todos") {
      desde = "2000-01-01";
    } else {
      // mes por defecto
      desde = primerDiaDelMes(hoy.getFullYear(), hoy.getMonth() + 1);
    }

    let where = "WHERE mi.fecha_movimiento BETWEEN $1 AND $2";
    const params = [desde, hasta];
    let idx = 3;

    if (vacuna) {
      where += ` AND tv.nombre = $${idx++}`;
      params.push(vacuna);
    }
    if (tipo) {
      where += ` AND mi.tipo_movimiento = $${idx++}`;
      params.push(tipo);
    }

    // Totales entradas y salidas
    const totales = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN mi.tipo_movimiento='entrada' THEN mi.cantidad ELSE 0 END),0) AS entradas,
         COALESCE(SUM(CASE WHEN mi.tipo_movimiento='salida'  THEN mi.cantidad ELSE 0 END),0) AS salidas
       FROM movimientos_inventario mi
       JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
       ${where}`,
      params,
    );

    // Detalle de movimientos
    const detalle = await db.query(
      `SELECT
         mi.id,
         tv.nombre            AS vacuna,
         mi.tipo_movimiento   AS tipo,
         mi.cantidad,
         mi.lote,
         mi.fecha_movimiento  AS fecha,
         mi.vencimiento,
         u.nombre || ' ' || u.apellido AS responsable
       FROM movimientos_inventario mi
       JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
       JOIN usuarios     u  ON mi.usuario_id     = u.id
       ${where}
       ORDER BY mi.fecha_movimiento DESC, mi.creado_en DESC`,
      params,
    );

    // Agrupado por vacuna (para gráfica)
    const porVacuna = await db.query(
      `SELECT
         tv.nombre          AS vacuna,
         mi.tipo_movimiento AS tipo,
         SUM(mi.cantidad)   AS cantidad
       FROM movimientos_inventario mi
       JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
       ${where}
       GROUP BY tv.nombre, mi.tipo_movimiento
       ORDER BY tv.nombre`,
      params,
    );

    const entradas = parseInt(totales.rows[0]?.entradas || 0);
    const salidas = parseInt(totales.rows[0]?.salidas || 0);

    return res.json({
      ok: true,
      periodo: { desde, hasta, tipo_periodo: periodo || "mes" },
      resumen: {
        entradas,
        salidas,
        balance: entradas - salidas,
      },
      movimientos: detalle.rows,
      por_vacuna: porVacuna.rows.map((r) => ({
        vacuna: r.vacuna,
        tipo: r.tipo,
        cantidad: parseInt(r.cantidad),
      })),
    });
  } catch (err) {
    console.error("[reporte inventario]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// ── GET /api/reportes/meses ─────────────────────────────────
// Lista de meses disponibles con datos para el selector
async function mesesDisponibles(req, res) {
  try {
    const result = await db.query(
      `SELECT DISTINCT
         EXTRACT(YEAR  FROM fecha_aplicacion)::int AS anio,
         EXTRACT(MONTH FROM fecha_aplicacion)::int AS mes,
         COUNT(*) AS total
       FROM vacunas_aplicadas
       GROUP BY anio, mes
       ORDER BY anio DESC, mes DESC
       LIMIT 24`,
    );

    const NOMBRES_MES = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    const meses = result.rows.map((r) => ({
      value: `${r.anio}-${String(r.mes).padStart(2, "0")}`,
      label: `${NOMBRES_MES[r.mes]} ${r.anio}`,
      anio: r.anio,
      mes: r.mes,
      total: parseInt(r.total),
    }));

    // Agregar mes actual si no tiene datos
    const hoy = new Date();
    const valorHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const labelHoy = `${NOMBRES_MES[hoy.getMonth() + 1]} ${hoy.getFullYear()}`;
    if (!meses.find((m) => m.value === valorHoy)) {
      meses.unshift({
        value: valorHoy,
        label: labelHoy,
        anio: hoy.getFullYear(),
        mes: hoy.getMonth() + 1,
        total: 0,
      });
    }

    return res.json({ ok: true, meses });
  } catch (err) {
    console.error("[meses disponibles]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

module.exports = { vacunasPorPeriodo, movimientosInventario, mesesDisponibles };
