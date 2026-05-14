require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./config/db");

async function crearAdmin() {
  try {
    console.log("👤 Creando administrador...");

    const password = "Admin123!";

    const hash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS) || 10
    );

    // obtener rol
    const rol = await db.query(
      "SELECT id FROM roles WHERE nombre = $1",
      ["administrador"]
    );

    if (rol.rows.length === 0) {
      throw new Error("Rol administrador no existe");
    }

    const rol_id = rol.rows[0].id;

    // verificar si existe
    const exists = await db.query(
      "SELECT id FROM usuarios WHERE email = $1",
      ["admin@asic.gob.ve"]
    );

    if (exists.rows.length > 0) {
      console.log("⚠️ Admin ya existe, no se creó nuevamente");
      return;
    }

    await db.query(
      `INSERT INTO usuarios
      (nombre, apellido, cedula, email, password_hash, rol_id)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        "Coordinador",
        "ASIC",
        "V-00000001",
        "admin@asic.gob.ve",
        hash,
        rol_id,
      ]
    );

    console.log("✅ Usuario administrador creado");
    console.log("📧 admin@asic.gob.ve");
    console.log("🔑 Admin123!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    process.exit();
  }
}

crearAdmin();