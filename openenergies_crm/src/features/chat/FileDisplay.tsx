// src/features/chat/FileDisplay.tsx
import React from 'react';
import { Download, FileText } from 'lucide-react'; // Importamos iconos

interface Props {
  name: string;
  url: string;
}

export default function FileDisplay({ name, url }: Props) {
  return (
    <a
      href={url}
      download // El atributo download indica al navegador que debe descargar el archivo
      target="_blank" // Abre en una nueva pestaña como fallback
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        textDecoration: 'none',
        color: 'var(--fg)',
        background: '#F8FAFC',
        maxWidth: '280px',
      }}
    >
      <FileText size={32} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      <div style={{ flexGrow: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
          Archivo
        </p>
      </div>
      <Download size={20} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
    </a>
  );
}