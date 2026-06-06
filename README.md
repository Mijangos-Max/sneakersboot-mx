# 👟 SneakersBoot MX — Chatbot con IA

Chatbot inteligente para tienda de tenis, construido con Node.js, Express, MongoDB Atlas y Gemini AI.

## Estructura del proyecto

```
sneakersboot/
├── models/
│   └── Tenis.js          # Esquema de MongoDB
├── routes/
│   ├── chat.js           # Agente Gemini con Function Calling
│   └── products.js       # CRUD de productos
├── public/
│   └── index.html        # Frontend del chat
├── server.js             # Servidor principal
├── package.json
├── .env.example          # Plantilla de variables de entorno
└── .gitignore
```

## Configuración local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Crear archivo .env
```bash
cp .env.example .env
```
Edita `.env` y llena `MONGODB_URI` y `GEMINI_API_KEY`.

### 3. Poblar la base de datos con datos de demo
```bash
# Una vez corriendo el servidor, haz POST a:
curl -X POST http://localhost:3000/api/products/seed/demo
```

### 4. Correr en desarrollo
```bash
npm run dev
```

## Deploy en Railway

1. Sube el código a GitHub (sin el `.env`)
2. En Railway, crea un nuevo proyecto desde tu repositorio
3. En **Variables**, agrega:
   - `MONGODB_URI` → tu URI de MongoDB Atlas
   - `GEMINI_API_KEY` → tu API Key de Gemini
4. Railway detecta automáticamente el `package.json` y hace el deploy

## Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | Enviar mensaje al chatbot |
| GET | `/api/products` | Listar productos |
| POST | `/api/products` | Crear producto |
| PUT | `/api/products/:id` | Actualizar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| POST | `/api/products/seed/demo` | Cargar datos de ejemplo |

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | URI de conexión a MongoDB Atlas |
| `GEMINI_API_KEY` | API Key de Google AI Studio |
| `PORT` | Puerto del servidor (Railway lo asigna solo) |
