export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
      <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
        <section className="space-y-6">
          <div className="inline-flex rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-sm font-medium text-[var(--color-muted)] shadow-sm">
            Estimate Takeoff
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              PDF Area Measurement for Plans
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
              Self-hosted construction takeoff focused on project setup, PDF
              viewing, page calibration, and polygon area measurement.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--color-border)] bg-white p-8 shadow-[0_24px_80px_rgba(16,24,40,0.12)]">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                MVP Scope
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Build the core takeoff workflow
              </h2>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
              <li>Create projects and upload PDF drawing files.</li>
              <li>Open plan pages in the browser and calibrate each page.</li>
              <li>Draw polygon areas and save square-foot results.</li>
              <li>Persist files, calibrations, and shapes in PostgreSQL.</li>
              <li>Deploy on Ubuntu VPS with Docker Compose.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
