// ============================================================
// server.js — Punto de entrada principal de SneakersBoot MX
// ============================================================

require("dotenv").config(); // Carga las variables de entorno desde .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// --- Importar rutas ---
const chatRoutes = require("./routes/chat");
const productRoutes = require("./routes/products");

require("./bot");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES GLOBALES
// ============================================================
app.use(cors());                          // Permite peticiones desde el frontend
app.use(express.json());                  // Parsea el body de las peticiones como JSON
app.use(express.static(path.join(__dirname, "public"))); // Sirve el frontend estático

// ============================================================
// CONEXIÓN A MONGODB ATLAS
// La URI se lee desde la variable de entorno MONGODB_URI
// Ejemplo: mongodb+srv://usuario:password@cluster.mongodb.net/sneakersboot
// ============================================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Error al conectar a MongoDB:", err.message);
    process.exit(1); // Detiene el servidor si no hay conexión a la BD
  });

// ============================================================
// RUTAS DE LA API
// ============================================================
app.use("/api/chat", chatRoutes);         // Endpoint del chatbot con IA
app.use("/api/products", productRoutes);  // Endpoints CRUD de productos

// Ruta raíz — Sirve el HTML del chat
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 SneakersBoot MX corriendo en http://localhost:${PORT}`);
});
