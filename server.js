require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");

const pool = require("./config/db");

const initDatabase = require("./initDatabase");

const app = express();

const PORT = process.env.PORT || 3001;

// CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "https://v-frontend-qgzd.onrender.com"],

    credentials: true,
  }),
);

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Rate limit login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 10,
});

app.use("/api/auth/login", loginLimiter);

// Rutas
app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,

    mensaje: "Servidor funcionando",
  });
});

// Test PostgreSQL
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      ok: true,

      serverTime: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,

      error: error.message,
    });
  }
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    ok: false,

    mensaje: "Ruta no encontrada",
  });
});

// Iniciar servidor
async function startServer() {
  try {
    // Inicializar schema.sql
    await initDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error iniciando servidor:");

    console.error(error);
  }
}

startServer();
