// src/lib/chat/webhook.ts

// Definimos los tipos de "partes" que puede tener una respuesta.
type ReplyPart = 
  | { type: 'text'; content: string }
  | { type: 'file'; content: { name: string; url: string } };

// La respuesta del webhook ahora será un array de estas partes.
type ReplyPayload = ReplyPart[];

export type ChatPayload = { user_id: string | number; name: string; message: string };

/**
 * ✅ FUNCIÓN MEJORADA
 * Ahora procesa un array de objetos y extrae todas las partes (texto y archivos).
 */
function extractReply(json: any): ReplyPayload | null {
  if (!json) return null;

  // Nos aseguramos de que siempre trabajamos con un array.
  const items = Array.isArray(json) ? json : [json];
  const replies: ReplyPayload = [];

  for (const item of items) {
    if (item && typeof item === 'object') {
      // Importante: Procesamos el texto ANTES que el archivo
      // para que aparezca primero en el chat si vienen en el mismo objeto.
      if (item.text && typeof item.text === 'string' && item.text.trim()) {
        replies.push({ type: 'text', content: sanitizeText(item.text) });
      }
      if (item.file && typeof item.file.name === 'string' && typeof item.file.url === 'string') {
        replies.push({ type: 'file', content: item.file });
      }
    }
  }

  return replies.length > 0 ? replies : null;
}

async function postOnce({ payload, signal }: { payload: ChatPayload; signal?: AbortSignal }): Promise<ReplyPayload> {
  const url = import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL || '/api/chat';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const json = await res.json().catch(() => null);
  console.log("Respuesta recibida del webhook:", JSON.stringify(json, null, 2));
  
  const reply = extractReply(json);
  if (!reply) throw new Error('Respuesta inválida del Webhook');
  return reply;
}

// El resto del fichero no necesita cambios
export async function postToWebhook(
  payload: ChatPayload,
  options?: { signal?: AbortSignal }
): Promise<ReplyPayload> {
    const { signal } = options ?? {};
    let attempt = 0;
    let delayMs = 400;
    let lastError: unknown = null;
  
    while (attempt < 3) {
      try {
        return await postOnce({ payload, signal });
      } catch (e) {
        lastError = e;
        attempt++;
        if (attempt >= 3) break;
        const jitter = Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delayMs + jitter));
        delayMs *= 2;
      }
    }
  
    const message = (lastError as any)?.message || 'Error desconocido en el Webhook';
    throw new Error(message);
}

export function createChatAbortController() {
  return new AbortController();
}

export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');
}