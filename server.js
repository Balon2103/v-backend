// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth");
const vacunasRoutes = require("./routes/vacunas");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Migración automática de columnas faltantes ──────────────
// Se ejecuta UNA SOLA VEZ al iniciar. Si la columna ya existe,
// PostgreSQL lo ignora gracias a IF NOT EXISTS.
async function ejecutarMigraciones() {
  const db = require("./config/db");

  const migraciones = [
    // Tabla pacientes — columnas nuevas
    {
      nombre: "pacientes.email",
      sql: `ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL`,
    },
    {
      nombre: "pacientes.direccion",
      sql: `ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS direccion TEXT DEFAULT NULL`,
    },

    // Por si acaso faltan otras columnas en vacunas_aplicadas
    {
      nombre: "vacunas_aplicadas.observaciones",
      sql: `ALTER TABLE vacunas_aplicadas ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL`,
    },

    // Por si acaso faltan columnas en movimientos_inventario
    {
      nombre: "movimientos_inventario.vencimiento",
      sql: `ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS vencimiento DATE DEFAULT NULL`,
    },
    {
      nombre: "movimientos_inventario.observaciones",
      sql: `ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL`,
    },
  ];

  console.log("\n🔄  Verificando migraciones de base de datos...");

  for (const m of migraciones) {
    try {
      await db.query(m.sql);
      console.log(`   ✅  ${m.nombre} — OK`);
    } catch (err) {
      // Si falla por otra razón que no sea "ya existe", lo reportamos
      // pero NO detenemos el servidor
      console.warn(`   ⚠️  ${m.nombre} — ${err.message}`);
    }
  }

  console.log("   Migraciones completadas.\n");
}

// ── CORS ────────────────────────────────────────────────────
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? true
        : ["http://localhost:5173", "https://v-frontend-qgzd.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting login ─────────────────────────────────────
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      ok: false,
      mensaje: "Demasiados intentos. Intente en 15 minutos.",
    },
  }),
);

// ── Rutas ───────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/vacunas", vacunasRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Servidor activo",
    fecha: new Date().toISOString(),
  });
});

// ── Servir frontend en producción ──────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use("/api/*", (req, res) => {
  res.status(404).json({ ok: false, mensaje: "Ruta no encontrada." });
});

// ── Inicio: primero migraciones, luego servidor ─────────────
ejecutarMigraciones()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀  Servidor en http://localhost:${PORT}`);
      console.log(`    Entorno: ${process.env.NODE_ENV || "development"}\n`);
    });
  })
  .catch((err) => {
    // Si la migración falla gravemente, igualmente levantamos el servidor
    console.error("❌  Error en migraciones:", err.message);
    app.listen(PORT, () => {
      console.log(
        `🚀  Servidor en http://localhost:${PORT} (sin migraciones)\n`,
      );
    });
  });
