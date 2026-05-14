// config/db.js
// Conexión PostgreSQL

const { Pool } = require("pg");

require("dotenv").config();

const isProduction = !!process.env.DATABASE_URL;

const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,

        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST || "localhost",

        port: parseInt(process.env.DB_PORT) || 5432,

        user: process.env.DB_USER || "postgres",

        password: process.env.DB_PASSWORD || "",

        database: process.env.DB_NAME || "db_vacunacion",
      }
);

// Verificar conexión
(async () => {
  try {
    const client = await pool.connect();

    console.log("✅ Conexión a PostgreSQL establecida.");

    client.release();
  } catch (error) {
    console.error(
      "❌ Error al conectar con PostgreSQL:"
    );

    console.error(error.message);

    process.exit(1);
  }
})();

module.exports = pool;