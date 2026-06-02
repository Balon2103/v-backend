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
app.use("/api/vacunas", vacunasRoutes); // ← nuevo

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Servidor activo",
    fecha: new Date().toISOString(),
  });
});

// Servir frontend en producción
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

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || "development"}\n`);
});
