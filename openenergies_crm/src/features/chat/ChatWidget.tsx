// src/features/chat/ChatWidget.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send, MessagesSquare } from 'lucide-react';
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
      {/* Floating Action Button - Fixed position bottom right */}
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-fenix-500 hover:bg-fenix-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 cursor-pointer"
        aria-expanded={open}
        aria-controls="chat-panel"
        title={open ? 'Cerrar chat' : 'Abrir chat'}
      >
        <MessagesSquare size={24} />
      </button>

      {/* Chat Panel - Fixed position */}
      {open && (
        <div
          id="chat-panel"
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] glass-modal flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Chat"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-bg-intermediate">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MessagesSquare size={20} className="text-fenix-400" />
              Asistente Pepe
            </h3>
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
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

          {/* Input Area */}
          <div className="p-4 border-t border-bg-intermediate flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              rows={1}
              disabled={pending || !userId || !nombre}
              className="flex-1 glass-input resize-none min-h-[40px] max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-10 h-10 rounded-lg bg-fenix-500 hover:bg-fenix-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
              title="Enviar mensaje"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}