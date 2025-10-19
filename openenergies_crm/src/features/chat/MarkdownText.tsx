// src/features/chat/MarkdownText.tsx
import React from 'react';

// Esta función de ayuda no cambia.
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * ✅ NUEVA FUNCIÓN renderInline (Más robusta)
 * Esta función divide el texto en partes de texto normal y partes con formato (negrita, etc.)
 * y las renderiza de forma segura.
 */
function renderInline(text: string): React.ReactNode {
  // Expresión regular para encontrar todos los tipos de formato que soportamos.
  const tokenizer = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(https?:\/\/[^\s)]+\))/g;
  
  const parts = text.split(tokenizer);

  return parts.map((part, index) => {
    if (!part) return null;

    // Negrita: **texto**
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch) {
      return <strong key={index}>{escapeText(boldMatch[1] || '')}</strong>;
    }

    // Código: `texto`
    const codeMatch = part.match(/^`(.*?)`$/);
    if (codeMatch) {
      return <code key={index} style={{ background: '#F1F5F9', padding: '0 4px', borderRadius: 4 }}>{escapeText(codeMatch[1] || '')}</code>;
    }
    
    // Enlace: [texto](url)
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">{escapeText(linkMatch[1] || '')}</a>;
    }

    // Si no es nada de lo anterior, es texto normal.
    return escapeText(part);
  });
}


export default function MarkdownText({ text }: { text: string }) {
  // ✅ NORMALIZACIÓN SIMPLIFICADA
  // Solo nos preocupamos de los saltos de línea, ya que el webhook envía el formato correcto.
  const normalizedText = text
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n');
  
  const lines = normalizedText.split('\n');
  const out: React.ReactNode[] = [];
  let listType: 'ul' | null = null;
  let listItems: string[] = [];

  function flushList() {
    if (!listType || listItems.length === 0) return;
    out.push(
        <ul key={`ul-${out.length}`} style={{ paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
            {listItems.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>
    );
    listType = null; listItems = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    
    // El resto de la lógica para listas y párrafos no necesita cambios.
    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (!listType) listType = 'ul';
      listItems.push(ulMatch[1] || '');
      continue;
    } else {
      flushList();
    }

    if (line.trim() === '') { 
      if (out.length > 0 && lines[i-1]?.trim() !== '') {
          out.push(<div key={`br-${out.length}`} style={{ height: 8 }} />); 
      }
      continue; 
    }
    
    out.push(<p key={`p-${out.length}`} style={{ margin: '0.25rem 0' }}>{renderInline(line)}</p>);
  }
  
  flushList();
  return <>{out}</>;
}