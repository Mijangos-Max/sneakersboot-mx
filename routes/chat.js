// ============================================================
// routes/chat.js — Agente Inteligente con Gemini + Function Calling
// ============================================================

const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Tenis = require("../models/Tenis");

// Inicializa el cliente de Gemini con tu API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================
// SYSTEM PROMPT — Define la personalidad del agente
// ============================================================
const SYSTEM_PROMPT = `
Eres "Kicks", el asistente virtual experto de SneakersBoot MX, la tienda de tenis más cool de México.

Tu personalidad:
- Eres apasionado de la cultura sneakerhead con conocimiento profundo del mercado.
- Usas un tono amigable, cercano y algo informal, pero siempre profesional.
- Conoces la historia de los modelos icónicos: Jordan, Yeezy, Dunk, Air Max, etc.
- Puedes hablar de colaboraciones (collabs), drops limitados y resell culture.
- Siempre respondes en español mexicano.

Tu objetivo principal:
- Ayudar a los clientes a encontrar el tenis perfecto según su estilo, presupuesto y talla.
- Consultar el catálogo real de la tienda usando las funciones disponibles.
- Si un producto no está en el catálogo, sugerirle alternativas similares que SÍ tengamos.
- Nunca inventes productos o precios que no estén en la base de datos.

Reglas importantes:
- Si el cliente pregunta por un tenis específico, búscalo en la BD antes de responder.
- Muestra los precios en pesos mexicanos (MXN) con formato: $X,XXX MXN.
- Si no hay stock de algo, sé honesto pero ofrece alternativas.
- Mantén las respuestas concisas (máximo 3-4 oraciones por mensaje).
- Al final de cada respuesta sobre productos, incluye un call-to-action como "¿Te gustaría saber más sobre este modelo?" o "¿Quieres que verifique tu talla?".
`;

// ============================================================
// DEFINICIÓN DE FUNCIONES (Tools) para Function Calling
// Estas funciones le permiten al agente consultar la BD real
// ============================================================
const tools = [
  {
    functionDeclarations: [
      // --- Función 1: Buscar tenis por texto ---
      {
        name: "buscarTenis",
        description:
          "Busca tenis en el catálogo de SneakersBoot MX por nombre, marca, o descripción. Úsala cuando el cliente pregunte por un modelo o marca específica.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description:
                'El término de búsqueda, ej: "Air Jordan", "Nike", "Yeezy 350"',
            },
          },
          required: ["query"],
        },
      },

      // --- Función 2: Filtrar por precio máximo ---
      {
        name: "filtrarPorPrecio",
        description:
          "Filtra el catálogo de tenis por un precio máximo en pesos mexicanos (MXN). Úsala cuando el cliente mencione un presupuesto.",
        parameters: {
          type: "OBJECT",
          properties: {
            precioMaximo: {
              type: "NUMBER",
              description: "El precio máximo en MXN, ej: 2500",
            },
          },
          required: ["precioMaximo"],
        },
      },

      // --- Función 3: Verificar disponibilidad por talla ---
      {
        name: "verificarTalla",
        description:
          "Verifica qué tenis están disponibles en una talla específica (sistema US). Úsala cuando el cliente pregunte por su talla.",
        parameters: {
          type: "OBJECT",
          properties: {
            talla: {
              type: "NUMBER",
              description: "La talla en sistema americano (US), ej: 9, 9.5, 10",
            },
          },
          required: ["talla"],
        },
      },

      // --- Función 4: Ver todo el catálogo ---
      {
        name: "obtenerCatalogo",
        description:
          "Obtiene los primeros 10 productos del catálogo completo. Úsala cuando el cliente quiera ver qué hay disponible en general.",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
    ],
  },
];

// ============================================================
// IMPLEMENTACIÓN DE LAS FUNCIONES — Lógica real de BD
// ============================================================
async function ejecutarFuncion(nombreFuncion, args) {
  console.log(`🔧 Ejecutando función: ${nombreFuncion}`, args);

  switch (nombreFuncion) {
    case "buscarTenis": {
      const resultados = await Tenis.find(
        { $text: { $search: args.query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(5)
        .lean();

      // Si la búsqueda de texto no da resultados, intenta con regex
      if (resultados.length === 0) {
        const regex = new RegExp(args.query, "i");
        const fallback = await Tenis.find({
          $or: [{ titulo: regex }, { marca: regex }, { descripcion: regex }],
        })
          .limit(5)
          .lean();
        return fallback;
      }
      return resultados;
    }

    case "filtrarPorPrecio": {
      const resultados = await Tenis.find({
        precio: { $lte: args.precioMaximo },
        stock: { $gt: 0 }, // Solo productos con stock
      })
        .sort({ precio: -1 }) // Más caro primero dentro del rango
        .limit(5)
        .lean();
      return resultados;
    }

    case "verificarTalla": {
      const resultados = await Tenis.find({
        tallasDisponibles: args.talla,
        stock: { $gt: 0 },
      })
        .limit(5)
        .lean();
      return resultados;
    }

    case "obtenerCatalogo": {
      const resultados = await Tenis.find({ stock: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      return resultados;
    }

    default:
      return { error: `Función desconocida: ${nombreFuncion}` };
  }
}

// ============================================================
// RUTA POST /api/chat — Endpoint principal del chatbot
// Body esperado: { message: string, history: Array }
// ============================================================
router.post("/", async (req, res) => {
  const { message, history = [] } = req.body;

  // Validación básica
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "El mensaje no puede estar vacío." });
  }

  try {
    // Inicializa el modelo Gemini con las herramientas y el system prompt
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: tools,
    });

    // Inicia el chat con el historial previo (para contexto de conversación)
    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role,       // "user" o "model"
        parts: [{ text: msg.text }],
      })),
    });

    // Envía el mensaje del usuario al modelo
    let result = await chat.sendMessage(message);
    let response = result.response;

    // --------------------------------------------------------
    // LOOP DE FUNCTION CALLING
    // Si Gemini decide llamar una función, la ejecutamos y
    // devolvemos el resultado para que genere la respuesta final
    // --------------------------------------------------------
    while (response.functionCalls && response.functionCalls().length > 0) {
      const funcionesAEjecutar = response.functionCalls();
      const resultadosFunciones = [];

      // Ejecuta cada función que el modelo solicite
      for (const fn of funcionesAEjecutar) {
        const resultado = await ejecutarFuncion(fn.name, fn.args);
        resultadosFunciones.push({
          functionResponse: {
            name: fn.name,
            response: { result: resultado },
          },
        });
      }

      // Envía los resultados de las funciones de vuelta al modelo
      result = await chat.sendMessage(resultadosFunciones);
      response = result.response;
    }

    // Extrae el texto final de la respuesta
    const textoRespuesta = response.text();

    res.json({
      reply: textoRespuesta,
      // Devuelve el historial actualizado para mantener el contexto
      history: [
        ...history,
        { role: "user", text: message },
        { role: "model", text: textoRespuesta },
      ],
    });
  } catch (error) {
    console.error("❌ Error en el agente de IA:", error);
    res.status(500).json({
      error: "Hubo un problema con el asistente. Intenta de nuevo.",
    });
  }
});

module.exports = router;
