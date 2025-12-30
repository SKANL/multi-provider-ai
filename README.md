
# bun-ai-api

Gateway inteligente para múltiples modelos LLM construido con Bun, Hono y TypeScript. Proporciona un endpoint centralizado para interactuar con proveedores de IA como Groq y Cerebras, con soporte para rotación automática de modelos, control de límites de uso y fallback inteligente.

**Basado en:** [midudev/bun-ai-api](https://github.com/midudev/bun-ai-api) — con cambios sustanciales en arquitectura, escalabilidad y funcionalidades avanzadas.

## Mejoras frente al proyecto original

- **Arquitectura modular:** estructura `src/` con separación clara entre `config`, `core`, `services` y tipos.
- **ModelManager avanzado:** gestión inteligente de modelos con estrategias de rotación (`round-robin`, `random`, `least-used`), fallback automático y tracking de uso.
- **Usage Tracker:** sistema de seguimiento de tokens y límites de peticiones por modelo, con respuestas apropiadas (429) cuando se alcanza un límite.
- **Configuración centralizada:** `src/config/models.ts` para definir modelos, límites, prioridades y disponibilidad.
- **Endpoints de estadísticas:** `/models` (estado y límites), `/usage` (estadísticas detalladas de consumo).
- **CORS configurable:** mediante variables de entorno (`ALLOWED_ORIGINS`).
- **Provider Registry:** sistema extensible para añadir nuevos proveedores sin modificar el core.
- **TypeScript completo:** tipos definidos en `src/types.ts` para mayor seguridad.

---

## Requisitos previos

- **Bun** (≥1.0) — [descargar](https://bun.sh)
- **Git** — para clonar el repositorio
- **Variables de entorno** — claves API para Groq, Cerebras o ambos

## Instalación y setup

### 1. Instalar Bun

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verifica la instalación:
```bash
bun --version
```

### 2. Clonar y configurar el repositorio

```bash
git clone <tu-repositorio>
cd bun-ai-api
bun install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz:

```env
PORT=3000
ALLOWED_ORIGINS=*
GROQ_API_KEY=tu_clave_groq
CEREBRAS_API_KEY=tu_clave_cerebras
```

---

## Uso

### Iniciar el servidor

**Modo desarrollo (con hot-reload):**
```bash
bun run dev
```

**Modo producción:**
```bash
bun run src/index.ts
```

El servidor estará disponible en `http://localhost:3000` (o el puerto definido en `.env`).

---

## Endpoints

### `GET /`
Endpoint de salud. Retorna el estado del servidor y lista de modelos disponibles.

**Respuesta:**
```json
{
  "status": "ok",
  "message": "AI API running",
  "models": [
    { "id": "llama-3.3-70b-versatile", "provider": "groq", "name": "Llama 3.3 70B" }
  ]
}
```

### `GET /models`
Lista el estado detallado de todos los modelos, incluyendo disponibilidad y límites.

**Respuesta:**
```json
{
  "models": [
    {
      "id": "llama-3.3-70b-versatile",
      "provider": "groq",
      "available": true,
      "rateLimit": { "requests": 30, "tokens": 60000, ... },
      "configuredLimits": { "maxRequestsPerMinute": 30, "maxTokensPerMinute": 60000 }
    }
  ]
}
```

### `GET /usage`
Estadísticas detalladas de consumo y límites por modelo.

### `POST /chat`
Endpoint principal para chat con streaming.

**Request:**
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hola, ¿cómo estás?" }
  ],
  "model": "llama-3.3-70b-versatile"
}
```

(El parámetro `model` es opcional; si no se especifica, el servidor elige el siguiente disponible según la estrategia de rotación.)

**Response:**
Streaming de texto plano (Server-Sent Events).

### Ejemplos de uso

**Con cURL:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Cuéntame un chiste"}
    ]
  }'
```

**Con JavaScript/Fetch:**
```javascript
const response = await fetch('http://localhost:3000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '¿Cuál es tu nombre?' }]
  })
});

// Leer streaming
const reader = response.body.getReader();
const decoder = new TextDecoder();
let result = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  result += decoder.decode(value, { stream: true });
}
console.log(result);
```

---

## Configuración

### Modelos y límites

Edita `src/config/models.ts` para activar/desactivar modelos, ajustar límites y definir estrategias:

```typescript
export const getEnabledModels = (): ModelConfig[] => [
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B',
    enabled: true,
    limits: {
      maxRequestsPerMinute: 30,
      maxTokensPerMinute: 60000
    }
  },
  // ... más modelos
];
```

### Estrategias de rotación

En `src/index.ts`, configura el `ModelManager`:

```typescript
const modelManager = new ModelManager({
  strategy: 'round-robin',  // 'round-robin' | 'random' | 'least-used'
  autoFallback: true,       // Fallback automático si un modelo está limitado
  providers: ['groq'],      // (Opcional) filtrar por proveedor
  modelIds: ['llama-3.3-70b-versatile'] // (Opcional) filtrar por ID
});
```

### CORS

Configura origenes permitidos mediante `ALLOWED_ORIGINS` en `.env`:

```env
ALLOWED_ORIGINS=http://localhost:3000,https://example.com
```

O usa `*` para permitir cualquier origen (solo desarrollo).

---

## Estructura del proyecto

```
bun-ai-api/
├── src/
│   ├── index.ts              # Entrada principal (servidor Hono)
│   ├── types.ts              # Tipos TypeScript
│   ├── config/
│   │   └── models.ts         # Configuración de modelos
│   ├── core/
│   │   ├── model-manager.ts  # Gestión y rotación de modelos
│   │   └── usage-tracker.ts  # Seguimiento de uso y límites
│   └── services/
│       ├── index.ts          # Registry de proveedores
│       ├── groq.ts           # Implementación Groq
│       └── cerebras.ts       # Implementación Cerebras
├── package.json
├── tsconfig.json
├── bun.lock
└── README.md
```

---

## Añadir un nuevo proveedor

1. Crea un archivo `src/services/mi-proveedor.ts`:

```typescript
import type { AIProvider, ModelConfig } from '../types';

export const miProveedorProvider: AIProvider = {
  name: 'mi-proveedor',
  async chat(messages, model) {
    // Implementar lógica del chat
    const stream = // ... obtener stream
    return { stream, usage: /* ... */ };
  }
};
```

2. Regístralo en `src/services/index.ts`:

```typescript
const providerRegistry = new Map<ProviderName, AIProvider>([
  ['groq', groqProvider],
  ['cerebras', cerebrasProvider],
  ['mi-proveedor', miProveedorProvider], // Nuevo
]);
```

3. Agrega el modelo a `src/config/models.ts`.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Error: "No enabled models available"` | Verifica `src/config/models.ts` y asegúrate de que al menos un modelo está `enabled: true`. |
| `429 Too Many Requests` | Un modelo alcanzó su límite. El servidor intenta fallback automático si `autoFallback: true`. |
| Variables de entorno no se cargan | Crea `.env` en la raíz del proyecto y reinicia el servidor. |
| Error de tipo con TypeScript | Ejecuta `bun run tsc --noEmit` para validar tipos. |

---

## Agradecimientos

Basado en [midudev/bun-ai-api](https://github.com/midudev/bun-ai-api). Gracias a los proveedores Groq y Cerebras por sus SDKs.

---

## Licencia

Revisa la licencia del proyecto original y respétala según corresponda.
