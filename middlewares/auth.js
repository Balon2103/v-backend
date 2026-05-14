// middlewares/auth.js
// Verificación de token JWT y control de roles

const jwt = require("jsonwebtoken");

// ── Verificar token ─────────────────────────────────────────
function verificarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token      = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      ok: false,
      mensaje: "Acceso denegado. Token no proporcionado.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario   = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      mensaje: "Token inválido o expirado. Inicie sesión nuevamente.",
    });
  }
}

// ── Solo administrador ──────────────────────────────────────
function soloAdmin(req, res, next) {
  if (req.usuario && req.usuario.rol === "administrador") {
    return next();
  }
  return res.status(403).json({
    ok: false,
    mensaje: "Acceso denegado. Se requiere rol de administrador.",
  });
}

module.exports = { verificarToken, soloAdmin };