// controllers/usuariosController.js
const bcrypt = require("bcrypt");
const db = require("../config/db");

// ── GET /api/usuarios ───────────────────────────────────────
// Listar todos los usuarios (solo admin)
async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT
         u.id, u.nombre, u.apellido, u.cedula, u.email,
         u.activo, r.nombre AS rol, r.id AS rol_id,
         u.creado_en, u.actualizado_en
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       ORDER BY u.apellido, u.nombre`,
    );
    return res.json({
      ok: true,
      total: result.rows.length,
      usuarios: result.rows,
    });
  } catch (err) {
    console.error("[listar usuarios]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── GET /api/usuarios/:id ───────────────────────────────────
async function obtener(req, res) {
  try {
    const result = await db.query(
      `SELECT
         u.id, u.nombre, u.apellido, u.cedula, u.email,
         u.activo, r.nombre AS rol, r.id AS rol_id, u.creado_en
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Usuario no encontrado." });
    return res.json({ ok: true, usuario: result.rows[0] });
  } catch (err) {
    console.error("[obtener usuario]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── POST /api/usuarios ──────────────────────────────────────
// Crear nuevo usuario (solo admin)
async function crear(req, res) {
  const { nombre, apellido, cedula, email, password, rol_id } = req.body;

  if (!nombre || !apellido || !cedula || !email || !password) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "Todos los campos son obligatorios." });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "La contraseña debe tener al menos 8 caracteres.",
      });
  }

  try {
    // Verificar duplicados
    const existe = await db.query(
      "SELECT id FROM usuarios WHERE email = $1 OR cedula = $2",
      [email.trim().toLowerCase(), cedula.trim()],
    );
    if (existe.rows.length > 0) {
      return res
        .status(409)
        .json({
          ok: false,
          mensaje: "Ya existe un usuario con ese email o cédula.",
        });
    }

    const hash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );

    const result = await db.query(
      `INSERT INTO usuarios (nombre, apellido, cedula, email, password_hash, rol_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        nombre.trim(),
        apellido.trim(),
        cedula.trim(),
        email.trim().toLowerCase(),
        hash,
        rol_id || 2, // 2 = personal por defecto
      ],
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Usuario creado exitosamente.",
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error("[crear usuario]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── PUT /api/usuarios/:id ───────────────────────────────────
// Actualizar datos de un usuario (solo admin)
async function actualizar(req, res) {
  const { nombre, apellido, cedula, email, rol_id, activo, password } =
    req.body;
  const { id } = req.params;

  // No puede desactivarse a sí mismo
  if (String(id) === String(req.usuario.id) && activo === false) {
    return res
      .status(400)
      .json({ ok: false, mensaje: "No puede desactivar su propia cuenta." });
  }

  try {
    const existe = await db.query("SELECT id FROM usuarios WHERE id = $1", [
      id,
    ]);
    if (existe.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Usuario no encontrado." });

    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(
        password,
        parseInt(process.env.BCRYPT_ROUNDS) || 10,
      );
      await db.query(
        `UPDATE usuarios SET
           nombre=$1, apellido=$2, cedula=$3, email=$4,
           rol_id=$5, activo=$6, password_hash=$7,
           actualizado_en=NOW()
         WHERE id=$8`,
        [
          nombre,
          apellido,
          cedula,
          email.toLowerCase(),
          rol_id,
          activo ?? true,
          hash,
          id,
        ],
      );
    } else {
      await db.query(
        `UPDATE usuarios SET
           nombre=$1, apellido=$2, cedula=$3, email=$4,
           rol_id=$5, activo=$6, actualizado_en=NOW()
         WHERE id=$7`,
        [
          nombre,
          apellido,
          cedula,
          email.toLowerCase(),
          rol_id,
          activo ?? true,
          id,
        ],
      );
    }

    return res.json({
      ok: true,
      mensaje: "Usuario actualizado correctamente.",
    });
  } catch (err) {
    console.error("[actualizar usuario]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── PATCH /api/usuarios/:id/estado ─────────────────────────
// Activar o desactivar cuenta (solo admin)
async function cambiarEstado(req, res) {
  const { id } = req.params;
  const { activo } = req.body;

  if (String(id) === String(req.usuario.id)) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "No puede cambiar el estado de su propia cuenta.",
      });
  }

  try {
    await db.query(
      "UPDATE usuarios SET activo=$1, actualizado_en=NOW() WHERE id=$2",
      [activo ? true : false, id],
    );
    return res.json({
      ok: true,
      mensaje: activo ? "Usuario activado." : "Usuario desactivado.",
    });
  } catch (err) {
    console.error("[cambiar estado]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

// ── PUT /api/usuarios/perfil/cambiar-password ───────────────
// El usuario autenticado cambia su propia contraseña
async function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "La contraseña actual y la nueva son obligatorias.",
      });
  }
  if (password_nueva.length < 8) {
    return res
      .status(400)
      .json({
        ok: false,
        mensaje: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
  }

  try {
    const result = await db.query(
      "SELECT password_hash FROM usuarios WHERE id = $1",
      [req.usuario.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ ok: false, mensaje: "Usuario no encontrado." });

    const valida = await bcrypt.compare(
      password_actual,
      result.rows[0].password_hash,
    );
    if (!valida) {
      return res
        .status(401)
        .json({ ok: false, mensaje: "La contraseña actual es incorrecta." });
    }

    const hash = await bcrypt.hash(
      password_nueva,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );
    await db.query(
      "UPDATE usuarios SET password_hash=$1, actualizado_en=NOW() WHERE id=$2",
      [hash, req.usuario.id],
    );

    return res.json({
      ok: true,
      mensaje: "Contraseña actualizada correctamente.",
    });
  } catch (err) {
    console.error("[cambiar password]", err.message);
    return res
      .status(500)
      .json({
        ok: false,
        mensaje: "Error interno del servidor.",
        detalle: err.message,
      });
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  cambiarPassword,
};
