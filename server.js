// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const authRoutes = require("./routes/auth");
const vacunasRoutes = require("./routes/vacunas");
const inventarioRoutes = require("./routes/inventario");
const reportesRoutes = require("./routes/reportes"); // ← nuevo

const app = express();
const PORT = process.env.PORT || 3001;

// ── Migración automática ────────────────────────────────────
async function ejecutarMigraciones() {
  const db = require("./config/db");
  const migraciones = [
    {
      nombre: "pacientes.email",
      sql: `ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL`,
    },
    {
      nombre: "pacientes.direccion",
      sql: `ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS direccion TEXT DEFAULT NULL`,
    },
    {
      nombre: "vacunas_aplicadas.observaciones",
      sql: `ALTER TABLE vacunas_aplicadas ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL`,
    },
    {
      nombre: "movimientos_inventario.vencimiento",
      sql: `ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS vencimiento DATE DEFAULT NULL`,
    },
    {
      nombre: "movimientos_inventario.observaciones",
      sql: `ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL`,
    },
    // ── Migraciones para reportes ───────────────────────────
    {
      nombre: "vacunas_aplicadas.dosis",
      sql: `ALTER TABLE vacunas_aplicadas ADD COLUMN IF NOT EXISTS dosis INTEGER DEFAULT 1`,
    },
    {
      nombre: "movimientos_inventario.tipo_check",
      sql: `DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'movimientos_inventario_tipo_check'
              ) THEN
                ALTER TABLE movimientos_inventario
                  ADD CONSTRAINT movimientos_inventario_tipo_check
                  CHECK (tipo IN ('entrada', 'salida'));
              END IF;
            END$$`,
    },
  ];

  console.log("\n🔄  Verificando migraciones...");
  for (const m of migraciones) {
    try {
      await db.query(m.sql);
      console.log(`   ✅  ${m.nombre}`);
    } catch (err) {
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

// ── Rate limiting ───────────────────────────────────────────
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

// Rate limit más permisivo para exportaciones de reportes
// (generan más carga que una consulta normal)
app.use(
  "/api/reportes",
  rateLimit({
    windowMs: 60 * 1000, // ventana de 1 minuto
    max: 30, // 30 peticiones por minuto por IP
    message: {
      ok: false,
      mensaje: "Demasiadas solicitudes a reportes. Intente en un momento.",
    },
  }),
);

// ── Rutas ───────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/vacunas", vacunasRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/reportes", reportesRoutes); // ← nuevo

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Servidor activo",
    fecha: new Date().toISOString(),
  });
});

// ── Producción: servir frontend ─────────────────────────────
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

// ── Arranque ────────────────────────────────────────────────
ejecutarMigraciones()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀  Servidor en http://localhost:${PORT}`);
      console.log(`    Entorno: ${process.env.NODE_ENV || "development"}\n`);
    });
  })
  .catch((err) => {
    console.error("❌  Error en migraciones:", err.message);
    app.listen(PORT, () => {
      console.log(
        `🚀  Servidor en http://localhost:${PORT} (sin migraciones)\n`,
      );
    });
  });
