// routes/vacunas.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vacunasController");
const { verificarToken } = require("../middlewares/auth");

// Todas las rutas requieren token
router.use(verificarToken);

// GET  /api/vacunas                      → listar con paginación y filtros
router.get("/", ctrl.listar);

// GET  /api/vacunas/vacunadores          → record de vacunadores
router.get("/vacunadores", ctrl.vacunadores);

// GET  /api/vacunas/paciente/:cedula     → historial de un paciente
router.get("/paciente/:cedula", ctrl.historialPaciente);

// GET  /api/vacunas/:id                  → detalle de un registro
router.get("/:id", ctrl.obtener);

// POST /api/vacunas                      → registrar nueva vacuna
router.post("/", ctrl.registrar);

module.exports = router;
