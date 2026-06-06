// ============================================================
// models/Tenis.js — Esquema de MongoDB para los productos
// ============================================================

const mongoose = require("mongoose");

// Define la estructura de cada documento "Tenis" en la base de datos
const tenisSchema = new mongoose.Schema(
  {
    // Nombre completo del tenis, ej: "Air Jordan 1 Retro High OG"
    titulo: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
    },

    // Marca del fabricante, ej: "Nike", "Adidas", "New Balance"
    marca: {
      type: String,
      required: [true, "La marca es obligatoria"],
      trim: true,
    },

    // Precio en pesos mexicanos (MXN)
    precio: {
      type: Number,
      required: [true, "El precio es obligatorio"],
      min: [0, "El precio no puede ser negativo"],
    },

    // Array de tallas disponibles en sistema americano (US)
    // Ej: [7, 7.5, 8, 8.5, 9, 9.5, 10]
    tallasDisponibles: {
      type: [Number],
      required: [true, "Debes especificar al menos una talla"],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Debe haber al menos una talla disponible",
      },
    },

    // Cantidad de pares disponibles en inventario
    stock: {
      type: Number,
      required: [true, "El stock es obligatorio"],
      min: [0, "El stock no puede ser negativo"],
      default: 0,
    },

    // Descripción detallada: materiales, historia, collab, etc.
    descripcion: {
      type: String,
      trim: true,
      default: "",
    },

    // URL de la imagen principal del producto
    imagen: {
      type: String,
      default: "",
    },

    // Categoría para filtrado, ej: "retro", "running", "lifestyle"
    categoria: {
      type: String,
      trim: true,
      default: "lifestyle",
    },
  },
  {
    // Agrega automáticamente createdAt y updatedAt
    timestamps: true,
  }
);

// Índice de texto para búsquedas por título, marca y descripción
tenisSchema.index({ titulo: "text", marca: "text", descripcion: "text" });

// Exporta el modelo para usarlo en rutas y el agente de IA
module.exports = mongoose.model("Tenis", tenisSchema);
