import "server-only";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfPageMetadata = {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
};

export async function extractPdfMetadata(buffer: Buffer): Promise<{
  pageCount: number;
  pages: PdfPageMetadata[];
}> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;

  try {
    const pages: PdfPageMetadata[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      pages.push({
        pageNumber,
        widthPx: viewport.width,
        heightPx: viewport.height,
      });
    }

    return {
      pageCount: document.numPages,
      pages,
    };
  } finally {
    await document.destroy();
  }
}
