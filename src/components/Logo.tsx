export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 2 44 13.5v21L24 46 4 34.5v-21L24 2Z" fill="url(#logo-fill)" stroke="rgba(137,242,255,.7)" strokeWidth="1.4" />
      <path d="M14 33V17l10 9 10-9v16" stroke="#041019" strokeWidth="4.2" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M14 33V17l10 9 10-9v16" stroke="#dffbff" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M24 2v9M44 13.5l-8 4.6M4 13.5l8 4.6" stroke="rgba(137,242,255,.45)" strokeWidth="1" />
      <defs>
        <linearGradient id="logo-fill" x1="10" y1="6" x2="38" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12b8d8" />
          <stop offset="1" stopColor="#0a2740" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <LogoMark className="brand__mark" />
      {!compact && (
        <span className="brand__type">
          <span className="brand__name">Draft Companion</span>
          <span className="brand__sub">MLBB · AI DRAFT LAB</span>
        </span>
      )}
    </span>
  );
}
