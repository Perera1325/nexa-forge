import { useEffect, useRef, useState } from 'react';
import { GUIDE_STEPS } from '../guide/steps';
import { CloseIcon } from './icons';

/** Optional, non-blocking walkthrough. It never covers the canvas controls and closes with Esc, the close button or "Skip guide". */
export function Guide({ onClose, onBrowseExamples }: { onClose: () => void; onBrowseExamples: () => void }) {
  const [index, setIndex] = useState(0);
  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="guide" aria-label="Guided first workflow" ref={ref}>
      <div className="guide__head">
        <p className="guide__count">
          Step {index + 1} of {GUIDE_STEPS.length}
        </p>
        <button className="btn btn-icon btn-quiet" onClick={onClose} aria-label="Close guide" title="Close guide (Esc)">
          <CloseIcon />
        </button>
      </div>
      <h2 className="guide__title">{step.title}</h2>
      <p className="guide__body">{step.body}</p>
      <p className="guide__try">
        <strong>Try it:</strong> {step.tryIt}
      </p>
      {index === 0 && (
        <button className="btn btn-sm" onClick={onBrowseExamples}>
          Browse examples
        </button>
      )}
      <div className="guide__foot">
        <button className="btn btn-sm btn-quiet" onClick={onClose}>
          Skip guide
        </button>
        <span className="guide__nav">
          <button className="btn btn-sm" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            Back
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
        </span>
      </div>
    </section>
  );
}
