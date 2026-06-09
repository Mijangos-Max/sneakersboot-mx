const { GoogleGenerativeAI } = require("@google/generative-ai");
const Tenis = require("../models/Tenis");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
Eres "Kicks", el asistente virtual experto de SneakersBoot MX, la tienda de tenis más cool de México.

Tu personalidad:
- Eres apasionado de la cultura sneakerhead con conocimiento profundo del mercado.
- Usas un tono amigable, cercano y algo informal, pero siempre profesional.
- Eres altamente conversacional. Responde a saludos (como "hola", "buenas", "qué onda") de manera orgánica, preséntate brevemente y ofrécele tu ayuda.
- Conoces la historia de los modelos icónicos.
- Siempre respondes en español mexicano.

Tu objetivo principal:
- Ayudar a los clientes a encontrar el tenis perfecto mediante una charla fluida. Haz preguntas para descubrir su estilo, talla y presupuesto.
- Consultar el catálogo real de la tienda usando las funciones disponibles. Nunca inventes tenis que no tengamos.

Reglas de Interactividad VISUAL (¡MUY IMPORTANTE!):
- Si el cliente quiere "ver el catálogo", "modelos", "opciones" de forma general, incluye EXACTAMENTE el texto [MOSTRAR_CATALOGO] en tu respuesta. El bot de Telegram detectará esto y enviará el catálogo visual.
- Si recomiendas o hablas de un modelo Específico y quieres que el cliente vea la foto y el botón de comprar, incluye EXACTAMENTE el texto [MOSTRAR_PRODUCTO:aqui_va_el_id_del_modelo] en tu respuesta. Asegúrate de usar el campo "_id" que te devuelve la base de datos.
- Puedes incluir múltiples [MOSTRAR_PRODUCTO:id] si recomiendas varios.

Reglas adicionales:
- Muestra precios en pesos mexicanos (MXN) formato $X,XXX MXN.
- Mantén tus respuestas de texto concisas. No envíes listas gigantes de texto si puedes usar [MOSTRAR_PRODUCTO:id].
- Si el usuario dice "/start" o "/catalogo", actúa como si te acabara de saludar o pedir el catálogo respectivamente.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "buscarTenis",
        description: "Busca tenis en el catálogo de SneakersBoot MX por nombre, marca, o descripción. Úsala cuando el cliente pregunte por un modelo o marca específica.",
        parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "El término de búsqueda, ej: 'Air Jordan', 'Nike'" } }, required: ["query"] }
      },
      {
        name: "filtrarPorPrecio",
        description: "Filtra el catálogo de tenis por un precio máximo en pesos mexicanos (MXN). Úsala cuando el cliente mencione un presupuesto.",
        parameters: { type: "OBJECT", properties: { precioMaximo: { type: "NUMBER", description: "El precio máximo en MXN" } }, required: ["precioMaximo"] }
      },
      {
        name: "verificarTalla",
        description: "Verifica qué tenis están disponibles en una talla específica (sistema US). Úsala cuando el cliente pregunte por su talla.",
        parameters: { type: "OBJECT", properties: { talla: { type: "NUMBER", description: "La talla en sistema americano (US), ej: 9, 9.5" } }, required: ["talla"] }
      },
      {
        name: "obtenerCatalogo",
        description: "Obtiene una página de productos del catálogo (10 por página). Úsala para mostrar el inventario general. Si el cliente pide ver más, aumenta el parámetro de página.",
        parameters: { type: "OBJECT", properties: { page: { type: "NUMBER", description: "Número de página a consultar, por defecto 1" } } }
      }
    ]
  }
];

// Ejecución segura de las herramientas de la BD
async function ejecutarFuncion(nombreFuncion, args) {
  console.log(`🔧 Ejecutando función AI: ${nombreFuncion}`, args);
  try {
    switch (nombreFuncion) {
      case "buscarTenis": {
        const resultados = await Tenis.find(
          { $text: { $search: args.query } },
          { score: { $meta: "textScore" } }
        ).sort({ score: { $meta: "textScore" } }).limit(5).lean();

        if (resultados.length === 0) {
          const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapeRegex(args.query), "i");
          return await Tenis.find({
            $or: [{ titulo: regex }, { marca: regex }, { descripcion: regex }]
          }).limit(5).lean();
        }
        return resultados;
      }
      case "filtrarPorPrecio":
        return await Tenis.find({ precio: { $lte: args.precioMaximo }, stock: { $gt: 0 } })
          .sort({ precio: -1 }).limit(5).lean();
      case "verificarTalla":
        return await Tenis.find({ tallasDisponibles: args.talla, stock: { $gt: 0 } })
          .limit(5).lean();
      case "obtenerCatalogo": {
        const pagina = args.page ? Math.max(1, parseInt(args.page)) : 1;
        const saltar = (pagina - 1) * 10;
        return await Tenis.find({ stock: { $gt: 0 } })
          .sort({ createdAt: -1 })
          .skip(saltar)
          .limit(10)
          .lean();
      }
      default:
        return { error: `Función desconocida: ${nombreFuncion}` };
    }
  } catch (error) {
    console.error("Error al ejecutar herramienta de BD:", error);
    return { error: "Ocurrió un error al buscar en la base de datos." };
  }
}

/**
 * Función principal para procesar mensajes a través de Gemini AI.
 * @param {string} message - El mensaje del usuario.
 * @param {Array} history - El historial de la conversación.
 */
async function procesarMensajeAI(message, history = []) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La variable GEMINI_API_KEY no está configurada.");
  }

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash", // Usa env var si existe
    systemInstruction: SYSTEM_PROMPT,
    tools: tools,
  });

  // Limpieza robusta del historial: Gemini falla si recibe 'functionCall' inválidos en llamadas nuevas.
  const formattedHistory = history.map((msg) => ({
    role: msg.role === "model" ? "model" : "user",
    parts: [{ text: msg.text || "" }],
  })).filter(msg => msg.parts[0].text.trim() !== "");

  const chat = model.startChat({ history: formattedHistory });
  let result = await chat.sendMessage(message);
  let response = result.response;

  // Manejar el ciclo de Function Calling
  while (response.functionCalls && response.functionCalls().length > 0) {
    const funcionesAEjecutar = response.functionCalls();
    const resultadosFunciones = [];

    for (const fn of funcionesAEjecutar) {
      const resultado = await ejecutarFuncion(fn.name, fn.args);
      resultadosFunciones.push({
        functionResponse: {
          name: fn.name,
          response: { result: resultado },
        },
      });
    }

    result = await chat.sendMessage(resultadosFunciones);
    response = result.response;
  }

  const replyText = response.text();

  return {
    reply: replyText,
    updatedHistory: [
      ...history,
      { role: "user", text: message },
      { role: "model", text: replyText },
    ]
  };
}

module.exports = { procesarMensajeAI };
