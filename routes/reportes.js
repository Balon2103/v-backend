// routes/reportes.routes.js
const { Router } = require("express");
const {
  getVacunasPorMes,
  getMovimientosInventario,
  getMesesDisponibles,
  getTiposVacuna,
} = require("../controllers/reportesController");
const { verificarToken, soloAdmin } = require("../middlewares/auth"); // ← tus nombres reales

const router = Router();

// Todas las rutas de reportes requieren sesión activa
router.use(verificarToken);

/**
 * GET /api/reportes/vacunas/meses
 * Lista los meses disponibles para el selector.
 */
router.get("/vacunas/meses", getMesesDisponibles);

/**
 * GET /api/reportes/vacunas/tipos
 * Lista los tipos de vacuna para el selector.
 */
router.get("/vacunas/tipos", getTiposVacuna);

/**
 * GET /api/reportes/vacunas?mes=2025-04&vacuna=BCG
 * Dosis aplicadas por vacuna en un período.
 * Accesible para todos los roles autenticados.
 */
router.get("/vacunas", getVacunasPorMes);

/**
 * GET /api/reportes/inventario?periodo=mes&vacuna=BCG&tipo=entrada
 * Movimientos de inventario con filtros opcionales.
 * Restringido a administrador (soloAdmin del middleware existente).
 * Si quieres que enfermeros también accedan, quita soloAdmin.
 */
router.get("/inventario", soloAdmin, getMovimientosInventario);

module.exports = router;