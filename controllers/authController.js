// controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// ── POST /api/auth/login ────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      mensaje: "El email y la contraseña son obligatorios.",
    });
  }

  try {
    // PostgreSQL usa $1 en lugar de ?
    const result = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.cedula,
              u.password_hash, u.activo, r.nombre AS rol
       FROM   usuarios u
       JOIN   roles r ON u.rol_id = r.id
       WHERE  u.email = $1
       LIMIT  1`,
      [email.trim().toLowerCase()],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ ok: false, mensaje: "Credenciales incorrectas." });
    }

    const usuario = result.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        ok: false,
        mensaje: "Cuenta desactivada. Contacte al administrador.",
      });
    }

    const passwordValida = await bcrypt.compare(
      password,
      usuario.password_hash,
    );
    if (!passwordValida) {
      return res
        .status(401)
        .json({ ok: false, mensaje: "Credenciales incorrectas." });
    }

    const payload = {
      id: usuario.id,
      nombre: `${usuario.nombre} ${usuario.apellido}`,
      email: usuario.email,
      cedula: usuario.cedula,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    // Guardar sesión
    const expiraEn = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO sesiones (usuario_id, token, ip_address, user_agent, expira_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        usuario.id,
        token,
        req.ip || null,
        req.headers["user-agent"] || null,
        expiraEn,
      ],
    );

    return res.json({
      ok: true,
      mensaje: `Bienvenido, ${usuario.nombre}`,
      token,
      usuario: {
        id: usuario.id,
        nombre: `${usuario.nombre} ${usuario.apellido}`,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

// ── POST /api/auth/logout ───────────────────────────────────
async function logout(req, res) {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (token) {
      await db.query("DELETE FROM sesiones WHERE token = $1", [token]);
    }
    return res.json({ ok: true, mensaje: "Sesión cerrada correctamente." });
  } catch (err) {
    console.error("[logout]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

// ── GET /api/auth/perfil ────────────────────────────────────
async function perfil(req, res) {
  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.cedula, u.email,
              r.nombre AS rol, u.creado_en
       FROM   usuarios u
       JOIN   roles r ON u.rol_id = r.id
       WHERE  u.id = $1`,
      [req.usuario.id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    return res.json({ ok: true, usuario: result.rows[0] });
  } catch (err) {
    console.error("[perfil]", err);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor." });
  }
}

module.exports = { login, logout, perfil };
