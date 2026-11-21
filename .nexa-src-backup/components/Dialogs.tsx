import { useState, type ReactNode } from 'react';
import { createZip } from '../lib/zip';
import { downloadBlob, downloadText } from '../lib/files';
import type { GeneratedFile } from '../types';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function JsonDialog({ json, filename, onClose }: { json: string; filename: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Modal title="Workflow JSON" onClose={onClose}>
      <pre className="code">{json}</pre>
      <div className="modal__actions">
        <button className="btn" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button className="btn btn-primary" onClick={() => downloadText(filename, json, 'application/json')}>
          Download {filename}
        </button>
      </div>
    </Modal>
  );
}

export function ProjectDialog({ files, zipName, onClose }: { files: GeneratedFile[]; zipName: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const current = files[index];
  return (
    <Modal title="Generated Project" onClose={onClose}>
      <div className="project">
        <ul className="project__files">
          {files.map((f, i) => (
            <li key={f.path}>
              <button className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)}>
                {f.path}
              </button>
            </li>
          ))}
        </ul>
        <pre className="code">{current?.content}</pre>
      </div>
      <div className="modal__actions">
        {current && (
          <button className="btn" onClick={() => downloadText(current.path.split('/').pop() ?? 'file.txt', current.content)}>
            Download this file
          </button>
        )}
        <button className="btn btn-primary" onClick={() => downloadBlob(zipName, createZip(files))}>
          Download all (.zip)
        </button>
      </div>
    </Modal>
  );
}
