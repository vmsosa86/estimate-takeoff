declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(source: string | Uint8Array | object): {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (options: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void>; cancel?: () => void };
      }>;
      destroy: () => Promise<void>;
    }>;
  };
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(source: Uint8Array | object): {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (options: { scale: number }) => {
          width: number;
          height: number;
        };
      }>;
      destroy: () => Promise<void>;
    }>;
  };
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: object;
}
