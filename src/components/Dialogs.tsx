import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createZip } from '../lib/zip';
import { downloadBlob, downloadText } from '../lib/files';
import { EXAMPLES, type WorkflowExample } from '../examples';
import type { GeneratedFile } from '../types';
import { CloseIcon } from './icons';

function Modal({ title, meta, onClose, size, children }: { title: string; meta?: string; onClose: () => void; size?: 'small'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), pre[tabindex="0"]');
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === ref.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'small' ? 'modal--small' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="modal__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {meta && <p className="modal__meta">{meta}</p>}
          </div>
          <button className="btn btn-icon btn-quiet" onClick={onClose} aria-label="Close dialog" title="Close (Esc)">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard unavailable: ignore */
    }
  };
  return (
    <button className="btn btn-sm" onClick={copy}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function JsonDialog({ json, filename, summary, onClose }: { json: string; filename: string; summary: string; onClose: () => void }) {
  return (
    <Modal title="Workflow JSON" meta={`${summary} · ${formatBytes(json.length)}`} onClose={onClose}>
      <div className="code-wrap">
        <div className="code-wrap__bar">
          <span>{filename}</span>
          <CopyButton text={json} />
        </div>
        <pre className="code" tabIndex={0} aria-label="Workflow JSON">
          {json}
        </pre>
      </div>
      <div className="modal__foot">
        <span className="modal__note">Exported from your canvas in this browser.</span>
        <button className="btn btn-primary" onClick={() => downloadText(filename, json, 'application/json')}>
          Download JSON
        </button>
      </div>
    </Modal>
  );
}

export function ProjectDialog({ files, zipName, onClose }: { files: GeneratedFile[]; zipName: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const current = files[index];
  const total = files.reduce((sum, f) => sum + f.content.length, 0);
  return (
    <Modal title="Generated project" meta={`${files.length} files · ${formatBytes(total)}`} onClose={onClose}>
      <div className="project">
        <ul className="project__files" aria-label="Generated files">
          {files.map((f, i) => (
            <li key={f.path}>
              <button className={i === index ? 'is-active' : ''} aria-current={i === index} onClick={() => setIndex(i)}>
                {f.path}
              </button>
            </li>
          ))}
        </ul>
        <div className="code-wrap">
          <div className="code-wrap__bar">
            <span>{current?.path}</span>
            <span className="code-wrap__actions">
              {current && <CopyButton text={current.content} />}
              {current && (
                <button className="btn btn-sm" onClick={() => downloadText(current.path.split('/').pop() ?? 'file.txt', current.content)}>
                  Download file
                </button>
              )}
            </span>
          </div>
          <pre className="code" tabIndex={0} aria-label={`Contents of ${current?.path ?? 'file'}`}>
            {current?.content}
          </pre>
        </div>
      </div>
      <div className="modal__foot">
        <span className="modal__note">Generated locally in your browser. Nothing is uploaded.</span>
        <button className="btn btn-primary" onClick={() => downloadBlob(zipName, createZip(files))}>
          Download all (.zip)
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  showCancel = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  showCancel?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} size="small">
      <p className="modal__text">{message}</p>
      <div className="modal__foot modal__foot--end">
        {showCancel && (
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className={danger ? 'btn btn-danger btn-inline' : 'btn btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function GalleryDialog({ onLoad, onClose }: { onLoad: (example: WorkflowExample) => void; onClose: () => void }) {
  return (
    <Modal title="Example workflows" meta="Ready-made, software-only workflows. Loading one replaces the canvas." onClose={onClose}>
      <ul className="gallery" aria-label="Example workflows">
        {EXAMPLES.map((example) => {
          const { nodes, edges } = example.build();
          return (
            <li className="example" key={example.id}>
              <h3>{example.title}</h3>
              <p>{example.summary}</p>
              <ul aria-label={`What ${example.title} shows`}>
                {example.teaches.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <p className="example__meta">
                {nodes.length} blocks · {edges.length} connections · simulated data
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => onLoad(example)} aria-label={`Load ${example.title}`}>
                Load example
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
