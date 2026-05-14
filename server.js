// server.js
// Punto de entrada del servidor Node.js + Express

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173", // Vite dev server
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ],
  methods:      ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:  true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting para login ────────────────────────────────
// Máximo 10 intentos cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: {
    ok:      false,
    mensaje: "Demasiados intentos fallidos. Intente nuevamente en 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use("/api/auth/login", loginLimiter);

// ── Rutas ───────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Ruta de verificación (health check) ─────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok:      true,
    mensaje: "Servidor funcionando correctamente",
    fecha:   new Date().toISOString(),
  });
});

// ── Ruta no encontrada ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: "Ruta no encontrada." });
});

// ── Inicio del servidor ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});