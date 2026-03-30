"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Circle, Layer, Line, Stage } from "react-konva";

import { formatSqFt } from "@/lib/math/measurement";
import type {
  AreaShape,
  PageCalibration,
  Point,
  ViewerPageData,
} from "@/lib/types";

type ViewerTool = "select" | "calibrate" | "draw";

type PdfViewerClientProps = {
  fileUrl: string;
  projectId: string;
  viewerData: ViewerPageData;
};

type PdfDocumentProxy = {
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void>; cancel?: () => void };
  }>;
  destroy: () => Promise<void>;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: string) => { promise: Promise<PdfDocumentProxy> };
};

const TOOL_LABELS: Record<ViewerTool, string> = {
  select: "Select",
  calibrate: "Calibrate",
  draw: "Draw Area",
};

function getCalibrationPoints(calibration: PageCalibration | null): Point[] {
  if (!calibration) {
    return [];
  }

  return [
    { x: calibration.point1X, y: calibration.point1Y },
    { x: calibration.point2X, y: calibration.point2Y },
  ];
}

function pointsToFlatArray(points: Point[], scale: number): number[] {
  return points.flatMap((point) => [point.x * scale, point.y * scale]);
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export function PdfViewerClient({
  fileUrl,
  projectId,
  viewerData,
}: PdfViewerClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [documentProxy, setDocumentProxy] = useState<PdfDocumentProxy | null>(null);
  const [tool, setTool] = useState<ViewerTool>("select");
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [shapes, setShapes] = useState<AreaShape[]>(viewerData.shapes);
  const [calibration, setCalibration] = useState<PageCalibration | null>(
    viewerData.calibration,
  );
  const [draftCalibration, setDraftCalibration] = useState<Point[]>([]);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [shapeName, setShapeName] = useState("");
  const [calibrationFeet, setCalibrationFeet] = useState("0");
  const [calibrationInches, setCalibrationInches] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPage = viewerData.currentPage;
  const currentPageIndex = viewerData.pages.findIndex(
    (page) => page.id === currentPage.id,
  );
  const scale = fitWidth && containerWidth
    ? containerWidth / currentPage.widthPx
    : zoom;
  const totalSqFt = shapes.reduce(
    (sum, shape) => sum + (shape.areaSqFeet ?? 0),
    0,
  );
  const selectedShape =
    shapes.find((shape) => shape.id === selectedShapeId) ?? null;
  const calibrationPoints =
    draftCalibration.length > 0 ? draftCalibration : getCalibrationPoints(calibration);

  useEffect(() => {
    setShapes(viewerData.shapes);
    setCalibration(viewerData.calibration);
    setDraftCalibration([]);
    setDraftPolygon([]);
    setSelectedShapeId(null);
    setShapeName("");
    setError(null);
  }, [viewerData]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.max(nextWidth - 32, 240));
    });

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      const pdfjs = (await import("pdfjs-dist/build/pdf.mjs")) as PdfJsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const loadingTask = pdfjs.getDocument(fileUrl);
      const loadedDocument = await loadingTask.promise;

      if (isCancelled) {
        await loadedDocument.destroy();
        return;
      }

      setDocumentProxy(loadedDocument);
    }

    loadPdf().catch(() => {
      setError("The PDF could not be rendered in the browser.");
    });

    return () => {
      isCancelled = true;
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!documentProxy || !canvasRef.current) {
      return undefined;
    }

    const loadedDocument = documentProxy;
    const canvas = canvasRef.current;
    let isCancelled = false;
    let renderTask: { promise: Promise<void>; cancel?: () => void } | null = null;

    async function renderCurrentPage() {
      const page = await loadedDocument.getPage(currentPage.pageNumber);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d");

      if (!context || isCancelled) {
        return;
      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * devicePixelRatio;
      canvas.height = viewport.height * devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      await renderTask.promise;
    }

    renderCurrentPage().catch(() => {
      setError("The PDF page could not be rendered.");
    });

    return () => {
      isCancelled = true;
      renderTask?.cancel?.();
    };
  }, [currentPage.pageNumber, documentProxy, scale]);

  function setPage(pageNumber: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNumber));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function resetDraftState(nextTool: ViewerTool) {
    setTool(nextTool);
    setDraftCalibration([]);
    setDraftPolygon([]);
    setShapeName("");
    setError(null);
  }

  function getScaledPointer(point: Point): Point {
    return {
      x: point.x / scale,
      y: point.y / scale,
    };
  }

  function handleStagePointer(point: Point) {
    if (tool === "calibrate") {
      setDraftCalibration((current) => {
        if (current.length === 2) {
          return [getScaledPointer(point)];
        }

        return [...current, getScaledPointer(point)];
      });
      return;
    }

    if (tool === "draw") {
      setDraftPolygon((current) => [...current, getScaledPointer(point)]);
      return;
    }

    setSelectedShapeId(null);
  }

  async function saveCalibration() {
    if (draftCalibration.length !== 2) {
      setError("Pick two calibration points on the page.");
      return;
    }

    try {
      const payload = {
        point1: draftCalibration[0],
        point2: draftCalibration[1],
        feet: Number(calibrationFeet),
        inches: Number(calibrationInches),
      };
      const result = await requestJson<{ calibration: PageCalibration }>(
        `/api/pages/${currentPage.id}/calibration`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setCalibration(result.calibration);
      setDraftCalibration([]);
      setError(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Calibration could not be saved.",
      );
    }
  }

  async function savePolygon() {
    if (draftPolygon.length < 3) {
      setError("Add at least three points to create an area.");
      return;
    }

    if (!shapeName.trim()) {
      setError("Name the area before saving it.");
      return;
    }

    try {
      const result = await requestJson<{ shape: AreaShape }>(
        `/api/pages/${currentPage.id}/shapes`,
        {
          method: "POST",
          body: JSON.stringify({
            name: shapeName.trim(),
            points: draftPolygon,
          }),
        },
      );

      setShapes((current) => [...current, result.shape]);
      setDraftPolygon([]);
      setShapeName("");
      setSelectedShapeId(result.shape.id);
      setTool("select");
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Area could not be saved.",
      );
    }
  }

  async function updateSelectedShape(updates: {
    name?: string;
    points?: Point[];
  }) {
    if (!selectedShape) {
      return;
    }

    try {
      const result = await requestJson<{ shape: AreaShape }>(
        `/api/shapes/${selectedShape.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        },
      );

      setShapes((current) =>
        current.map((shape) =>
          shape.id === result.shape.id ? result.shape : shape,
        ),
      );
      setSelectedShapeId(result.shape.id);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Area could not be updated.",
      );
    }
  }

  async function deleteSelectedShape() {
    if (!selectedShape) {
      setError("Select an area to delete.");
      return;
    }

    try {
      await requestJson<{ ok: true }>(`/api/shapes/${selectedShape.id}`, {
        method: "DELETE",
      });

      setShapes((current) =>
        current.filter((shape) => shape.id !== selectedShape.id),
      );
      setSelectedShapeId(null);
      setError(null);
    } catch {
      setError("Area could not be deleted.");
    }
  }

  const pageHref = `/projects/${projectId}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border)] px-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TOOL_LABELS) as ViewerTool[]).map((toolName) => (
              <button
                key={toolName}
                type="button"
                onClick={() => resetDraftState(toolName)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tool === toolName
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-accent)]"
                }`}
              >
                {TOOL_LABELS[toolName]}
              </button>
            ))}
            <button
              type="button"
              onClick={deleteSelectedShape}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Delete
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              disabled={currentPageIndex <= 0 || isPending}
              onClick={() => setPage(viewerData.pages[currentPageIndex - 1].pageNumber)}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="rounded-full border border-[var(--color-border)] px-4 py-2">
              Page {currentPage.pageNumber} / {viewerData.pages.length}
            </span>
            <button
              type="button"
              disabled={
                currentPageIndex >= viewerData.pages.length - 1 || isPending
              }
              onClick={() => setPage(viewerData.pages[currentPageIndex + 1].pageNumber)}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 disabled:opacity-50"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => {
                setFitWidth(false);
                setZoom((current) => Math.min(current + 0.1, 4));
              }}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2"
            >
              Zoom In
            </button>
            <button
              type="button"
              onClick={() => {
                setFitWidth(false);
                setZoom((current) => Math.max(current - 0.1, 0.3));
              }}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2"
            >
              Zoom Out
            </button>
            <button
              type="button"
              onClick={() => setFitWidth(true)}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2"
            >
              Fit Width
            </button>
          </div>
        </div>

        <div ref={containerRef} className="mt-4 h-[72vh] overflow-auto rounded-2xl bg-[#d8d2c6] p-4">
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="block rounded-xl bg-white shadow-lg" />
            <Stage
              width={currentPage.widthPx * scale}
              height={currentPage.heightPx * scale}
              className="!absolute left-0 top-0"
              onMouseDown={(event) => {
                if (tool === "select" && event.target !== event.target.getStage()) {
                  return;
                }

                const pointerPosition = event.target.getStage()?.getPointerPosition();

                if (!pointerPosition) {
                  return;
                }

                handleStagePointer(pointerPosition);
              }}
              onDblClick={() => {
                if (tool === "draw" && draftPolygon.length >= 3) {
                  void savePolygon();
                }
              }}
            >
              <Layer>
                {shapes.map((shape) => {
                  const isSelected = shape.id === selectedShapeId;

                  return (
                    <Line
                      key={shape.id}
                      points={pointsToFlatArray(shape.points, scale)}
                      closed
                      fill={isSelected ? "rgba(155,93,51,0.22)" : "rgba(44,111,187,0.18)"}
                      stroke={isSelected ? "#9b5d33" : "#2c6fbb"}
                      strokeWidth={isSelected ? 3 : 2}
                      onClick={() => {
                        setSelectedShapeId(shape.id);
                        setTool("select");
                        setShapeName(shape.name);
                      }}
                    />
                  );
                })}

                {draftPolygon.length > 0 ? (
                  <Line
                    points={pointsToFlatArray(draftPolygon, scale)}
                    stroke="#9b5d33"
                    strokeWidth={2}
                    closed={draftPolygon.length >= 3}
                    fill="rgba(155,93,51,0.15)"
                  />
                ) : null}

                {calibrationPoints.length === 2 ? (
                  <Line
                    points={pointsToFlatArray(calibrationPoints, scale)}
                    stroke="#c44900"
                    strokeWidth={3}
                    dash={[10, 6]}
                  />
                ) : null}

                {selectedShape?.points.map((point, index) => (
                  <Circle
                    key={`${selectedShape.id}-${index}`}
                    x={point.x * scale}
                    y={point.y * scale}
                    radius={7}
                    fill="#fff"
                    stroke="#9b5d33"
                    strokeWidth={2}
                    draggable
                    onDragMove={(event) => {
                      const nextPosition = event.target.position();
                      setShapes((current) =>
                        current.map((shape) =>
                          shape.id === selectedShape.id
                            ? {
                                ...shape,
                                points: shape.points.map((shapePoint, shapeIndex) =>
                                  shapeIndex === index
                                    ? {
                                        x: nextPosition.x / scale,
                                        y: nextPosition.y / scale,
                                      }
                                    : shapePoint,
                                ),
                              }
                            : shape,
                        ),
                      );
                    }}
                    onDragEnd={(event) => {
                      const nextPosition = event.target.position();
                      const nextPoints = selectedShape.points.map(
                        (shapePoint, shapeIndex) =>
                          shapeIndex === index
                            ? {
                                x: nextPosition.x / scale,
                                y: nextPosition.y / scale,
                              }
                            : shapePoint,
                      );
                      void updateSelectedShape({ points: nextPoints });
                    }}
                  />
                ))}

                {draftCalibration.map((point, index) => (
                  <Circle
                    key={`calibration-${index}`}
                    x={point.x * scale}
                    y={point.y * scale}
                    radius={6}
                    fill="#c44900"
                  />
                ))}

                {draftPolygon.map((point, index) => (
                  <Circle
                    key={`draft-${index}`}
                    x={point.x * scale}
                    y={point.y * scale}
                    radius={5}
                    fill="#9b5d33"
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                File Info
              </p>
              <h2 className="mt-2 break-words text-xl font-semibold leading-tight">
                {viewerData.file.originalName}
              </h2>
            </div>
            <Link
              href={pageHref}
              className="shrink-0 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
            >
              Back
            </Link>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
            <div className="flex justify-between gap-4">
              <dt>Project</dt>
              <dd className="text-right text-[var(--color-foreground)]">
                {viewerData.project.name}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Current page</dt>
              <dd className="text-right text-[var(--color-foreground)]">
                {currentPage.pageNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Calibration</dt>
              <dd className="text-right text-[var(--color-foreground)]">
                {calibration ? "Calibrated" : "Not calibrated"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Total area</dt>
              <dd className="text-right text-[var(--color-foreground)]">
                {calibration ? formatSqFt(totalSqFt) : "Unavailable"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Calibration
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Pick two points on the PDF, then enter the real-world distance.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Feet
              </span>
              <input
                value={calibrationFeet}
                onChange={(event) => setCalibrationFeet(event.target.value)}
                type="number"
                min="0"
                className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Inches
              </span>
              <input
                value={calibrationInches}
                onChange={(event) => setCalibrationInches(event.target.value)}
                type="number"
                min="0"
                max="11.999"
                step="0.01"
                className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetDraftState("calibrate")}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
            >
              Start calibration
            </button>
            <button
              type="button"
              onClick={() => void saveCalibration()}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Save calibration
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Areas
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Draw polygon areas on the current page. Double-click the page to finish a polygon.
            </p>
          </div>

          {tool === "draw" ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Area name
                </span>
                <input
                  value={shapeName}
                  onChange={(event) => setShapeName(event.target.value)}
                  placeholder="Living Room"
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                />
              </label>
              <p className="text-sm text-[var(--color-muted)]">
                {draftPolygon.length} point{draftPolygon.length === 1 ? "" : "s"} added
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void savePolygon()}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Save area
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPolygon([])}
                  className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
                >
                  Clear draft
                </button>
              </div>
            </div>
          ) : null}

          {selectedShape ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Selected area
                </span>
                <input
                  value={shapeName || selectedShape.name}
                  onChange={(event) => setShapeName(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                />
              </label>
              <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
                <span>Measured area</span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {selectedShape.areaSqFeet === null
                    ? "Unavailable"
                    : formatSqFt(selectedShape.areaSqFeet)}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void updateSelectedShape({
                    name: (shapeName || selectedShape.name).trim(),
                  })
                }
                className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Rename area
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {shapes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                No saved areas on this page.
              </div>
            ) : (
              shapes.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => {
                    setSelectedShapeId(shape.id);
                    setShapeName(shape.name);
                    setTool("select");
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    shape.id === selectedShapeId
                      ? "border-[var(--color-accent)] bg-[rgba(155,93,51,0.08)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  <span>
                    <span className="block font-medium">{shape.name}</span>
                    <span className="text-sm text-[var(--color-muted)]">
                      {shape.points.length} points
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-foreground)]">
                    {shape.areaSqFeet === null
                      ? "Unavailable"
                      : formatSqFt(shape.areaSqFeet)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {error ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </section>
        ) : null}
      </aside>
    </div>
  );
}
