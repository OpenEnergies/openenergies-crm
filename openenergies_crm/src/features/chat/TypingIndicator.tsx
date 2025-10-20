// src/features/chat/TypingIndicator.tsx
import React from 'react';

export default function TypingIndicator() {
  return (
    <span aria-live="polite" className="typing-indicator">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return <span className="typing-dot" style={{ animationDelay: `${delay}ms` }} />;
}


