require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { procesarMensajeAI } = require("./services/aiService");

// Asegúrate de que TELEGRAM_TOKEN esté en tu archivo .env
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
    console.warn("⚠️ ADVERTENCIA: El token de Telegram no está definido en el archivo .env. El bot de Telegram no arrancará.");
} else {
    const bot = new TelegramBot(token, { polling: true });
    console.log("🤖 Bot de Telegram inicializado y escuchando...");

    // Evitar que fallos de red tumbe el servidor completo
    bot.on("polling_error", (error) => {
        console.error("❌ Error en polling de Telegram:", error.message);
    });

    // Guardar el historial de chat temporalmente en memoria para cada usuario
    const chatHistories = {};

    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return; // Ignorar stickers o imágenes por ahora

        // Indicarle al usuario que estamos procesando (Escribiendo...)
        bot.sendChatAction(chatId, "typing");

        if (!chatHistories[chatId]) {
            chatHistories[chatId] = [];
        }

        try {
            const aiResult = await procesarMensajeAI(text, chatHistories[chatId]);
            chatHistories[chatId] = aiResult.updatedHistory;
            bot.sendMessage(chatId, aiResult.reply);
        } catch (error) {
            console.error(`Error procesando mensaje de Telegram (Chat ID: ${chatId}):`, error);
            bot.sendMessage(chatId, "Lo siento, tuve un problema analizando el catálogo. ¡Intenta de nuevo!");
        }
    });
}