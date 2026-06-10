// routes/inventario.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/inventarioController");
const { verificarToken, soloAdmin } = require("../middlewares/auth");

// Todas las rutas requieren token
router.use(verificarToken);

// GET  /api/inventario              → stock actual de todas las vacunas
router.get("/", ctrl.listar);

// GET  /api/inventario/resumen      → estadísticas generales
router.get("/resumen", ctrl.resumen);

// GET  /api/inventario/alertas      → vacunas con stock crítico/bajo
router.get("/alertas", ctrl.alertas);

// GET  /api/inventario/movimientos  → historial con paginación
router.get("/movimientos", ctrl.movimientos);

// POST /api/inventario/entrada      → registrar entrada de lote
router.post("/entrada", ctrl.registrarEntrada);

// PATCH /api/inventario/:id/minimo  → actualizar stock mínimo (solo admin)
router.patch("/:id/minimo", soloAdmin, ctrl.actualizarMinimo);

module.exports = router;
