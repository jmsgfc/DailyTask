interface PagePlaceholderProps {
  title: string;
  note: string;
}

export function PagePlaceholder({ title, note }: PagePlaceholderProps) {
  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {title}
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
        {note}
      </div>
    </>
  );
}
