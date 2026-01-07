// src/components/FilePreviewModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DocViewer, { DocViewerRenderers, IDocument } from 'react-doc-viewer';
import { Loader2, X } from 'lucide-react';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';

// worker de pdf.js servido desde /public
pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string | null;
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)',
  display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', borderRadius: '0.75rem', padding: '1rem',
  width: '90%', height: '90%', maxWidth: '1200px', display: 'flex',
  flexDirection: 'column', position: 'relative',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)',
  flexShrink: 0,
};
const viewerContainerStyle: React.CSSProperties = {
  flexGrow: 1, overflow: 'hidden', position: 'relative'
};
const closeButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0.5rem',
};
const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  color: 'var(--fg)', zIndex: 1,
  pointerEvents: 'none',
};
const errorOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  color: 'var(--fg)', zIndex: 2
};

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen, onClose, fileUrl, fileName,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const [txtContent, setTxtContent] = useState<string | null>(null);
  const [txtFailed, setTxtFailed] = useState(false);

  // --- estado para PDF ---
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);

  const fileExtension = useMemo(
    () => (fileName?.split('.').pop()?.toLowerCase() ?? ''),
    [fileName]
  );
  const isPdf = fileExtension === 'pdf';
  const isTxt = fileExtension === 'txt';
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension);

  // Cargar TXT (con fallback a iframe si CORS falla)
  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    if (!isTxt) { setTxtContent(null); setTxtFailed(false); return; }

    setIsLoading(true);
    setTxtFailed(false);
    setTxtContent(null);

    fetch(fileUrl, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => { setTxtContent(t); setIsLoading(false); })
      .catch(() => {
        // Fallback: mostramos en iframe sin marcar error (para no tapar con overlay rojo)
        setTxtFailed(true);
        setIsLoading(false);
      });
  }, [isOpen, fileUrl, isTxt]);

  // Reset al abrir/cambiar archivo
  useEffect(() => {
    if (isOpen && fileUrl) {
      setIsLoading(isPdf || isTxt); // loading para PDF y TXT
      setRenderError(null);
      setNumPages(0);
    }
  }, [isOpen, fileUrl, isPdf, isTxt]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // PDF: ajustar ancho de página al contenedor y scroll interno
  useEffect(() => {
    if (!isOpen || !fileUrl || !isPdf) return;
    const node = viewerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setContainerWidth(node.clientWidth - 24));
    ro.observe(node);
    setContainerWidth(node.clientWidth - 24);
    return () => ro.disconnect();
  }, [isOpen, fileUrl, isPdf]);

  if (!isOpen || !fileUrl || !fileName) return null;

  const docs: IDocument[] = [{ uri: fileUrl, fileType: fileExtension }];
  const officeSrc = isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
    : null;

  return createPortal(
    <div style={modalOverlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div id="file-preview-modal" style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h4 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </h4>
          <button onClick={onClose} style={closeButtonStyle} title="Cerrar vista previa">
            <X size={24} />
          </button>
        </div>

        <div style={viewerContainerStyle} ref={viewerRef}>
          {isLoading && !renderError && (
            <div style={loadingOverlayStyle}>
              <Loader2 className="animate-spin" size={32} />
              <p style={{ marginTop: '1rem' }}>Cargando vista previa...</p>
            </div>
          )}

          {renderError && (
            <div style={errorOverlayStyle}>
              <p>❌ No hay vista previa disponible para "{fileName}".</p>
              <a href={fileUrl} download={fileName} className="button secondary" style={{ textDecoration: 'none', marginTop: '1rem' }}>
                Descargar archivo
              </a>
            </div>
          )}

          {isTxt ? (
            txtFailed ? (
              // Fallback si fetch falló (CORS/headers)
              <iframe
                src={fileUrl}
                style={{ width: '100%', height: '100%', border: 0, background: 'var(--bg)' }}
                title={fileName || 'txt-preview'}
              />
            ) : (
              <pre style={{
                margin: 0, padding: '1rem', height: '100%', overflow: 'auto',
                background: 'var(--bg)', color: 'var(--fg)', whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}>
                {txtContent ?? ''}
              </pre>
            )
          ) : isPdf ? (
            <div style={{ height: '100%', overflow: 'auto', padding: '8px 0' }}>
              <PdfDocument
                file={fileUrl}
                onLoadSuccess={({ numPages }) => { setNumPages(numPages); setIsLoading(false); }}
                onLoadError={(e) => { setRenderError(e as any); setIsLoading(false); }}
                loading={null}
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={i + 1}
                    pageNumber={i + 1}
                    width={Math.max(320, containerWidth)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                ))}
              </PdfDocument>
            </div>
          ) : isOffice ? (
            // ✅ Office en iframe propio (sin sandbox) => adiós error de scripts bloqueados
            <iframe
              src={officeSrc!}
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="fullscreen; clipboard-read; clipboard-write"
              title={fileName || 'office-preview'}
            />
          ) : (
            // Otros tipos (imágenes, pdf no-optimizado, etc.) con DocViewer
            <DocViewer
              key={fileUrl}
              documents={docs}
              pluginRenderers={DocViewerRenderers}
              config={{ header: { disableHeader: true } }}
              style={{ visibility: renderError ? 'hidden' : 'visible', height: '100%', width: '100%' }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FilePreviewModal;
