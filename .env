// config/db.js
// Conexión a PostgreSQL usando pool de conexiones

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        // Render provee DATABASE_URL automáticamente en producción
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // requerido por Render
      }
    : {
        // Desarrollo local con variables individuales
        host:     process.env.DB_HOST     || "localhost",
        port:     parseInt(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER     || "postgres",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME     || "db_vacunacion",
      }
);

// Verificar conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌  Error al conectar con PostgreSQL:", err.message);
    console.error("    Verifica las credenciales en el archivo .env");
    process.exit(1);
  }
  release();
  console.log("✅  Conexión a PostgreSQL establecida.");
});

module.exports = pool;