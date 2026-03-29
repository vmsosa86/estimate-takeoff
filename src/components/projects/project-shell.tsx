import Link from "next/link";

type ProjectShellProps = {
  children: React.ReactNode;
  subtitle?: string;
  title?: string;
};

export function ProjectShell({
  children,
  subtitle = "PDF Area Measurement for Plans",
  title = "Estimate Takeoff",
}: ProjectShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(155,93,51,0.12),_transparent_36%),linear-gradient(180deg,_#f8f3ea_0%,_#f2ede4_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-6 py-5 shadow-[0_20px_60px_rgba(28,39,54,0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link href="/projects" className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--color-accent)]">
              Estimate Takeoff
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-[var(--color-muted)]">{subtitle}</p>
            </div>
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            Self-hosted area takeoff MVP
          </div>
        </header>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}
