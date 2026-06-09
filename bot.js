require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { procesarMensajeAI } = require("./services/aiService");
const Tenis = require("./models/Tenis");

const token = process.env.TELEGRAM_TOKEN;

if (!token) {
    console.warn("⚠️ ADVERTENCIA: El token de Telegram no está definido en el archivo .env. El bot de Telegram no arrancará.");
} else {
    const bot = new TelegramBot(token, { polling: true });
    console.log("🤖 Bot de Telegram inicializado y escuchando...");

    bot.on("polling_error", (error) => {
        console.error("❌ Error en polling de Telegram:", error.message);
    });

    const chatHistories = {};

    // Función para mostrar el catálogo completo (paginado)
    const enviarCatalogo = async (chatId, page = 0, messageId = null) => {
        try {
            const limit = 1; 
            const skip = page * limit;
            const total = await Tenis.countDocuments({ stock: { $gt: 0 } });
            const productos = await Tenis.find({ stock: { $gt: 0 } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            if (productos.length === 0) {
                if (messageId) {
                    bot.editMessageText("No hay productos disponibles por ahora.", { chat_id: chatId, message_id: messageId });
                } else {
                    bot.sendMessage(chatId, "No hay productos disponibles por ahora.");
                }
                return;
            }

            const producto = productos[0];
            const caption = `🔥 *${producto.titulo}*\n\n` +
                            `*Marca:* ${producto.marca}\n` +
                            `*Precio:* $${producto.precio} MXN\n` +
                            `*Tallas (US):* ${producto.tallasDisponibles.join(", ")}\n\n` +
                            `${producto.descripcion}\n\n` +
                            `_Producto ${page + 1} de ${total}_`;

            const inline_keyboard = [];
            const navRow = [];
            
            if (page > 0) {
                navRow.push({ text: "⬅️ Anterior", callback_data: `cat_${page - 1}` });
            }
            navRow.push({ text: `🛒 Comprar`, callback_data: `buy_${producto._id}` });
            if (skip + limit < total) {
                navRow.push({ text: "Siguiente ➡️", callback_data: `cat_${page + 1}` });
            }
            inline_keyboard.push(navRow);

            const options = {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard }
            };

            if (producto.imagen) {
                if (messageId) {
                    bot.editMessageMedia(
                        { type: "photo", media: producto.imagen, caption: caption, parse_mode: "Markdown" },
                        { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard } }
                    ).catch((err) => {
                        bot.deleteMessage(chatId, messageId).catch(() => {});
                        bot.sendPhoto(chatId, producto.imagen, { caption, ...options });
                    });
                } else {
                    bot.sendPhoto(chatId, producto.imagen, { caption, ...options });
                }
            } else {
                if (messageId) {
                    bot.editMessageText(caption, { chat_id: chatId, message_id: messageId, ...options }).catch(() => {
                        bot.deleteMessage(chatId, messageId).catch(() => {});
                        bot.sendMessage(chatId, caption, options);
                    });
                } else {
                    bot.sendMessage(chatId, caption, options);
                }
            }

        } catch (error) {
            console.error("Error al obtener catálogo:", error);
            bot.sendMessage(chatId, "Ocurrió un error al cargar el catálogo.");
        }
    };

    // Función para mostrar un producto en específico que la IA recomendó
    const enviarProductoEspecifico = async (chatId, productId) => {
        try {
            const producto = await Tenis.findById(productId);
            if (!producto) return; // Si no existe, no hace nada
            
            const caption = `🔥 *${producto.titulo}*\n\n` +
                            `*Precio:* $${producto.precio} MXN\n` +
                            `*Tallas (US):* ${producto.tallasDisponibles.join(", ")}`;
            
            const inline_keyboard = [[{ text: `🛒 Comprar`, callback_data: `buy_${producto._id}` }]];
            const options = { parse_mode: "Markdown", reply_markup: { inline_keyboard } };
            
            if (producto.imagen) {
                bot.sendPhoto(chatId, producto.imagen, { caption, ...options });
            } else {
                bot.sendMessage(chatId, caption, options);
            }
        } catch (error) {
            console.error("Error al mostrar producto específico:", error);
        }
    };

    bot.on("callback_query", (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;

        if (data.startsWith("cat_")) {
            const page = parseInt(data.split("_")[1]);
            enviarCatalogo(chatId, page, messageId);
        } else if (data.startsWith("buy_")) {
            // Mandamos mensaje orgánico de que inició proceso de compra
            bot.sendMessage(chatId, "¡Excelente elección! Dime en qué talla te interesa (ej. 'Quiero talla 9') y Kicks continuará con tu pedido.");
        }
        
        bot.answerCallbackQuery(query.id);
    });

    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return;

        bot.sendChatAction(chatId, "typing");

        if (!chatHistories[chatId]) {
            chatHistories[chatId] = [];
        }

        try {
            const aiResult = await procesarMensajeAI(text, chatHistories[chatId]);
            chatHistories[chatId] = aiResult.updatedHistory;
            
            let replyText = aiResult.reply;

            // Procesar marcadores de interactividad visual inyectados por la IA
            let showCatalog = false;
            if (replyText.includes("[MOSTRAR_CATALOGO]")) {
                showCatalog = true;
                replyText = replyText.replace("[MOSTRAR_CATALOGO]", "").trim();
            }

            const productRegex = /\[MOSTRAR_PRODUCTO:([a-zA-Z0-9_]+)\]/g;
            const productMatches = [...replyText.matchAll(productRegex)];
            for (const match of productMatches) {
                replyText = replyText.replace(match[0], "").trim();
            }

            // Enviar respuesta en texto de la IA
            if (replyText.length > 0) {
                await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
            }

            // Lanzar elementos interactivos solicitados
            if (showCatalog) {
                await enviarCatalogo(chatId, 0);
            }

            for (const match of productMatches) {
                const productId = match[1];
                await enviarProductoEspecifico(chatId, productId);
            }

        } catch (error) {
            console.error(`Error procesando mensaje de Telegram (Chat ID: ${chatId}):`, error);
            bot.sendMessage(chatId, "Lo siento, tuve un problema analizando el catálogo. ¡Intenta de nuevo!");
        }
    });
}