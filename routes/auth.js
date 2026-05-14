// routes/auth.js
const express            = require("express");
const router             = express.Router();
const { login, logout, perfil } = require("../controllers/authController");
const { verificarToken } = require("../middlewares/auth");

// POST /api/auth/login   → iniciar sesión (público)
router.post("/login",  login);

// POST /api/auth/logout  → cerrar sesión (requiere token)
router.post("/logout", verificarToken, logout);

// GET  /api/auth/perfil  → datos del usuario autenticado
router.get("/perfil",  verificarToken, perfil);

module.exports = router;