// ============================================================
// routes/chat.js — Endpoint de chat usando el servicio AI
// ============================================================

const express = require("express");
const router = express.Router();
const { procesarMensajeAI } = require("../services/aiService");

// RUTA POST /api/chat — Endpoint principal del chatbot
router.post("/", async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "El mensaje no puede estar vacío." });
  }

  try {
    const aiResult = await procesarMensajeAI(message, history);

    res.json({
      reply: aiResult.reply,
      history: aiResult.updatedHistory,
    });
  } catch (error) {
    console.error("❌ Error en el endpoint de chat:", error);
    res.status(500).json({
      error: "Hubo un problema con el asistente. Intenta de nuevo.",
    });
  }
});

module.exports = router;
