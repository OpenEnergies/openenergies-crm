// src/features/chat/TypingIndicator.tsx
import React from 'react';

export default function TypingIndicator() {
  return (
    <span aria-live="polite" style={{ display: 'inline-flex', gap: 4 }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  const style: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: 'var(--muted)',
    display: 'inline-block',
    animation: `typing-bounce 1s infinite`,
    animationDelay: `${delay}ms`,
  };
  return <span style={style} />;
}


