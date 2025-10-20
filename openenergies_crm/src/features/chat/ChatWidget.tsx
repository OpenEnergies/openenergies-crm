// src/features/chat/ChatWidget.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useSession } from '@hooks/useSession';
import TypingIndicator from './TypingIndicator';
import MessageBubble from './MessageBubble';
import MarkdownText from './MarkdownText';
import FileDisplay from './FileDisplay';
import { createChatAbortController, postToWebhook } from '@lib/chat/webhook';

// El tipo de mensaje no cambia, sigue siendo válido
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  type: 'text' | 'file';
  content: string | { name: string; url: string };
};

// Las funciones para crear mensajes tampoco cambian
function createTextMessage(role: ChatMessage['role'], text: string): ChatMessage {
  return { id: `${Date.now()}-${Math.random()}`, role, type: 'text', content: text };
}

function createFileMessage(role: ChatMessage['role'], file: { name: string; url: string }): ChatMessage {
  return { id: `${Date.now()}-${Math.random()}`, role, type: 'file', content: file };
}

export default function ChatWidget() {
  const { userId, nombre } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = !!userId && !!nombre && !pending && input.trim().length > 0;
  
  useEffect(() => { setMessages([]); }, [userId]);
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 0); } 
    else {
      abortRef.current?.abort();
      abortRef.current = null;
      setPending(false);
    }
  }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, pending]);

  function toggle() { setOpen((v) => !v); }

  async function handleSend() {
    if (!canSend) return;

    const trimmed = input.trim().slice(0, 2000);
    const userMsg = createTextMessage('user', trimmed);
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPending(true);

    const controller = createChatAbortController();
    abortRef.current = controller;

    try {
      // ✅ LÓGICA DE RESPUESTA ACTUALIZADA
      // 'replies' es ahora un array con todas las partes del mensaje.
      const replies = await postToWebhook({ user_id: userId!, name: nombre!, message: trimmed }, { signal: controller.signal });
      
      const newAssistantMessages: ChatMessage[] = [];
      // Iteramos sobre cada parte y creamos un mensaje para ella.
      for (const reply of replies) {
        if (reply.type === 'text') {
          newAssistantMessages.push(createTextMessage('assistant', reply.content));
        } else if (reply.type === 'file') {
          newAssistantMessages.push(createFileMessage('assistant', reply.content));
        }
      }
      
      // Añadimos todos los nuevos mensajes del asistente de una sola vez.
      setMessages((prev) => [...prev, ...newAssistantMessages]);

    } catch (e: any) {
      const errorMsg = createTextMessage('error', `Error: ${e.message}`);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setPending(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // El resto del componente (el JSX) no necesita cambios.
  return (
    <>
      <button onClick={toggle} className="chat-fab shadow-lg hover:shadow-xl transition-shadow" aria-expanded={open} aria-controls="chat-panel" title={open ? 'Cerrar chat' : 'Abrir chat'}>
        <span className="chat-fab-initials">OE</span>
      </button>

      {open && (
        <div id="chat-panel" className="chat-panel shadow-xl border border-gray-200 rounded-lg" role="dialog" aria-label="Chat">
          <div className="chat-inner-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}> {/* Añade clase y padding */}
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0 }}> Asistente</h3>
              <button onClick={toggle} className="icon-button secondary small">✕</button>
            </div>

            <div ref={listRef} className="chat-message-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0.25rem' }}>
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role}>
                  {m.type === 'text' && <MarkdownText text={m.content as string} />}
                  {m.type === 'file' && <FileDisplay {...m.content as { name: string, url: string }} />}
                </MessageBubble>
              ))}
              {pending && (
                <MessageBubble role="assistant">
                  <TypingIndicator />
                </MessageBubble>
              )}
            </div>

            <div className="chat-input-area" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                rows={1}
                disabled={pending || !userId || !nombre}
                className="chat-textarea" style={{ flex: 1, minHeight: '40px', maxHeight: '150px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '8px 12px' }}
              />
              <button 
                onClick={handleSend} 
                disabled={!canSend}
                className="icon-button chat-send-button" style={{ height: '40px', width: '40px' }}
                title="Enviar mensaje"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}