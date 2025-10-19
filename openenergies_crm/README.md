# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Chat en inicio

- Variable de entorno requerida:
  - `VITE_N8N_CHAT_WEBHOOK_URL`: URL del Webhook de chat (POST JSON)
    - Ejemplo: `https://n8n.openenergiesgroup.com/webhook/f818530f-f9dc-411b-bdc9-7d89c0103cf5/chat`

- Comportamiento:
  - Botón flotante "Abrir chat" visible en `/app` (Dashboard).
  - Conversación persistida en `localStorage` por `user_id` del usuario autenticado.
  - Envío al Webhook con cuerpo mínimo:
    ```json
    { "user_id": "<string|number>", "name": "<string>", "message": "<string>" }
    ```
  - Respuesta: se extrae texto de `reply` | `message` | `data.message` | `text`.

- CORS / Proxy interno (opcional):
  - Si el navegador bloquea por CORS, el cliente usará automáticamente `'/api/chat'` como fallback cuando `VITE_N8N_CHAT_WEBHOOK_URL` no esté disponible en el navegador.
  - Implementa un proxy en tu servidor (o Edge Function) que reenvíe al valor de `VITE_N8N_CHAT_WEBHOOK_URL` con método `POST` y cabecera `Content-Type: application/json`.

- Uso local:
  - Configura `VITE_N8N_CHAT_WEBHOOK_URL` en tu `.env.local`.
  - Ejecuta `npm run dev` y accede a `/app`.
