// src/features/chat/MessageBubble.tsx
import React from 'react';

type Props = {
  role: 'user' | 'assistant' | 'system' | 'error';
  children: React.ReactNode;
};

export default function MessageBubble({ role, children }: Props) {
  const isUser = role === 'user';
  const isError = role === 'error';
  const alignStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
  };
  const bubbleStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.5rem 0.75rem',
    borderRadius: 12,
    background: isUser ? 'var(--secondary)' : isError ? '#FEE2E2' : 'var(--bg-card)',
    color: isUser ? 'white' : isError ? '#991B1B' : 'inherit',
    border: isUser ? 'none' : '1px solid var(--border-color)',
    maxWidth: '85%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
  return (
    <div style={alignStyle}>
      <div style={bubbleStyle}>{children}</div>
    </div>
  );
}


