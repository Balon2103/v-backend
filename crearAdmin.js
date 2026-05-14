// crearAdmin.js
// Ejecutar UNA SOLA VEZ para crear el usuario administrador
// Comando: node crearAdmin.js

require("dotenv").config();
const bcrypt = require("bcrypt");
const db     = require("./config/db");

async function crearAdmin() {
  try {
    const password = "Admin123!";
    const hash     = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    // Eliminar si ya existe
    await db.query("DELETE FROM usuarios WHERE email = $1", ["admin@asic.gob.ve"]);

    // Insertar admin
    await db.query(
      `INSERT INTO usuarios (nombre, apellido, cedula, email, password_hash, rol_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["Coordinador", "ASIC", "V-00000001", "admin@asic.gob.ve", hash, 1]
    );

    console.log("✅  Usuario administrador creado.");
    console.log("    Email:      admin@asic.gob.ve");
    console.log("    Contraseña: Admin123");
    console.log("    ⚠️  Cambia la contraseña al ingresar por primera vez.\n");

  } catch (err) {
    console.error("❌  Error:", err.message);
  } finally {
    process.exit(0);
  }
}

crearAdmin();