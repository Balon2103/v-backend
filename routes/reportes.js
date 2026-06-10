// routes/reportes.routes.js
const { Router } = require("express");
const {
  getVacunasPorMes,
  getMovimientosInventario,
  getMesesDisponibles,
  getTiposVacuna,
} = require("../controllers/reportesController");
const { verifyToken, checkRol } = require("../middlewares/auth");

const router = Router();

// Todas las rutas de reportes requieren sesión activa
router.use(verifyToken);

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
 */
router.get("/vacunas", getVacunasPorMes);

/**
 * GET /api/reportes/inventario?periodo=mes&vacuna=BCG&tipo=entrada
 * Movimientos de inventario con filtros opcionales.
 * Solo accesible para admin y enfermero jefe.
 */
router.get(
  "/inventario",
  checkRol("admin", "enfermero_jefe"),
  getMovimientosInventario,
);

module.exports = router;
