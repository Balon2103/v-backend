// controllers/dashboardController.js
const db = require("../config/db");

// ── GET /api/dashboard ──────────────────────────────────────
// Devuelve todos los datos que necesita el dashboard en una sola llamada
async function resumen(req, res) {
  try {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const desdeMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const hoyStr = hoy.toISOString().split("T")[0];

    // ── Ejecutar todas las consultas en paralelo ────────────
    const [
      vacunasMes,
      vacunasHoy,
      pacientes,
      stockCritico,
      reportesMes,
      actividadReciente,
      cobertura,
      usuariosActivos,
    ] = await Promise.all([
      // Total vacunas del mes actual
      db.query(
        `SELECT COUNT(*) AS total
         FROM vacunas_aplicadas
         WHERE fecha_aplicacion >= $1`,
        [desdeMes],
      ),

      // Total vacunas de hoy
      db.query(
        `SELECT COUNT(*) AS total
         FROM vacunas_aplicadas
         WHERE fecha_aplicacion = $1`,
        [hoyStr],
      ),

      // Total pacientes registrados
      db.query("SELECT COUNT(*) AS total FROM pacientes"),

      // Vacunas con stock crítico (bajo el mínimo)
      db.query(
        `SELECT COUNT(*) AS total
         FROM inventario
         WHERE stock_actual < stock_minimo`,
      ),

      // Reportes generados (movimientos de inventario del mes)
      db.query(
        `SELECT COUNT(*) AS total
         FROM movimientos_inventario
         WHERE fecha_movimiento >= $1`,
        [desdeMes],
      ),

      // Actividad reciente (últimas 5 acciones)
      db.query(
        `(SELECT
            'vacuna' AS tipo,
            CONCAT('Vacuna ', tv.nombre, ' aplicada · Paciente ', p.cedula) AS texto,
            va.creado_en AS fecha,
            'green' AS color
          FROM vacunas_aplicadas va
          JOIN tipos_vacuna tv ON va.tipo_vacuna_id = tv.id
          JOIN pacientes    p  ON va.paciente_id    = p.id
          ORDER BY va.creado_en DESC LIMIT 3)
         UNION ALL
         (SELECT
            'inventario' AS tipo,
            CONCAT(INITCAP(mi.tipo_movimiento), ' de lote · ', tv.nombre, ' (', mi.cantidad, ' dosis)') AS texto,
            mi.creado_en AS fecha,
            CASE WHEN mi.tipo_movimiento='entrada' THEN 'blue' ELSE 'red' END AS color
          FROM movimientos_inventario mi
          JOIN tipos_vacuna tv ON mi.tipo_vacuna_id = tv.id
          ORDER BY mi.creado_en DESC LIMIT 3)
         ORDER BY fecha DESC
         LIMIT 5`,
      ),

      // Cobertura por tipo de vacuna (% respecto al máximo aplicado)
      db.query(
        `SELECT
           tv.nombre AS vacuna,
           COUNT(va.id) AS total
         FROM tipos_vacuna tv
         LEFT JOIN vacunas_aplicadas va ON va.tipo_vacuna_id = tv.id
         GROUP BY tv.nombre
         ORDER BY total DESC`,
      ),

      // Usuarios activos
      db.query(`SELECT COUNT(*) AS total FROM usuarios WHERE activo = true`),
    ]);

    // Calcular % de cobertura relativo al máximo
    const maxCobertura = Math.max(
      ...cobertura.rows.map((r) => parseInt(r.total)),
      1,
    );
    const coberturaData = cobertura.rows.map((r) => ({
      vacuna: r.vacuna,
      total: parseInt(r.total),
      pct:
        maxCobertura > 0
          ? Math.round((parseInt(r.total) / maxCobertura) * 100)
          : 0,
    }));

    // Formatear actividad
    const actividad = actividadReciente.rows.map((r) => ({
      tipo: r.tipo,
      texto: r.texto,
      fecha: r.fecha,
      color: r.color,
      tiempo: tiempoRelativo(new Date(r.fecha)),
    }));

    return res.json({
      ok: true,
      stats: {
        vacunas_mes: parseInt(vacunasMes.rows[0]?.total || 0),
        vacunas_hoy: parseInt(vacunasHoy.rows[0]?.total || 0),
        pacientes: parseInt(pacientes.rows[0]?.total || 0),
        stock_critico: parseInt(stockCritico.rows[0]?.total || 0),
        reportes_mes: parseInt(reportesMes.rows[0]?.total || 0),
        usuarios_activos: parseInt(usuariosActivos.rows[0]?.total || 0),
      },
      actividad,
      cobertura: coberturaData,
    });
  } catch (err) {
    console.error("[dashboard]", err.message);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor.",
      detalle: err.message,
    });
  }
}

// Convierte una fecha a texto relativo ("hace 5 min", "hace 2h", etc.)
function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7)
    return `hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? "s" : ""}`;
  return new Date(fecha).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

module.exports = { resumen };
