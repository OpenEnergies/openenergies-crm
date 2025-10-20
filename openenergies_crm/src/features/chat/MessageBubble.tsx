// src/features/chat/MessageBubble.tsx
import React from 'react';

type Props = {
  role: 'user' | 'assistant' | 'system' | 'error';
  children: React.ReactNode;
};

export default function MessageBubble({ role, children }: Props) {
  const isUser = role === 'user';
  const isError = role === 'error';
  const alignClass = isUser ? 'chat-bubble-align-user' : 'chat-bubble-align-other';
  const bubbleClass = `chat-bubble ${
      isUser ? 'chat-bubble-user' :
      isError ? 'chat-bubble-error' :
      'chat-bubble-assistant' // Asumimos assistant si no es user o error
  }`;
  return (
    <div className={alignClass}>
      <div className={bubbleClass}>{children}</div>
    </div>
  );
}


