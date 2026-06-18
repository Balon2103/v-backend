// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const authRoutes = require("./routes/auth");
const vacunasRoutes = require("./routes/vacunas");
const inventarioRoutes = require("./routes/inventario");
const reportesRoutes = require("./routes/reportes");
const usuariosRoutes = require("./routes/usuarios");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const PORT = process.env.PORT || 3001;

// Necesario para Render + express-rate-limit
app.set("trust proxy", 1);

// ─────────────────────────────────────────────
// Inicialización automática de la BD
// ─────────────────────────────────────────────
async function inicializarBaseDatos() {
  const db = require("./config/db");

  try {
    const existe = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'usuarios'
      ) AS existe
    `);

    if (existe.rows[0].existe) {
      console.log("✅ Base de datos ya inicializada.");
      return;
    }

    console.log("\n🔄 Primera ejecución detectada.");
    console.log("📦 Ejecutando schema.sql...");

    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSQL = await fs.readFile(schemaPath, "utf8");

    await db.query(schemaSQL);

    console.log("✅ Tablas creadas correctamente.");

    console.log("👤 Creando usuario administrador...");

    const crearAdmin = require("./crearAdmin");

    await crearAdmin();

    console.log("✅ Inicialización completada.\n");
  } catch (error) {
    console.error("❌ Error inicializando la base de datos:");
    console.error(error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Migraciones automáticas
// ─────────────────────────────────────────────
async function ejecutarMigraciones() {
  const db = require("./config/db");

  const migraciones = [
    {
      nombre: "pacientes.email",
      sql: `
        ALTER TABLE pacientes
        ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL
      `,
    },
    {
      nombre: "pacientes.direccion",
      sql: `
        ALTER TABLE pacientes
        ADD COLUMN IF NOT EXISTS direccion TEXT DEFAULT NULL
      `,
    },
    {
      nombre: "vacunas_aplicadas.observaciones",
      sql: `
        ALTER TABLE vacunas_aplicadas
        ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL
      `,
    },
    {
      nombre: "movimientos_inventario.vencimiento",
      sql: `
        ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS vencimiento DATE DEFAULT NULL
      `,
    },
    {
      nombre: "movimientos_inventario.observaciones",
      sql: `
        ALTER TABLE movimientos_inventario
        ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT NULL
      `,
    },
  ];

  console.log("🔄 Verificando migraciones...");

  for (const m of migraciones) {
    try {
      await db.query(m.sql);
      console.log(`   ✅ ${m.nombre}`);
    } catch (err) {
      console.warn(`   ⚠️ ${m.nombre} — ${err.message}`);
    }
  }

  console.log("✅ Migraciones completadas.\n");
}

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Rate Limit Login
// ─────────────────────────────────────────────
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      ok: false,
      mensaje: "Demasiados intentos. Intente nuevamente en 15 minutos.",
    },
  }),
);

// ─────────────────────────────────────────────
// Rutas API
// ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/vacunas", vacunasRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Servidor activo",
    fecha: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// Frontend (opcional)
// ─────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");

  if (fsSync.existsSync(path.join(distPath, "index.html"))) {
    console.log("📦 Frontend detectado.");

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("ℹ️ Frontend no encontrado. Ejecutando solo API.");
  }
}

// ─────────────────────────────────────────────
// 404 API
// ─────────────────────────────────────────────
app.use("/api/*", (req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: "Ruta no encontrada.",
  });
});

// ─────────────────────────────────────────────
// Inicio servidor
// ─────────────────────────────────────────────
inicializarBaseDatos()
  .then(() => ejecutarMigraciones())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${PORT}`);
      console.log(`📍 Entorno: ${process.env.NODE_ENV || "development"}\n`);
    });
  })
  .catch((err) => {
    console.error("❌ Error durante el inicio:");
    console.error(err);
    process.exit(1);
  });
