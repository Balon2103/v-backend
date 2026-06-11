// routes/usuarios.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/usuariosController");
const { verificarToken, soloAdmin } = require("../middlewares/auth");

router.use(verificarToken);

// ── Ruta propia del usuario autenticado ────────────────────
// PUT  /api/usuarios/perfil/cambiar-password
router.put("/perfil/cambiar-password", ctrl.cambiarPassword);

// ── Rutas de administración (solo admin) ───────────────────
// GET    /api/usuarios
router.get("/", soloAdmin, ctrl.listar);

// GET    /api/usuarios/:id
router.get("/:id", soloAdmin, ctrl.obtener);

// POST   /api/usuarios
router.post("/", soloAdmin, ctrl.crear);

// PUT    /api/usuarios/:id
router.put("/:id", soloAdmin, ctrl.actualizar);

// PATCH  /api/usuarios/:id/estado
router.patch("/:id/estado", soloAdmin, ctrl.cambiarEstado);

module.exports = router;
