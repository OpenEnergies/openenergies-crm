// src/features/chat/MessageBubble.tsx
import React from 'react';

type Props = {
  role: 'user' | 'assistant' | 'system' | 'error';
  children: React.ReactNode;
};

export default function MessageBubble({ role, children }: Props) {
  const isUser = role === 'user';
  const isError = role === 'error';

  const alignClass = isUser ? 'flex justify-end' : 'flex justify-start';

  const bubbleClass = isUser
    ? 'max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 bg-fenix-500 text-white'
    : isError
      ? 'max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30'
      : 'max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 bg-bg-intermediate text-gray-200';

  return (
    <div className={alignClass}>
      <div className={bubbleClass}>{children}</div>
    </div>
  );
}
