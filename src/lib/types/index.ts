export type Point = {
  x: number;
  y: number;
};

export type ShapeKind = "polygon" | "rectangle";

export type ShapeOperation = "add" | "deduct";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItem = Project & {
  fileCount: number;
  pageCount: number;
};

export type ProjectFile = {
  id: string;
  projectId: string;
  originalName: string;
  storedPath: string;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PdfPage = {
  id: string;
  fileId: string;
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  createdAt: string;
  updatedAt: string;
};

export type PageCalibration = {
  id: string;
  pageId: string;
  point1X: number;
  point1Y: number;
  point2X: number;
  point2Y: number;
  pixelDistance: number;
  realDistanceInches: number;
  inchesPerPixel: number;
  createdAt: string;
  updatedAt: string;
};

export type AreaShape = {
  id: string;
  pageId: string;
  name: string;
  kind: ShapeKind;
  operation: ShapeOperation;
  colorHex: string;
  groupName: string | null;
  points: Point[];
  pixelArea: number;
  areaSqInches: number | null;
  areaSqFeet: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = {
  project: Project;
  files: ProjectFile[];
};

export type ViewerPageData = {
  project: Project;
  file: ProjectFile;
  pages: PdfPage[];
  currentPage: PdfPage;
  calibration: PageCalibration | null;
  shapes: AreaShape[];
};
