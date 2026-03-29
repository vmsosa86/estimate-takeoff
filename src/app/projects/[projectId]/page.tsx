import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteProjectAction,
  renameProjectAction,
  uploadProjectFileAction,
} from "@/app/actions/project-actions";
import { NoticeBanner } from "@/components/projects/notice-banner";
import { ProjectShell } from "@/components/projects/project-shell";
import { getProjectDetail } from "@/lib/projects/service";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const detail = await getProjectDetail(projectId);

  if (!detail) {
    notFound();
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const error = getSearchParam(resolvedParams?.error);
  const success = getSearchParam(resolvedParams?.success);

  return (
    <ProjectShell title={detail.project.name} subtitle="Project files and plan sets">
      <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-6 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Project Settings
            </p>
            <h2 className="text-2xl font-semibold">Manage project details</h2>
          </div>

          <NoticeBanner error={error} success={success} />

          <form action={renameProjectAction} className="space-y-4">
            <input type="hidden" name="projectId" value={detail.project.id} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Project name
              </span>
              <input
                required
                name="name"
                type="text"
                defaultValue={detail.project.name}
                className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-accent)]"
              />
            </label>
            <button className="inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
              Save project name
            </button>
          </form>

          <div className="border-t border-[var(--color-border)] pt-6">
            <form action={uploadProjectFileAction} className="space-y-4">
              <input type="hidden" name="projectId" value={detail.project.id} />
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)]">
                  Upload PDF drawings
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  PDF files only. Uploaded plans are stored on local disk.
                </p>
              </div>
              <input
                required
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-muted)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <button className="inline-flex rounded-full border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                Upload PDF
              </button>
            </form>
          </div>

          <div className="border-t border-[var(--color-border)] pt-6">
            <form action={deleteProjectAction}>
              <input type="hidden" name="projectId" value={detail.project.id} />
              <button className="inline-flex rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
                Delete project
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                Project Files
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Uploaded plan drawings
              </h2>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              {detail.files.length} file{detail.files.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4">
            {detail.files.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-strong)] px-6 py-12 text-center text-[var(--color-muted)]">
                No PDFs uploaded yet.
              </div>
            ) : (
              detail.files.map((file) => (
                <article
                  key={file.id}
                  className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{file.originalName}</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      {file.pageCount} page{file.pageCount === 1 ? "" : "s"} •
                      Uploaded {new Date(file.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/projects/${detail.project.id}/files/${file.id}/viewer`}
                    className="inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Open viewer
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </ProjectShell>
  );
}
