import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppHeader from '../components/AppHeader';
import ThemeToggle from '../components/ThemeToggle';
import AppLoader from '../components/AppLoader';
import './ManualUsuario.css';

/** Genera un id tipo slug para usar como ancla (ej: "2.1 Iniciar sesión" → "21-iniciar-sesion") */
function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s*[.\d]+\s*$/g, '') // quitar numeración final tipo "2.1"
    .replace(/^\s*[.\d]+\s*/, '')   // quitar numeración inicial
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

/** Extrae entradas del índice desde el markdown (## y ###) */
function buildToc(md) {
  if (!md) return [];
  const lines = md.split('\n');
  const toc = [];
  const seen = new Set();
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const title = (h2 && h2[1]) || (h3 && h3[1]);
    if (!title) continue;
    const id = slugify(title);
    const key = id || title;
    if (seen.has(key)) continue;
    seen.add(key);
    toc.push({
      id,
      title: title.trim(),
      level: h2 ? 2 : 3,
    });
  }
  return toc;
}

export default function ManualUsuario() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/manual-usuario.md')
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el manual');
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toc = useMemo(() => buildToc(content), [content]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getHeadingText = (children) => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map(getHeadingText).join('');
    if (children?.props?.children) return getHeadingText(children.props.children);
    return '';
  };

  const headingComponent = (level) => {
    const Tag = `h${level}`;
    function ManualHeading({ children, ...props }) {
      const text = getHeadingText(children) || '';
      const id = slugify(text);
      return (
        <Tag id={id} className="manual-heading" {...props}>
          {children}
        </Tag>
      );
    }
    ManualHeading.displayName = `ManualHeading${level}`;
    return ManualHeading;
  };

  const components = useMemo(
    () => ({
      h1: headingComponent(1),
      h2: headingComponent(2),
      h3: headingComponent(3),
      a: ({ href, children, ...props }) => {
        if (href?.startsWith('#')) {
          return (
            <a href={href} onClick={(e) => { e.preventDefault(); scrollToSection(href.slice(1)); }} {...props}>
              {children}
            </a>
          );
        }
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      },
    }),
    []
  );

  return (
    <div className="manual-page">
      <AppHeader
        leftContent={
          <>
            <Link to="/" className="manual-back" title="Volver al panel" aria-label="Volver al panel">
              <svg className="manual-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <h1 className="manual-header-title">Manual de usuario</h1>
          </>
        }
        rightContent={<ThemeToggle />}
      />

      <main className="manual-main">
        {loading && <AppLoader message="Cargando manual..." />}
        {error && (
          <div className="manual-error">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && content && (
          <div className="manual-layout">
            {toc.length > 0 && (
              <nav className="manual-toc" aria-label="Índice del manual">
                <h2 className="manual-toc-title">En esta página</h2>
                <ul className="manual-toc-list">
                  {toc.map((item) => (
                    <li key={item.id} className={`manual-toc-item manual-toc-item--h${item.level}`}>
                      <button
                        type="button"
                        className="manual-toc-link"
                        onClick={() => scrollToSection(item.id)}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <article className="manual-article">
              <div className="manual-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {content}
                </ReactMarkdown>
              </div>
            </article>
          </div>
        )}
      </main>
    </div>
  );
}
