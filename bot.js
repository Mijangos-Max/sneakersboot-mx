require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// Asegúrate de que TELEGRAM_TOKEN esté en tu archivo .env
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
    console.error("❌ ERROR: El token de Telegram no está definido en el archivo .env");
} else {
    const bot = new TelegramBot(token, { polling: true });
    console.log("🤖 Bot de Telegram inicializado y escuchando...");

    bot.on("message", (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        bot.sendMessage(chatId, `Hola, soy tu SneakersBoot. Recibí: ${text}`);
    });
}