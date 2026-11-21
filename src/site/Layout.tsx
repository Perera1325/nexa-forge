import { useState, type ReactNode } from 'react';
import './site.css';
import { LogoMark } from '../components/icons';
import { Link } from '../Link';
import { useRoute, useTitle } from '../router';
import { REPO_URL } from './links';

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title);
  const route = useRoute();
  return (
    <div className="site">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-brand" aria-label="NEXA Forge home">
            <span className="brand__mark">
              <LogoMark />
            </span>
            <span className="brand__name">NEXA Forge</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href="/" aria-current={route === 'home' ? 'page' : undefined}>
              Overview
            </Link>
            <Link href="/docs" aria-current={route === 'docs' ? 'page' : undefined}>
              Docs
            </Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link href="/studio" className="btn btn-primary site-nav__cta">
              Open Studio
            </Link>
          </nav>
        </div>
      </header>
      <main id="content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="wrap site-footer__inner">
          <p>
            NEXA Forge is an early-stage developer preview created by Vinod Perera. No license has been selected yet.
          </p>
          <ul className="site-footer__links">
            <li>
              <Link href="/docs">Documentation</Link>
            </li>
            <li>
              <Link href="/studio">Studio</Link>
            </li>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

/** A code block with a Copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  };
  return (
    <div className="site-code">
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
      <button className="btn btn-sm site-code__copy" onClick={copy} aria-label={label ? `Copy ${label}` : 'Copy code'}>
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
