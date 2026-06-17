// routes/dashboard.js
const express            = require("express");
const router             = express.Router();
const { resumen }        = require("../controllers/dashboardController");
const { verificarToken } = require("../middlewares/auth");

// GET /api/dashboard → datos completos del panel de control
router.get("/", verificarToken, resumen);

module.exports = router;