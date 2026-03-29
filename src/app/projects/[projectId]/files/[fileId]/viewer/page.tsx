import { notFound } from "next/navigation";

import { ProjectShell } from "@/components/projects/project-shell";
import { PdfViewerClient } from "@/components/viewer/pdf-viewer-client";
import { getViewerData } from "@/lib/projects/service";

export const dynamic = "force-dynamic";

type ViewerPageProps = {
  params: Promise<{ projectId: string; fileId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ViewerPage({
  params,
  searchParams,
}: ViewerPageProps) {
  const { projectId, fileId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageParam = resolvedSearchParams?.page;
  const requestedPageNumber = Number(
    Array.isArray(pageParam) ? pageParam[0] : pageParam ?? "1",
  );
  const viewerData = await getViewerData(fileId, requestedPageNumber);

  if (!viewerData || viewerData.project.id !== projectId) {
    notFound();
  }

  return (
    <ProjectShell
      title="Estimate Takeoff"
      subtitle="PDF Area Measurement for Plans"
    >
      <PdfViewerClient
        fileUrl={`/api/files/${fileId}/content`}
        projectId={projectId}
        viewerData={viewerData}
      />
    </ProjectShell>
  );
}
