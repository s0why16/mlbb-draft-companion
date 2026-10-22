import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Hero } from '../types';
import { cn } from '../lib/cn';

const STATUS = {
  buff: { label: 'BUFFED', Icon: ArrowUpRight },
  nerf: { label: 'NERFED', Icon: ArrowDownRight },
  adjust: { label: 'ADJUSTED', Icon: Minus },
} as const;

export function PatchBadge({
  hero,
  compact = false,
  className,
}: {
  hero: Hero;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const patch = hero.patch;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!patch) return null;
  const meta = STATUS[patch.status];
  const Icon = meta.Icon;

  return (
    <span
      ref={wrapperRef}
      className={cn('patch', `patch--${patch.status}`, compact && 'patch--compact', open && 'is-open', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="patch__trigger"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!wrapperRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        }}
      >
        <Icon size={compact ? 10 : 11} strokeWidth={2.6} />
        <span>{compact ? '' : meta.label}</span>
      </button>
      {open && (
        <span className="patch__tip" role="tooltip" id={tipId}>
          <span className="patch__tip-head">
            <strong>{meta.label}</strong>
            <em>Patch {patch.patch}</em>
          </span>
          <span>{patch.note}</span>
        </span>
      )}
    </span>
  );
}

export function PatchDot({ hero }: { hero: Hero }) {
  if (!hero.patch) return null;
  return <span className={`patch-dot patch-dot--${hero.patch.status}`} title={`${hero.patch.status === 'buff' ? 'Buffed' : hero.patch.status === 'nerf' ? 'Nerfed' : 'Adjusted'} · Patch ${hero.patch.patch}`} />;
}
