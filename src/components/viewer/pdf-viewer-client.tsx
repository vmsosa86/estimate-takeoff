"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Circle, Layer, Line, Stage, Text } from "react-konva";

import {
  calculateMeasuredArea,
  calculatePolygonPixelArea,
  formatSqFt,
  getPixelDistance,
} from "@/lib/math/measurement";
import type {
  AreaShape,
  PageCalibration,
  Point,
  ShapeKind,
  ShapeOperation,
  ViewerPageData,
} from "@/lib/types";

type ViewerTool =
  | "select"
  | "move"
  | "calibrate"
  | "polygon"
  | "rectangle"
  | "deduct";

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

type MeasurementGroup = {
  name: string;
  shapes: AreaShape[];
  totalSqFt: number | null;
};

const DEFAULT_GROUP_NAME = "Ungrouped";
const DEFAULT_COLORS = [
  "#cf5c36",
  "#2c6fbb",
  "#2a9d8f",
  "#8f5ed9",
  "#c0392b",
  "#6b8e23",
];

const TOOL_LABELS: Record<ViewerTool, string> = {
  select: "Select",
  move: "Move",
  calibrate: "Scale",
  polygon: "Polygon",
  rectangle: "Rectangle",
  deduct: "Deduct",
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

function normalizeGroupName(groupName: string | null | undefined): string | null {
  const trimmed = groupName?.trim();
  return trimmed ? trimmed : null;
}

function buildRectanglePoints(start: Point, end: Point): Point[] {
  return [
    { x: start.x, y: start.y },
    { x: end.x, y: start.y },
    { x: end.x, y: end.y },
    { x: start.x, y: end.y },
  ];
}

function hexToRgba(colorHex: string, alpha: number): string {
  const sanitized = colorHex.replace("#", "");

  if (sanitized.length !== 6) {
    return `rgba(44, 111, 187, ${alpha})`;
  }

  const red = Number.parseInt(sanitized.slice(0, 2), 16);
  const green = Number.parseInt(sanitized.slice(2, 4), 16);
  const blue = Number.parseInt(sanitized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getSignedAreaSqFeet(shape: AreaShape): number | null {
  if (shape.areaSqFeet === null) {
    return null;
  }

  return shape.operation === "deduct" ? -shape.areaSqFeet : shape.areaSqFeet;
}

function formatLengthFromPoints(
  point1: Point,
  point2: Point,
  calibration: PageCalibration | null,
): string {
  const pixelDistance = getPixelDistance(point1, point2);

  if (!calibration) {
    return `${pixelDistance.toFixed(0)} px`;
  }

  const inches = pixelDistance * calibration.inchesPerPixel;
  const feet = inches / 12;

  return `${feet.toFixed(2)} ft`;
}

function formatPreviewArea(
  points: Point[],
  calibration: PageCalibration | null,
  operation: ShapeOperation,
): string {
  if (points.length < 3) {
    return "Area preview unavailable";
  }

  const measured = calculateMeasuredArea(
    calculatePolygonPixelArea(points),
    calibration?.inchesPerPixel ?? null,
  );

  if (measured.areaSqFeet === null) {
    return "Area preview unavailable until page is calibrated";
  }

  const prefix = operation === "deduct" ? "-" : "";

  return `${prefix}${formatSqFt(measured.areaSqFeet)}`;
}

function getNextShapeName(
  kind: ShapeKind,
  operation: ShapeOperation,
  shapes: AreaShape[],
): string {
  const prefix =
    operation === "deduct"
      ? kind === "rectangle"
        ? "Deduction Rectangle"
        : "Deduction Polygon"
      : kind === "rectangle"
        ? "Rectangle"
        : "Polygon";

  const count = shapes.filter(
    (shape) => shape.kind === kind && shape.operation === operation,
  ).length;

  return `${prefix} ${count + 1}`;
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

function PdfPageThumbnail({
  documentProxy,
  heightPx,
  isActive,
  onClick,
  pageNumber,
  widthPx,
}: {
  documentProxy: PdfDocumentProxy | null;
  heightPx: number;
  isActive: boolean;
  onClick: () => void;
  pageNumber: number;
  widthPx: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!documentProxy || !canvasRef.current) {
      return undefined;
    }

    const loadedDocument = documentProxy;
    let isCancelled = false;
    let renderTask: { promise: Promise<void>; cancel?: () => void } | null = null;

    async function renderThumbnail() {
      const page = await loadedDocument.getPage(pageNumber);
      const maxWidth = 144;
      const baseScale = maxWidth / widthPx;
      const viewport = page.getViewport({ scale: baseScale });
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!canvas || !context || isCancelled) {
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

    renderThumbnail().catch(() => undefined);

    return () => {
      isCancelled = true;
      renderTask?.cancel?.();
    };
  }, [documentProxy, pageNumber, widthPx]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-2 text-left transition ${
        isActive
          ? "border-[var(--color-accent)] bg-[rgba(155,93,51,0.08)]"
          : "border-[var(--color-border)] bg-white"
      }`}
    >
      <canvas
        ref={canvasRef}
        width={widthPx}
        height={heightPx}
        className="block w-full rounded-lg bg-white shadow-sm"
      />
      <div className="mt-2 flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
        <span>Page {pageNumber}</span>
        <span>{Math.round(widthPx)} × {Math.round(heightPx)}</span>
      </div>
    </button>
  );
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
  const [lineWidth, setLineWidth] = useState(1);
  const [shapes, setShapes] = useState<AreaShape[]>(viewerData.shapes);
  const [calibration, setCalibration] = useState<PageCalibration | null>(
    viewerData.calibration,
  );
  const [draftCalibration, setDraftCalibration] = useState<Point[]>([]);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [draftRectangleAnchor, setDraftRectangleAnchor] = useState<Point | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [deductKind, setDeductKind] = useState<ShapeKind>("rectangle");
  const [shapeName, setShapeName] = useState("");
  const [shapeGroupName, setShapeGroupName] = useState(DEFAULT_GROUP_NAME);
  const [newGroupName, setNewGroupName] = useState("");
  const [shapeColorHex, setShapeColorHex] = useState(DEFAULT_COLORS[0]);
  const [shapeOperation, setShapeOperation] = useState<ShapeOperation>("add");
  const [calibrationFeet, setCalibrationFeet] = useState("0");
  const [calibrationInches, setCalibrationInches] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPage = viewerData.currentPage;
  const currentPageIndex = viewerData.pages.findIndex(
    (page) => page.id === currentPage.id,
  );
  const scale =
    fitWidth && containerWidth ? containerWidth / currentPage.widthPx : zoom;
  const selectedShape =
    shapes.find((shape) => shape.id === selectedShapeId) ?? null;
  const calibrationPoints =
    draftCalibration.length > 0 ? draftCalibration : getCalibrationPoints(calibration);
  const drawingKind: ShapeKind | null =
    tool === "rectangle"
      ? "rectangle"
      : tool === "polygon"
        ? "polygon"
        : tool === "deduct"
          ? deductKind
          : null;
  const drawingOperation: ShapeOperation =
    tool === "deduct" ? "deduct" : "add";
  const previewRectanglePoints =
    drawingKind === "rectangle" && draftRectangleAnchor && hoverPoint
      ? buildRectanglePoints(draftRectangleAnchor, hoverPoint)
      : [];
  const draftPoints =
    draftPolygon.length > 0 ? draftPolygon : previewRectanglePoints;
  const groupOptions = useMemo(() => {
    const groups = new Set<string>([DEFAULT_GROUP_NAME]);

    for (const shape of shapes) {
      groups.add(shape.groupName ?? DEFAULT_GROUP_NAME);
    }

    return Array.from(groups);
  }, [shapes]);
  const measurementGroups = useMemo<MeasurementGroup[]>(() => {
    const byGroup = new Map<string, AreaShape[]>();

    for (const shape of shapes) {
      const groupName = shape.groupName ?? DEFAULT_GROUP_NAME;
      const current = byGroup.get(groupName) ?? [];
      current.push(shape);
      byGroup.set(groupName, current);
    }

    return Array.from(byGroup.entries()).map(([name, groupShapes]) => ({
      name,
      shapes: groupShapes,
      totalSqFt: calibration
        ? groupShapes.reduce(
            (sum, shape) => sum + (getSignedAreaSqFeet(shape) ?? 0),
            0,
          )
        : null,
    }));
  }, [calibration, shapes]);
  const totalSqFt = calibration
    ? shapes.reduce((sum, shape) => sum + (getSignedAreaSqFeet(shape) ?? 0), 0)
    : null;

  useEffect(() => {
    setShapes(viewerData.shapes);
    setCalibration(viewerData.calibration);
    setDraftCalibration([]);
    setDraftPolygon([]);
    setDraftRectangleAnchor(null);
    setHoverPoint(null);
    setSelectedShapeId(null);
    setShapeName("");
    setShapeOperation("add");
    setError(null);
  }, [viewerData]);

  useEffect(() => {
    if (!selectedShape) {
      return;
    }

    setShapeName(selectedShape.name);
    setShapeGroupName(selectedShape.groupName ?? DEFAULT_GROUP_NAME);
    setShapeColorHex(selectedShape.colorHex);
    setShapeOperation(selectedShape.operation);
  }, [selectedShape]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.max(nextWidth - 40, 320));
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

      setDocumentProxy((current) => {
        void current?.destroy();
        return loadedDocument;
      });
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (
          (tool === "polygon" || (tool === "deduct" && deductKind === "polygon")) &&
          draftPolygon.length > 0
        ) {
          event.preventDefault();
          setDraftPolygon((current) => current.slice(0, -1));
        }

        if (
          (tool === "rectangle" || (tool === "deduct" && deductKind === "rectangle")) &&
          draftRectangleAnchor
        ) {
          event.preventDefault();
          setDraftRectangleAnchor(null);
          setHoverPoint(null);
          setDraftPolygon([]);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deductKind, draftPolygon.length, draftRectangleAnchor, tool]);

  function setPage(pageNumber: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNumber));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearDraftState() {
    setDraftCalibration([]);
    setDraftPolygon([]);
    setDraftRectangleAnchor(null);
    setHoverPoint(null);
    setError(null);
  }

  function setToolMode(nextTool: ViewerTool) {
    clearDraftState();
    setTool(nextTool);
  }

  function getScaledPointer(point: Point): Point {
    return {
      x: point.x / scale,
      y: point.y / scale,
    };
  }

  function selectShape(shape: AreaShape) {
    setSelectedShapeId(shape.id);
    setShapeName(shape.name);
    setShapeGroupName(shape.groupName ?? DEFAULT_GROUP_NAME);
    setShapeColorHex(shape.colorHex);
    setShapeOperation(shape.operation);
    setTool("select");
  }

  function handleStagePointer(point: Point) {
    const scaledPoint = getScaledPointer(point);

    if (tool === "calibrate") {
      setDraftCalibration((current) => {
        if (current.length === 2) {
          return [scaledPoint];
        }

        return [...current, scaledPoint];
      });
      return;
    }

    if (drawingKind === "polygon") {
      setDraftPolygon((current) => [...current, scaledPoint]);
      return;
    }

    if (drawingKind === "rectangle") {
      if (!draftRectangleAnchor) {
        setDraftRectangleAnchor(scaledPoint);
        setHoverPoint(scaledPoint);
        return;
      }

      setDraftPolygon(buildRectanglePoints(draftRectangleAnchor, scaledPoint));
      setDraftRectangleAnchor(null);
      setHoverPoint(scaledPoint);
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

  async function saveDraftMeasurement() {
    if (!drawingKind || draftPoints.length < 3) {
      setError("Add enough points to finish the measurement.");
      return;
    }

    const nextGroupName = newGroupName.trim()
      ? newGroupName
      : shapeGroupName === DEFAULT_GROUP_NAME
        ? null
        : shapeGroupName;
    const normalizedGroupName = normalizeGroupName(
      nextGroupName,
    );

    try {
      const result = await requestJson<{ shape: AreaShape }>(
        `/api/pages/${currentPage.id}/shapes`,
        {
          method: "POST",
          body: JSON.stringify({
            name:
              shapeName.trim() ||
              getNextShapeName(drawingKind, drawingOperation, shapes),
            kind: drawingKind,
            operation: drawingOperation,
            colorHex: shapeColorHex,
            groupName: normalizedGroupName,
            points: draftPoints,
          }),
        },
      );

      setShapes((current) => [...current, result.shape]);
      selectShape(result.shape);
      clearDraftState();
      setShapeName("");
      setTool("select");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Measurement could not be saved.",
      );
    }
  }

  async function updateSelectedShape(updates: {
    name?: string;
    kind?: ShapeKind;
    operation?: ShapeOperation;
    colorHex?: string;
    groupName?: string | null;
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
          : "Measurement could not be updated.",
      );
    }
  }

  async function deleteSelectedShape() {
    if (!selectedShape) {
      setError("Select a measurement to delete.");
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
      setError("Measurement could not be deleted.");
    }
  }

  const pageHref = `/projects/${projectId}`;
  const calibrationStatus = calibration ? "Custom calibrated" : "Not calibrated";
  const draftInstruction =
    tool === "polygon"
      ? "Polygon area: click points, double-click to finish, Delete removes last point."
      : tool === "rectangle"
        ? "Rectangle area: click once to set the corner, move, then click again to finish."
        : tool === "deduct"
          ? `Deduction ${deductKind}: ${
              deductKind === "polygon"
                ? "click points, double-click to finish, Delete removes last point."
                : "click once to set the corner, move, then click again to finish."
            }`
          : tool === "calibrate"
            ? "Pick two points on the page, then save the calibration."
            : tool === "move"
              ? "Move mode: drag a measurement or drag its points to refine it."
              : "Select a saved measurement to review or edit it.";
  const helperLength =
    drawingKind === "polygon" && draftPolygon.length > 0 && hoverPoint
      ? formatLengthFromPoints(draftPolygon[draftPolygon.length - 1], hoverPoint, calibration)
      : previewRectanglePoints.length === 4
        ? `${formatLengthFromPoints(previewRectanglePoints[0], previewRectanglePoints[1], calibration)} × ${formatLengthFromPoints(previewRectanglePoints[1], previewRectanglePoints[2], calibration)}`
        : null;
  const helperArea = draftPoints.length >= 3
    ? formatPreviewArea(draftPoints, calibration, drawingOperation)
    : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
      <aside className="space-y-4">
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Pages
            </p>
            <span className="text-xs text-[var(--color-muted)]">
              {viewerData.pages.length} total
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {viewerData.pages.map((page) => (
              <PdfPageThumbnail
                key={page.id}
                documentProxy={documentProxy}
                widthPx={page.widthPx}
                heightPx={page.heightPx}
                pageNumber={page.pageNumber}
                isActive={page.id === currentPage.id}
                onClick={() => setPage(page.pageNumber)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Page Settings
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Line Width</dt>
              <dd className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.5"
                  value={lineWidth}
                  onChange={(event) => setLineWidth(Number(event.target.value))}
                />
                <span className="w-10 text-right">{lineWidth.toFixed(1)}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Page Scale</dt>
              <dd>{calibrationStatus}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Measurement</dt>
              <dd>Imperial</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setToolMode("calibrate")}
            className="mt-4 w-full rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Find Scale
          </button>
        </section>
      </aside>

      <section className="min-w-0 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-sm">
        <div className="space-y-4 border-b border-[var(--color-border)] px-2 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TOOL_LABELS) as ViewerTool[]).map((toolName) => (
              <button
                key={toolName}
                type="button"
                onClick={() => setToolMode(toolName)}
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

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">Group</span>
              <select
                value={shapeGroupName}
                onChange={(event) => setShapeGroupName(event.target.value)}
                className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2"
              >
                {groupOptions.map((groupName) => (
                  <option key={groupName} value={groupName}>
                    {groupName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">New Group</span>
              <input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Warm"
                className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">Color</span>
              <input
                type="color"
                value={shapeColorHex}
                onChange={(event) => setShapeColorHex(event.target.value)}
                className="h-10 w-12 rounded-full border border-[var(--color-border)] bg-white p-1"
              />
            </label>

            {tool === "deduct" ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-muted)]">Deduction Type</span>
                <select
                  value={deductKind}
                  onChange={(event) =>
                    setDeductKind(event.target.value as ShapeKind)
                  }
                  className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="polygon">Polygon</option>
                </select>
              </label>
            ) : null}
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
              disabled={currentPageIndex >= viewerData.pages.length - 1 || isPending}
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

        <div ref={containerRef} className="mt-4 h-[74vh] overflow-auto rounded-2xl bg-[#d8d2c6] p-4">
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="block rounded-xl bg-white shadow-lg" />
            <Stage
              width={currentPage.widthPx * scale}
              height={currentPage.heightPx * scale}
              className="!absolute left-0 top-0"
              onMouseMove={(event) => {
                const pointerPosition = event.target.getStage()?.getPointerPosition();

                if (!pointerPosition) {
                  return;
                }

                setHoverPoint(getScaledPointer(pointerPosition));
              }}
              onMouseDown={(event) => {
                if (
                  (tool === "select" || tool === "move") &&
                  event.target !== event.target.getStage()
                ) {
                  return;
                }

                const pointerPosition = event.target.getStage()?.getPointerPosition();

                if (!pointerPosition) {
                  return;
                }

                handleStagePointer(pointerPosition);
              }}
              onDblClick={() => {
                if (
                  (tool === "polygon" || (tool === "deduct" && deductKind === "polygon")) &&
                  draftPolygon.length >= 3
                ) {
                  void saveDraftMeasurement();
                }
              }}
            >
              <Layer>
                {shapes.map((shape) => {
                  const isSelected = shape.id === selectedShapeId;
                  const signedStroke =
                    shape.operation === "deduct"
                      ? shape.colorHex
                      : isSelected
                        ? "#9b5d33"
                        : shape.colorHex;

                  return (
                    <Line
                      key={shape.id}
                      points={pointsToFlatArray(shape.points, scale)}
                      closed
                      fill={hexToRgba(shape.colorHex, shape.operation === "deduct" ? 0.08 : 0.2)}
                      dash={shape.operation === "deduct" ? [10, 6] : undefined}
                      stroke={signedStroke}
                      strokeWidth={isSelected ? 2.5 * lineWidth : 1.6 * lineWidth}
                      draggable={tool === "move" && isSelected}
                      onClick={() => selectShape(shape)}
                      onDragEnd={(event) => {
                        if (tool !== "move") {
                          return;
                        }

                        const offset = event.target.position();
                        const nextPoints = shape.points.map((point) => ({
                          x: point.x + offset.x / scale,
                          y: point.y + offset.y / scale,
                        }));

                        event.target.position({ x: 0, y: 0 });
                        void updateSelectedShape({ points: nextPoints });
                      }}
                    />
                  );
                })}

                {draftPolygon.length > 0 ? (
                  <Line
                    points={pointsToFlatArray(
                      hoverPoint &&
                        (tool === "polygon" || (tool === "deduct" && deductKind === "polygon"))
                        ? [...draftPolygon, hoverPoint]
                        : draftPolygon,
                      scale,
                    )}
                    stroke={shapeColorHex}
                    strokeWidth={2 * lineWidth}
                    closed={draftPolygon.length >= 3 && !hoverPoint}
                    dash={drawingOperation === "deduct" ? [10, 6] : undefined}
                    fill={hexToRgba(shapeColorHex, drawingOperation === "deduct" ? 0.08 : 0.15)}
                  />
                ) : null}

                {previewRectanglePoints.length === 4 ? (
                  <Line
                    points={pointsToFlatArray(previewRectanglePoints, scale)}
                    closed
                    stroke={shapeColorHex}
                    strokeWidth={2 * lineWidth}
                    dash={drawingOperation === "deduct" ? [10, 6] : undefined}
                    fill={hexToRgba(shapeColorHex, drawingOperation === "deduct" ? 0.08 : 0.15)}
                  />
                ) : null}

                {calibrationPoints.length === 2 ? (
                  <Line
                    points={pointsToFlatArray(calibrationPoints, scale)}
                    stroke="#c44900"
                    strokeWidth={2.5 * lineWidth}
                    dash={[10, 6]}
                  />
                ) : null}

                {selectedShape?.points.map((point, index) => (
                  <Circle
                    key={`${selectedShape.id}-${index}`}
                    x={point.x * scale}
                    y={point.y * scale}
                    radius={6 * lineWidth}
                    fill="#fff"
                    stroke="#9b5d33"
                    strokeWidth={2}
                    draggable={tool === "move"}
                    onDragMove={(event) => {
                      if (tool !== "move") {
                        return;
                      }

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
                      if (tool !== "move") {
                        return;
                      }

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
                    radius={5 * lineWidth}
                    fill="#c44900"
                  />
                ))}

                {draftPolygon.map((point, index) => (
                  <Circle
                    key={`draft-${index}`}
                    x={point.x * scale}
                    y={point.y * scale}
                    radius={4.5 * lineWidth}
                    fill={shapeColorHex}
                  />
                ))}

                {helperLength && hoverPoint ? (
                  <Text
                    x={hoverPoint.x * scale + 12}
                    y={hoverPoint.y * scale + 12}
                    text={helperLength}
                    fontSize={14}
                    padding={8}
                    fill="#1f2937"
                  />
                ) : null}
              </Layer>
            </Stage>

            <div className="pointer-events-none absolute bottom-4 left-4 max-w-sm rounded-2xl bg-[rgba(31,41,55,0.88)] px-4 py-3 text-sm text-white shadow-lg">
              <p className="font-medium">{draftInstruction}</p>
              {helperLength ? <p className="mt-1 text-white/80">Live size: {helperLength}</p> : null}
              {helperArea ? <p className="mt-1 text-white/80">Live area: {helperArea}</p> : null}
            </div>
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
                {calibrationStatus}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Net total</dt>
              <dd className="text-right text-[var(--color-foreground)]">
                {totalSqFt === null ? "Unavailable" : formatSqFt(totalSqFt)}
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
              onClick={() => setToolMode("calibrate")}
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
              Measurements
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Grouped takeoff results with net totals and deduction tracking.
            </p>
          </div>

          {drawingKind ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Draft name
                </span>
                <input
                  value={shapeName}
                  onChange={(event) => setShapeName(event.target.value)}
                  placeholder={getNextShapeName(drawingKind, drawingOperation, shapes)}
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                />
              </label>
              <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
                <span>Draft type</span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {drawingOperation === "deduct" ? "Deduction" : "Area"} / {drawingKind}
                </span>
              </div>
              {helperArea ? (
                <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
                  <span>Live result</span>
                  <span className="font-semibold text-[var(--color-foreground)]">
                    {helperArea}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveDraftMeasurement()}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Save measurement
                </button>
                <button
                  type="button"
                  onClick={clearDraftState}
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
                  Selected measurement
                </span>
                <input
                  value={shapeName}
                  onChange={(event) => setShapeName(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-muted)]">
                    Group
                  </span>
                  <input
                    value={shapeGroupName}
                    onChange={(event) => setShapeGroupName(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-muted)]">
                    Color
                  </span>
                  <input
                    type="color"
                    value={shapeColorHex}
                    onChange={(event) => setShapeColorHex(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[var(--color-border)] p-2"
                  />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Operation
                </span>
                <select
                  value={shapeOperation}
                  onChange={(event) =>
                    setShapeOperation(event.target.value as ShapeOperation)
                  }
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3"
                >
                  <option value="add">Add</option>
                  <option value="deduct">Deduct</option>
                </select>
              </label>
              <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
                <span>Measured area</span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {selectedShape.areaSqFeet === null
                    ? "Unavailable"
                    : formatSqFt(Math.abs(selectedShape.areaSqFeet))}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void updateSelectedShape({
                    name: shapeName.trim() || selectedShape.name,
                    groupName:
                      shapeGroupName === DEFAULT_GROUP_NAME
                        ? null
                        : normalizeGroupName(shapeGroupName),
                    colorHex: shapeColorHex,
                    operation: shapeOperation,
                  })
                }
                className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Save changes
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {measurementGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                No measurements on this page yet.
              </div>
            ) : (
              measurementGroups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-2xl border border-[var(--color-border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {group.shapes.length} measurement{group.shapes.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-[var(--color-muted)]">Group Total</p>
                      <p className="font-semibold">
                        {group.totalSqFt === null ? "Unavailable" : formatSqFt(group.totalSqFt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {group.shapes.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() => selectShape(shape)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          shape.id === selectedShapeId
                            ? "border-[var(--color-accent)] bg-[rgba(155,93,51,0.08)]"
                            : "border-[var(--color-border)] bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: shape.colorHex }}
                          />
                          <span>
                            <span className="block font-medium">{shape.name}</span>
                            <span className="text-sm text-[var(--color-muted)]">
                              {shape.operation === "deduct" ? "Deduct" : "Add"} • {shape.kind}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-foreground)]">
                          {shape.areaSqFeet === null
                            ? "Unavailable"
                            : `${shape.operation === "deduct" ? "-" : ""}${formatSqFt(Math.abs(shape.areaSqFeet))}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
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
