// ============================================================
// routes/products.js — CRUD de productos (tenis)
// ============================================================

const express = require("express");
const router = express.Router();
const Tenis = require("../models/Tenis");

// Middleware de seguridad para endpoints administrativos
const requireAuth = (req, res, next) => {
  const token = req.headers["authorization"];
  // Si no se define ADMIN_TOKEN en .env, permite todo para evitar bloqueos en desarrollo
  // En un entorno de producción estricto, esto debería bloquear por defecto.
  if (!process.env.ADMIN_TOKEN) {
    console.warn("⚠️ Advertencia de Seguridad: ADMIN_TOKEN no está configurado en .env.");
    return next();
  }
  if (token === `Bearer ${process.env.ADMIN_TOKEN}` || token === process.env.ADMIN_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: "Acceso no autorizado." });
  }
};

// GET /api/products — Obtener todos los productos
router.get("/", async (req, res) => {
  try {
    const { marca, precioMax, talla, page = 1, limit = 10 } = req.query;
    const filtro = {};

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Sanitiza regex
    if (marca) filtro.marca = new RegExp(escapeRegex(marca), "i");
    if (precioMax) filtro.precio = { $lte: Number(precioMax) };
    if (talla) filtro.tallasDisponibles = Number(talla);

    const limiteNumerico = Math.max(1, parseInt(limit));
    const saltar = (Math.max(1, parseInt(page)) - 1) * limiteNumerico;

    const tenis = await Tenis.find(filtro)
      .sort({ createdAt: -1 })
      .skip(saltar)
      .limit(limiteNumerico);
      
    res.json(tenis);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos." });
  }
});

// GET /api/products/:id — Obtener un producto por ID
router.get("/:id", async (req, res) => {
  try {
    const tenis = await Tenis.findById(req.params.id);
    if (!tenis) return res.status(404).json({ error: "Producto no encontrado." });
    res.json(tenis);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar el producto." });
  }
});

// POST /api/products — Crear un nuevo producto
router.post("/", requireAuth, async (req, res) => {
  try {
    const nuevoTenis = new Tenis(req.body);
    const guardado = await nuevoTenis.save();
    res.status(201).json(guardado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/products/:id — Actualizar un producto
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const actualizado = await Tenis.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!actualizado) return res.status(404).json({ error: "Producto no encontrado." });
    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/products/:id — Eliminar un producto
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const eliminado = await Tenis.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: "Producto no encontrado." });
    res.json({ message: "Producto eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el producto." });
  }
});

// POST /api/products/seed — Poblar la BD con datos de ejemplo
router.post("/seed/demo", requireAuth, async (req, res) => {
  try {
    await Tenis.deleteMany({}); // Limpia la colección primero

    const datosDemostracion = [
      {
        titulo: "Air Jordan 1 Retro High OG",
        marca: "Nike",
        precio: 4299,
        tallasDisponibles: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11],
        stock: 15,
        descripcion: "El icónico Jordan 1 en colorway Chicago. Historia pura en cada paso. Piel premium, suela Air-Sole y el Swoosh que lo dice todo.",
        categoria: "retro",
        imagen: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80"
      },
      {
        titulo: "Adidas Yeezy Boost 350 V2 Zebra",
        marca: "Adidas",
        precio: 5800,
        tallasDisponibles: [7, 8, 8.5, 9, 9.5, 10],
        stock: 8,
        descripcion: "El Yeezy más buscado de Kanye West. Primeknit monocromo con Boost en la suela para comodidad máxima todo el día.",
        categoria: "lifestyle",
        imagen: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&q=80"
      },
      {
        titulo: "Nike Dunk Low Panda",
        marca: "Nike",
        precio: 2999,
        tallasDisponibles: [6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11],
        stock: 20,
        descripcion: "El Dunk Low en blanco y negro que redefinió el streetwear. Clean, versátil y siempre fresh. Combina con todo.",
        categoria: "lifestyle",
        imagen: "https://images.unsplash.com/photo-1552346154-21d32810baa3?w=500&q=80"
      },
      {
        titulo: "New Balance 550 White Green",
        marca: "New Balance",
        precio: 2499,
        tallasDisponibles: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5],
        stock: 12,
        descripcion: "El retorno de la silueta de basketball de los 80s. Cuero premium con paneles en verde. El favorito de los fashionistas.",
        categoria: "retro",
        imagen: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&q=80"
      },
      {
        titulo: "Adidas Stan Smith",
        marca: "Adidas",
        precio: 1799,
        tallasDisponibles: [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11],
        stock: 30,
        descripcion: "El clásico eterno. Cuero blanco con talón verde y la firma de Stan Smith. Minimalismo que nunca pasa de moda.",
        categoria: "lifestyle",
        imagen: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=500&q=80"
      },
      {
        titulo: "Nike Air Max 90",
        marca: "Nike",
        precio: 3199,
        tallasDisponibles: [7, 8, 9, 9.5, 10, 10.5, 11],
        stock: 10,
        descripcion: "La unidad Air visible más famosa de Nike. Diseño de Tinker Hatfield que sigue siendo relevante más de 30 años después.",
        categoria: "running",
        imagen: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=500&q=80"
      },
      {
        titulo: "Converse Chuck Taylor All Star",
        marca: "Converse",
        precio: 1299,
        tallasDisponibles: [6, 7, 8, 9, 10, 11, 12],
        stock: 25,
        descripcion: "La zapatilla más vendida de la historia. Lona robusta, puntera de goma y ese icónico parche en el tobillo.",
        categoria: "lifestyle",
        imagen: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&q=80"
      },
      {
        titulo: "Vans Old Skool Black White",
        marca: "Vans",
        precio: 1599,
        tallasDisponibles: [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10],
        stock: 18,
        descripcion: "La firma de la cultura skate desde 1977. El swoosh lateral de gamuza y lona es inconfundible. Icono del streetwear global.",
        categoria: "lifestyle",
        imagen: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&q=80"
      }
    ];

    const insertados = await Tenis.insertMany(datosDemostracion);
    res.status(201).json({
      message: `✅ ${insertados.length} tenis de demostración agregados correctamente.`,
      productos: insertados,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al cargar los datos de demostración." });
  }
});

module.exports = router;
