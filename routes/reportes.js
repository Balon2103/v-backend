// routes/reportes.js
const express            = require("express");
const router             = express.Router();
const ctrl               = require("../controllers/reportesController");
const { verificarToken } = require("../middlewares/auth");

router.use(verificarToken);

// GET /api/reportes/meses          → meses disponibles para el selector
router.get("/meses",       ctrl.mesesDisponibles);

// GET /api/reportes/vacunas        → vacunas aplicadas por período
// Query params: anio, mes, vacuna
router.get("/vacunas",     ctrl.vacunasPorPeriodo);

// GET /api/reportes/inventario     → movimientos de inventario
// Query params: periodo (mes|3meses|todos), vacuna, tipo (entrada|salida)
router.get("/inventario",  ctrl.movimientosInventario);

module.exports = router;