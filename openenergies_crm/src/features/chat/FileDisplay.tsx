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
      className="chat-file-display"
    >
      <FileText size={28} className="chat-file-icon" />
      <div style={{ flexGrow: 1, overflow: 'hidden' }}>
        <p className="chat-file-name" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        <p className="chat-file-type" style={{ margin: '0.1rem 0 0' }}>
          Archivo
        </p>
      </div>
      <Download size={20} className="chat-file-download-icon" />
    </a>
  );
}