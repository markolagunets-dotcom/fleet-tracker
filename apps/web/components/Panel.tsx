'use client';

import { useState, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Stays visible in the header when the panel is collapsed — badges, counters, actions. */
  header?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible sidebar section.
 *
 * The console packs three panels into a fixed-width column, so the last one gets
 * squeezed as soon as it has content. Letting the operator fold the ones they are
 * not using is cheaper than guessing a split.
 */
export function Panel({
  title,
  header,
  children,
  defaultOpen = true,
}: PanelProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-200 hover:text-white"
        >
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 text-slate-500 transition-transform duration-150 ${
              open ? 'rotate-90' : ''
            }`}
          >
            <path
              d="M4 2.5 L8 6 L4 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {title}
        </button>
        {header}
      </div>

      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
