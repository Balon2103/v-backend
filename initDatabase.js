const fs = require("fs");
const path = require("path");

const pool = require("./config/db");

async function initDatabase() {
  try {
    console.log("📦 Inicializando base de datos...");

    const schemaPath = path.join(__dirname, "schema.sql");

    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("✅ Base de datos inicializada");
  } catch (error) {
    console.error("❌ Error inicializando base de datos:", error);
  }
}

module.exports = initDatabase;
