import { useState } from 'react';

// Cafezal brand mark — usa il logo ufficiale (PNG ottimizzato in client/public),
// altrimenti ricade su una SVG placeholder (chicco di caffè in tono espresso).
// I PNG sono rasterizzati dai sorgenti in client/brand-src/*.svg (loghi originali
// ~1.5MB) a misura di display: header ~40px, login 84px → ~30KB totali.

function FallbackMark({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cz-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5a30" />
          <stop offset="1" stopColor="#3b2414" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#cz-grad)" />
      <ellipse cx="24" cy="24" rx="10.5" ry="13.5" fill="#f3e6d6" transform="rotate(20 24 24)" />
      <path d="M20 13 C 27 18, 21 30, 28 35" stroke="#8a5a30" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function LogoImg({ src, size, height, className }) {
  const [err, setErr] = useState(false);
  if (err) return <FallbackMark size={size} className={className} />;
  return (
    <img
      src={src}
      alt="Cafezal"
      style={{ height: height || size, width: 'auto' }}
      className={`object-contain ${className}`}
      onError={() => setErr(true)}
    />
  );
}

// Square-ish mark for the app header.
export function BrandMark({ size = 48, className = '' }) {
  return <LogoImg src="/cafezal-mark.png" size={size} className={className} />;
}

// Larger logo (può essere il lockup completo) per il login.
export function BrandLogo({ height = 72, className = '' }) {
  return <LogoImg src="/cafezal-logo.png" size={height} height={height} className={className} />;
}
