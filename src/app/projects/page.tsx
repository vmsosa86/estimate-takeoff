import Link from "next/link";

import { createProjectAction, deleteProjectAction } from "@/app/actions/project-actions";
import { NoticeBanner } from "@/components/projects/notice-banner";
import { ProjectShell } from "@/components/projects/project-shell";
import { listProjects } from "@/lib/projects/service";

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const projects = await listProjects();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const error = getSearchParam(resolvedParams?.error);
  const success = getSearchParam(resolvedParams?.success);

  return (
    <ProjectShell title="Estimate Takeoff" subtitle="PDF Area Measurement for Plans">
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                New Project
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Start a takeoff set</h2>
            </div>
            <NoticeBanner error={error} success={success} />
            <form action={createProjectAction} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Project name
                </span>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="Example: Pine Street Renovation"
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-accent)]"
                />
              </label>
              <button className="inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
                Create project
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                Projects
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Saved takeoff workspaces
              </h2>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4">
            {projects.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-strong)] px-6 py-12 text-center text-[var(--color-muted)]">
                No projects yet. Create the first one to start uploading plans.
              </div>
            ) : (
              projects.map((project) => (
                <article
                  key={project.id}
                  className="grid gap-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 shadow-sm lg:grid-cols-[1fr_auto]"
                >
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold">{project.name}</h3>
                      <p className="text-sm text-[var(--color-muted)]">
                        {project.fileCount} file{project.fileCount === 1 ? "" : "s"} •{" "}
                        {project.pageCount} total page
                        {project.pageCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--color-muted)]">
                      Updated {new Date(project.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      Open
                    </Link>
                    <form action={deleteProjectAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <button
                        className="inline-flex rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        formAction={deleteProjectAction}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </ProjectShell>
  );
}
