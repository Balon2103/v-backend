require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");

const authRoutes = require("./routes/auth");

const pool = require("./config/db");
const initDatabase = require("./initDatabase");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://v-frontend-qgzd.onrender.com"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ───────────────────────────────
// RATE LIMIT LOGIN
// ───────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.use("/api/auth/login", loginLimiter);

// ───────────────────────────────
// ROUTES
// ───────────────────────────────
app.use("/api/auth", authRoutes);

// ───────────────────────────────
// HEALTH CHECK
// ───────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Servidor funcionando",
  });
});

// ───────────────────────────────
// TEST POSTGRESQL
// ───────────────────────────────
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

// ───────────────────────────────
// 404
// ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: "Ruta no encontrada",
  });
});

// ───────────────────────────────
// CREAR ADMIN AUTOMÁTICO
// ───────────────────────────────
async function createAdminIfNotExists() {
  try {
    console.log("👤 Verificando administrador...");

    const email = "admin@asic.gob.ve";

    const exists = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email],
    );

    if (exists.rows.length > 0) {
      console.log("⚠️ Admin ya existe");
      return;
    }

    const password = "Admin123!";
    const hash = await bcrypt.hash(password, 10);

    const rol = await pool.query("SELECT id FROM roles WHERE nombre = $1", [
      "administrador",
    ]);

    if (rol.rows.length === 0) {
      throw new Error("Rol administrador no existe");
    }

    const rol_id = rol.rows[0].id;

    await pool.query(
      `INSERT INTO usuarios
      (nombre, apellido, cedula, email, password_hash, rol_id)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      ["Coordinador", "ASIC", "V-00000001", email, hash, rol_id],
    );

    console.log("✅ Admin creado correctamente");
  } catch (error) {
    console.error("❌ Error creando admin:", error.message);
  }
}

// ───────────────────────────────
// INICIAR SERVIDOR
// ───────────────────────────────
async function startServer() {
  try {
    await initDatabase();
    await createAdminIfNotExists();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📌 Entorno: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
  }
}

startServer();
