import jsPDF from 'jspdf';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as PdfJs from 'pdfjs-dist/build/pdf.mjs';

export interface ConvertResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  preview?: string;
}

type PDFJSLib = any;
type TesseractModule = any;

const PDFJS_VERSION = '6.2.108';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  const buffer = await file.arrayBuffer();
  return buffer.slice(0);
}

async function fileToText(file: File): Promise<string> {
  return file.text();
}

/**
 * Loads PDF.js only in the browser.
 *
 * The worker URL is kept explicit because Vite does not reliably bundle the
 * PDF.js worker when the library is dynamically imported.
 *
 * IMPORTANT:
 * If your installed pdfjs-dist version is different, change PDFJS_VERSION
 * to the same version in package.json.
 */
async function loadPdfjs(): Promise<PDFJSLib> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js browser conversion is only available in a browser.');
  }

  if (PdfJs.GlobalWorkerOptions) {
    PdfJs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  }

  return PdfJs;
}

async function loadTesseract(): Promise<TesseractModule> {
  if (typeof window === 'undefined') {
    throw new Error('OCR is only available in a browser.');
  }

  return import('tesseract.js');
}

async function renderPdfPageToPng(
  pdf: PDFJSLib,
  pageNumber: number,
  scale = 2,
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
}> {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Could not create PDF rendering canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
    background: '#ffffff',
  }).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    widthPt: baseViewport.width,
    heightPt: baseViewport.height,
  };
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Invalid data URL.');
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function expectedOutputForOperation(operation: string): {
  extension: string;
  mime: string;
  kind: 'pdf' | 'zip' | 'text' | 'unknown';
} {
  switch (operation) {
    case 'office-to-pdf':
    case 'html-to-pdf':
    case 'pdf-unlock':
    case 'pdf-protect':
    case 'pdf-to-pdfa':
    case 'pdf-translate':
      return {
        extension: '.pdf',
        mime: 'application/pdf',
        kind: 'pdf',
      };

    case 'pdf-to-word':
      return {
        extension: '.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        kind: 'zip',
      };

    case 'pdf-to-pptx':
      return {
        extension: '.pptx',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        kind: 'zip',
      };

    case 'pdf-to-xlsx':
      return {
        extension: '.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        kind: 'zip',
      };

    default:
      return {
        extension: '',
        mime: '',
        kind: 'unknown',
      };
  }
}

async function validateServerOutput(
  blob: Blob,
  operation: string,
  filename: string,
): Promise<void> {
  const expected = expectedOutputForOperation(operation);

  if (expected.kind === 'unknown') {
    return;
  }

  const lowerName = filename.toLowerCase();

  if (expected.extension && !lowerName.endsWith(expected.extension)) {
    throw new Error(
      `The conversion server returned an invalid filename for ${operation}: ${filename}`,
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (bytes.length === 0) {
    throw new Error('The conversion server returned an empty file.');
  }

  if (expected.kind === 'pdf') {
    const signature = new TextDecoder().decode(bytes.slice(0, 5));

    if (signature !== '%PDF-') {
      throw new Error(
        'The conversion server returned data that is not a valid PDF file.',
      );
    }
  }

  if (expected.kind === 'zip') {
    const validZip =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
      (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);

    if (!validZip) {
      throw new Error(
        `The conversion server returned an invalid ${expected.extension.toUpperCase()} file.`,
      );
    }
  }
}

function getServerUrl(): string {
  const server = String(import.meta.env.VITE_CONVERTER_API_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (!server) {
    throw new Error(
      'VITE_CONVERTER_API_URL is not configured. Set it to the public HTTPS URL of your QuadraConverter FastAPI server.',
    );
  }

  if (!/^https?:\/\//i.test(server)) {
    throw new Error(
      'Invalid VITE_CONVERTER_API_URL. It must include http:// or https://.',
    );
  }

  if (
    import.meta.env.PROD &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(server)
  ) {
    throw new Error(
      'Production is configured with localhost. Deploy the FastAPI conversion server and set VITE_CONVERTER_API_URL to its public HTTPS URL before rebuilding the Vercel frontend.',
    );
  }

  return server;
}

function getFilenameFromContentDisposition(header: string): string {
  if (!header) {
    return '';
  }

  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(
        utf8Match[1].trim().replace(/^["']|["']$/g, ''),
      );
    } catch {
      return utf8Match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  const normalMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i);

  return normalMatch?.[1]?.trim() || '';
}

function sanitizeFilename(filename: string, fallback: string): string {
  const cleaned = filename
    .split(/[\\/]/)
    .pop()
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  return cleaned || fallback;
}

function getBaseFilename(filename: string): string {
  const base = filename.replace(/[\\/]/g, '/').split('/').pop() || 'converted';
  return base.replace(/\.[^.]+$/, '') || 'converted';
}

async function serverConvert(
  file: File,
  operation: string,
  fields: Record<string, string> = {},
): Promise<ConvertResult> {
  const baseUrl = getServerUrl();
  const form = new FormData();

  form.append('file', file, file.name);
  form.append('operation', operation);

  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  );

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/convert`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      headers: {
        Accept: '*/*',
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'The conversion server timed out. Please try a smaller file or increase the backend timeout.',
      );
    }

    throw new Error(
      'Cannot connect to the QuadraConverter conversion server. Verify VITE_CONVERTER_API_URL, the backend is running, and CORS allows this website.',
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Conversion server returned HTTP ${response.status}.`;

    try {
      const payload: unknown = await response.json();

      if (typeof payload === 'object' && payload !== null) {
        const body = payload as Record<string, unknown>;
        const detail = body.detail ?? body.error ?? body.message;

        if (typeof detail === 'string' && detail.trim()) {
          message = detail;
        }
      }
    } catch {
      // Keep HTTP status when the backend does not return JSON.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error('The conversion server returned an empty file.');
  }

  const disposition =
    response.headers.get('content-disposition') || '';

  const headerFilename =
    response.headers.get('x-converted-filename')?.trim() || '';

  const dispositionFilename =
    getFilenameFromContentDisposition(disposition);

  const expected = expectedOutputForOperation(operation);
  const fallbackExtension = expected.extension || '.bin';
  const fallbackFilename =
    `${getBaseFilename(file.name)}${fallbackExtension}`;

  let filename = sanitizeFilename(
    headerFilename || dispositionFilename,
    fallbackFilename,
  );

  if (filename.toLowerCase().endsWith('.converted')) {
    filename = fallbackFilename;
  }

  if (
    expected.extension &&
    !filename.toLowerCase().endsWith(expected.extension)
  ) {
    filename = `${getBaseFilename(file.name)}${expected.extension}`;
  }

  await validateServerOutput(blob, operation, filename);

  return {
    blob,
    filename,
    mimeType: expected.mime || blob.type || 'application/octet-stream',
  };
}

function createPdfBlob(pdf: jsPDF): Blob {
  return pdf.output('blob');
}

function getImageMime(file: File): 'JPEG' | 'PNG' {
  const type = file.type.toLowerCase();

  if (type === 'image/png') {
    return 'PNG';
  }

  return 'JPEG';
}

function getImageData(
  image: HTMLImageElement,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create image canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  return canvas.toDataURL(mime, quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read image: ${file.name}`));
    };

    image.src = objectUrl;
  });
}

function addImageToPdf(
  pdf: jsPDF,
  dataUrl: string,
  widthPx: number,
  heightPx: number,
  format: 'JPEG' | 'PNG',
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const scale = Math.min(
    availableWidth / widthPx,
    availableHeight / heightPx,
  );

  const width = widthPx * scale;
  const height = heightPx * scale;

  pdf.addImage(
    dataUrl,
    format,
    (pageWidth - width) / 2,
    (pageHeight - height) / 2,
    width,
    height,
  );
}

// ─── Merge PDFs ──────────────────────────────────────────────

export async function mergePDFs(
  files: File[],
): Promise<ConvertResult> {
  if (!files.length) {
    throw new Error('Select at least one PDF file.');
  }

  const merged = await PDFDocument.create();

  for (const file of files) {
    const source = await PDFDocument.load(
      await fileToArrayBuffer(file),
    );

    const pages = await merged.copyPages(
      source,
      source.getPageIndices(),
    );

    pages.forEach((page) => merged.addPage(page));
  }

  const bytes = await merged.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'merged.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Split PDF ───────────────────────────────────────────────

export async function splitPDF(
  file: File,
  splitPoints = '',
): Promise<ConvertResult[]> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const total = source.getPageCount();

  if (total === 0) {
    throw new Error('The PDF contains no pages.');
  }

  const points = splitPoints.trim()
    ? [
        ...new Set(
          splitPoints
            .split(',')
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter(
              (value) =>
                Number.isInteger(value) &&
                value >= 1 &&
                value < total,
            ),
        ),
      ].sort((a, b) => a - b)
    : Array.from(
        { length: Math.max(0, total - 1) },
        (_, index) => index + 1,
      );

  const ranges: Array<[number, number]> = [];
  let start = 1;

  for (const point of points) {
    ranges.push([start, point]);
    start = point + 1;
  }

  if (start <= total) {
    ranges.push([start, total]);
  }

  const results: ConvertResult[] = [];

  for (let index = 0; index < ranges.length; index += 1) {
    const [from, to] = ranges[index];
    const output = await PDFDocument.create();

    const indices = Array.from(
      { length: to - from + 1 },
      (_, offset) => from - 1 + offset,
    );

    const pages = await output.copyPages(source, indices);
    pages.forEach((page) => output.addPage(page));

    const bytes = await output.save();

    results.push({
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: `part_${index + 1}_${from}-${to}.pdf`,
      mimeType: 'application/pdf',
    });
  }

  return results;
}

// ─── Remove Pages ────────────────────────────────────────────

export async function removePages(
  file: File,
  pageRange: string,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const total = source.getPageCount();
  const pagesToRemove = new Set(
    parsePageRange(pageRange, total),
  );

  if (pagesToRemove.size >= total) {
    throw new Error('You cannot remove every page from the PDF.');
  }

  const output = await PDFDocument.create();

  for (let index = 0; index < total; index += 1) {
    if (!pagesToRemove.has(index)) {
      const [page] = await output.copyPages(source, [index]);
      output.addPage(page);
    }
  }

  const bytes = await output.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'pages_removed.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Extract Pages ───────────────────────────────────────────

export async function extractPages(
  file: File,
  pageRange: string,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const indices = parsePageRange(
    pageRange,
    source.getPageCount(),
  );

  if (!indices.length) {
    throw new Error('No valid pages were selected.');
  }

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);

  pages.forEach((page) => output.addPage(page));

  const bytes = await output.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'extracted_pages.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Organize PDF ────────────────────────────────────────────

export async function organizePDF(
  file: File,
  pageOrder: string,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const total = source.getPageCount();

  const order = pageOrder
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10) - 1)
    .filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < total,
    );

  if (!order.length) {
    throw new Error(
      'Enter a valid page order such as 3,1,2.',
    );
  }

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, order);

  pages.forEach((page) => output.addPage(page));

  const bytes = await output.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'organized.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Scan Images to PDF ──────────────────────────────────────

export async function scanToPDF(
  files: File[],
): Promise<ConvertResult> {
  if (!files.length) {
    throw new Error('Select at least one image.');
  }

  const firstImage = await loadImage(files[0]);
  const firstOrientation =
    firstImage.naturalWidth >= firstImage.naturalHeight
      ? 'landscape'
      : 'portrait';

  const pdf = new jsPDF({
    orientation: firstOrientation,
    unit: 'mm',
    format: 'a4',
  });

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    if (index > 0) {
      const image = await loadImage(file);
      const orientation =
        image.naturalWidth >= image.naturalHeight
          ? 'landscape'
          : 'portrait';

      pdf.addPage('a4', orientation);
      const format = getImageMime(file);
      const dataUrl = getImageData(
        image,
        format === 'PNG' ? 'image/png' : 'image/jpeg',
        0.92,
      );

      addImageToPdf(
        pdf,
        dataUrl,
        image.naturalWidth,
        image.naturalHeight,
        format,
      );
      continue;
    }

    const format = getImageMime(file);
    const dataUrl = getImageData(
      firstImage,
      format === 'PNG' ? 'image/png' : 'image/jpeg',
      0.92,
    );

    addImageToPdf(
      pdf,
      dataUrl,
      firstImage.naturalWidth,
      firstImage.naturalHeight,
      format,
    );
  }

  return {
    blob: createPdfBlob(pdf),
    filename: 'scanned.pdf',
    mimeType: 'application/pdf',
  };
}
// ─── Images to PDF ───────────────────────────────────────────

export async function imagesToPDF(
  files: File[],
): Promise<ConvertResult> {
  return scanToPDF(files);
}
// ─── Optimize PDF ────────────────────────────────────────────

export async function optimizePDF(
  file: File,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const output = await PDFDocument.create();
  const pages = await output.copyPages(
    source,
    source.getPageIndices(),
  );

  pages.forEach((page) => output.addPage(page));

  const bytes = await output.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'optimized.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Compress PDF ────────────────────────────────────────────

export async function compressPDF(
  file: File,
  quality: number,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();
  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const qualityValue = Math.max(
    0.1,
    Math.min(1, Number(quality) / 100),
  );

  let outputPdf: jsPDF | null = null;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create compression canvas.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise;

      const imageData = canvas.toDataURL(
        'image/jpeg',
        qualityValue,
      );

      const orientation =
        baseViewport.width >= baseViewport.height
          ? 'landscape'
          : 'portrait';

      const pageWidthMm = baseViewport.width * 25.4 / 72;
      const pageHeightMm = baseViewport.height * 25.4 / 72;

      if (!outputPdf) {
        outputPdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: [pageWidthMm, pageHeightMm],
        });
      } else {
        outputPdf.addPage(
          [pageWidthMm, pageHeightMm],
          orientation,
        );
      }

      outputPdf.addImage(
        imageData,
        'JPEG',
        0,
        0,
        pageWidthMm,
        pageHeightMm,
        undefined,
        'FAST',
      );

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  if (!outputPdf) {
    throw new Error('The PDF contains no pages.');
  }

  return {
    blob: createPdfBlob(outputPdf),
    filename: 'compressed.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Repair PDF ──────────────────────────────────────────────

export async function repairPDF(
  file: File,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
    {
      ignoreEncryption: true,
      updateMetadata: false,
    },
  );

  const output = await PDFDocument.create();

  const pages = await output.copyPages(
    source,
    source.getPageIndices(),
  );

  pages.forEach((page) => output.addPage(page));

  const bytes = await output.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'repaired.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── OCR PDF ────────────────────────────────────────────────

export async function ocrPDF(
  file: File,
  language: string,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();
  const tesseract = await loadTesseract();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const lang = language?.trim() || 'eng';
  const worker = await tesseract.createWorker(lang);

  let fullText = '';

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create OCR canvas.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise;

      const result = await worker.recognize(canvas);

      fullText +=
        `--- Page ${pageNumber} ---\n` +
        `${result.data?.text || ''}\n\n`;

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  return {
    blob: new Blob([fullText], { type: 'text/plain;charset=utf-8' }),
    filename: 'ocr_result.txt',
    mimeType: 'text/plain',
  };
}

// ─── Generic File to PDF ────────────────────────────────────

export async function convertToPDF(
  file: File,
): Promise<ConvertResult> {
  const extension =
    file.name.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'bmp':
      return scanToPDF([file]);

    case 'txt':
    case 'md': {
      const text = await fileToText(file);
      const pdf = new jsPDF();

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);

      const lines = pdf.splitTextToSize(text, 180);
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 20;

      for (const line of lines) {
        if (y > pageHeight - 20) {
          pdf.addPage();
          y = 20;
        }

        pdf.text(String(line), 15, y);
        y += 7;
      }

      return {
        blob: createPdfBlob(pdf),
        filename: 'converted.pdf',
        mimeType: 'application/pdf',
      };
    }

    case 'doc':
    case 'docx':
      return wordToPDF(file);

    case 'html':
    case 'htm':
      return htmlToPDFFile(file);

    case 'xls':
    case 'xlsx':
      return excelToPDF(file);

    case 'ppt':
    case 'pptx':
      return pptxToPDF(file);

    default:
      throw new Error(`Unsupported file type: .${extension || 'unknown'}`);
  }
}

// ─── JPG to PDF ─────────────────────────────────────────────

export async function jpgToPDF(
  files: File[],
): Promise<ConvertResult> {
  return scanToPDF(files);
}

// ─── Word to PDF ────────────────────────────────────────────

export async function wordToPDF(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'office-to-pdf');
}

// ─── PowerPoint to PDF ─────────────────────────────────────

export async function pptxToPDF(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'office-to-pdf');
}

// ─── Excel to PDF ───────────────────────────────────────────

export async function excelToPDF(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'office-to-pdf');
}

// ─── HTML to PDF ────────────────────────────────────────────

export async function htmlToPDFFile(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'html-to-pdf');
}

// ─── PDF to JPG ─────────────────────────────────────────────

export async function pdfToJPG(
  file: File,
  quality: number,
  pageRange?: string,
): Promise<ConvertResult[]> {
  const pdfjsLib = await loadPdfjs();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let pagesToConvert: number[] = [];

  if (
    !pageRange ||
    pageRange.trim().toLowerCase() === 'all'
  ) {
    pagesToConvert = Array.from(
      { length: pdf.numPages },
      (_, index) => index + 1,
    );
  } else {
    const pages = new Set<number>();

    for (const part of pageRange
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);

      if (rangeMatch) {
        const first = Number.parseInt(rangeMatch[1], 10);
        const last = Number.parseInt(rangeMatch[2], 10);

        for (
          let pageNumber = Math.min(first, last);
          pageNumber <= Math.max(first, last);
          pageNumber += 1
        ) {
          if (
            pageNumber >= 1 &&
            pageNumber <= pdf.numPages
          ) {
            pages.add(pageNumber);
          }
        }
      } else {
        const pageNumber = Number.parseInt(part, 10);

        if (
          pageNumber >= 1 &&
          pageNumber <= pdf.numPages
        ) {
          pages.add(pageNumber);
        }
      }
    }

    pagesToConvert = Array.from(pages).sort(
      (a, b) => a - b,
    );
  }

  if (!pagesToConvert.length) {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
    throw new Error('No valid pages were selected.');
  }

  const qualityValue = Math.max(
    0.1,
    Math.min(1, Number(quality) / 100),
  );

  const results: ConvertResult[] = [];

  try {
    for (const pageNumber of pagesToConvert) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create PDF image canvas.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (value) {
              resolve(value);
            } else {
              reject(new Error('Could not create JPG output.'));
            }
          },
          'image/jpeg',
          qualityValue,
        );
      });

      results.push({
        blob,
        filename: `page_${pageNumber}.jpg`,
        mimeType: 'image/jpeg',
        preview: canvas.toDataURL(
          'image/jpeg',
          Math.min(0.5, qualityValue),
        ),
      });

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  return results;
}

// ─── PDF to Word ─────────────────────────────────────────────

export async function pdfToWord(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-to-word', {
    language: 'eng',
  });
}

// ─── PDF to PowerPoint ──────────────────────────────────────

export async function pdfToPPTX(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-to-pptx', {
    language: 'eng',
  });
}

// ─── PDF to Excel ───────────────────────────────────────────

export async function pdfToExcel(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-to-xlsx', {
    language: 'eng',
  });
}

// ─── PDF to PDF/A ───────────────────────────────────────────

export async function pdfToPDFA(
  file: File,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-to-pdfa');
}

// ─── Rotate PDF ─────────────────────────────────────────────

export async function rotatePDF(
  file: File,
  rotationDegrees: number,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const normalized =
    ((Number(rotationDegrees) % 360) + 360) % 360;

  const output = await PDFDocument.create();

  const pages = await output.copyPages(
    source,
    source.getPageIndices(),
  );

  pages.forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + normalized));
    output.addPage(page);
  });

  const bytes = await output.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'rotated.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Add Page Numbers ───────────────────────────────────────

export async function addPageNumbers(
  file: File,
  position: string,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const font = await source.embedFont(
    StandardFonts.Helvetica,
  );

  const pages = source.getPages();
  const total = pages.length;

  const normalizedPosition =
    position?.toLowerCase() || 'center';

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const text = `${index + 1} / ${total}`;
    const size = 10;

    const textWidth =
      font.widthOfTextAtSize(text, size);

    const { width, height } = page.getSize();

    let x = 30;
    let y = 20;

    switch (normalizedPosition) {
      case 'center':
        x = (width - textWidth) / 2;
        break;

      case 'right':
        x = width - textWidth - 30;
        break;

      case 'top':
        y = height - 20;
        break;

      case 'left':
      default:
        break;
    }

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const bytes = await source.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'numbered.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Add Watermark ──────────────────────────────────────────

export async function addWatermark(
  file: File,
  text: string,
  opacity: number,
): Promise<ConvertResult> {
  const watermark = text.trim();

  if (!watermark) {
    throw new Error('Enter watermark text.');
  }

  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const font = await source.embedFont(
    StandardFonts.HelveticaBold,
  );

  const safeOpacity = Math.max(
    0,
    Math.min(100, Number(opacity)),
  ) / 100;

  for (const page of source.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(50, Math.max(20, width / 10));

    const textWidth =
      font.widthOfTextAtSize(watermark, size);

    page.drawText(watermark, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: safeOpacity,
      rotate: degrees(45),
    });
  }

  const bytes = await source.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'watermarked.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Crop PDF ───────────────────────────────────────────────

export async function cropPDF(
  file: File,
  margin: number,
): Promise<ConvertResult> {
  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const safeMargin = Math.max(0, Number(margin) || 0);

  for (const page of source.getPages()) {
    const { width, height } = page.getSize();

    const maxMarginX = Math.max(0, width / 2 - 1);
    const maxMarginY = Math.max(0, height / 2 - 1);

    const xMargin = Math.min(safeMargin, maxMarginX);
    const yMargin = Math.min(safeMargin, maxMarginY);

    page.setCropBox(
      xMargin,
      yMargin,
      width - xMargin * 2,
      height - yMargin * 2,
    );
  }

  const bytes = await source.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'cropped.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Unlock PDF ─────────────────────────────────────────────

export async function unlockPDF(
  file: File,
  password: string,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-unlock', {
    password,
  });
}

// ─── Protect PDF ────────────────────────────────────────────

export async function protectPDF(
  file: File,
  password: string,
): Promise<ConvertResult> {
  return serverConvert(file, 'pdf-protect', {
    password,
  });
}

// ─── Sign PDF ───────────────────────────────────────────────

export async function signPDF(
  file: File,
  name: string,
): Promise<ConvertResult> {
  const signerName = name.trim();

  if (!signerName) {
    throw new Error('Enter the signer name.');
  }

  const source = await PDFDocument.load(
    await fileToArrayBuffer(file),
  );

  const pages = source.getPages();

  if (!pages.length) {
    throw new Error('The PDF contains no pages.');
  }

  const font = await source.embedFont(
    StandardFonts.HelveticaBold,
  );

  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const signatureX = Math.max(20, width - 200);

  lastPage.drawText(
    `Signed by: ${signerName}`,
    {
      x: signatureX,
      y: 30,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    },
  );

  lastPage.drawText(
    `Date: ${new Date().toLocaleDateString()}`,
    {
      x: signatureX,
      y: 15,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    },
  );

  const bytes = await source.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'signed.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Redact PDF ─────────────────────────────────────────────

export async function redactPDF(
  file: File,
  searchText: string,
): Promise<ConvertResult> {
  const target = searchText.trim();

  if (!target) {
    throw new Error('Enter text to redact.');
  }

  const pdfjsLib = await loadPdfjs();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const source = await PDFDocument.load(data);

  try {
    const pages = source.getPages();

    for (let index = 0; index < pages.length; index += 1) {
      const pdfjsPage = await pdf.getPage(index + 1);
      const content = await pdfjsPage.getTextContent();

      const page = pages[index];
      const pageHeight = page.getHeight();

      for (const item of content.items as any[]) {
        const value =
          typeof item.str === 'string' ? item.str : '';

        if (!value) {
          continue;
        }

        if (
          !value
            .toLocaleLowerCase()
            .includes(target.toLocaleLowerCase())
        ) {
          continue;
        }

        const transform = item.transform;

        if (!transform || transform.length < 6) {
          continue;
        }

        const x = Number(transform[4]) || 0;
        const baselineY = Number(transform[5]) || 0;

        const itemHeight =
          Number(item.height) ||
          Math.abs(Number(transform[3])) ||
          10;

        const itemWidth =
          Number(item.width) ||
          Math.abs(Number(transform[0])) ||
          10;

        const y = pageHeight - baselineY - itemHeight;

        page.drawRectangle({
          x: Math.max(0, x - 2),
          y: Math.max(0, y - 1),
          width: itemWidth + 4,
          height: itemHeight + 2,
          color: rgb(0, 0, 0),
        });
      }
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  const bytes = await source.save();

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'redacted.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Compare PDF ────────────────────────────────────────────

export async function comparePDF(
  file: File,
  file2: File,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();

  const [data1, data2] = await Promise.all([
    fileToArrayBuffer(file),
    fileToArrayBuffer(file2),
  ]);

  const [pdf1, pdf2] = await Promise.all([
    pdfjsLib.getDocument({ data: data1 }).promise,
    pdfjsLib.getDocument({ data: data2 }).promise,
  ]);

  let report =
    'PDF Comparison Report\n' +
    '=====================\n\n';

  report += `File 1: ${file.name} (${pdf1.numPages} pages)\n`;
  report += `File 2: ${file2.name} (${pdf2.numPages} pages)\n\n`;

  const maxPages = Math.max(
    pdf1.numPages,
    pdf2.numPages,
  );

  let differences = 0;

  try {
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      let text1 = '';
      let text2 = '';

      if (pageNumber <= pdf1.numPages) {
        const page = await pdf1.getPage(pageNumber);
        const content = await page.getTextContent();

        text1 = content.items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (pageNumber <= pdf2.numPages) {
        const page = await pdf2.getPage(pageNumber);
        const content = await page.getTextContent();

        text2 = content.items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (text1 !== text2) {
        differences += 1;

        report +=
          `Page ${pageNumber}: DIFFERENT\n` +
          `  File 1: ${text1.substring(0, 500)}\n` +
          `  File 2: ${text2.substring(0, 500)}\n\n`;
      } else {
        report += `Page ${pageNumber}: Identical\n`;
      }
    }
  } finally {
    await Promise.all([
      typeof pdf1.destroy === 'function' ? pdf1.destroy() : Promise.resolve(),
      typeof pdf2.destroy === 'function' ? pdf2.destroy() : Promise.resolve(),
    ]);
  }

  report +=
    `\nTotal differences: ${differences} ` +
    `out of ${maxPages} pages\n`;

  return {
    blob: new Blob([report], {
      type: 'text/plain;charset=utf-8',
    }),
    filename: 'comparison_report.txt',
    mimeType: 'text/plain',
  };
}

// ─── AI Summarizer / Extractive Summarizer ──────────────────

export async function summarizePDF(
  file: File,
  ratio: number,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let fullText = '';

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      fullText +=
        content.items
          .map((item: any) => item.str || '')
          .join(' ') +
        ' ';
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  fullText = fullText.replace(/\s+/g, ' ').trim();

  if (!fullText) {
    throw new Error(
      'No selectable text was found in this PDF. Use OCR for scanned PDFs.',
    );
  }

  const sentences =
    fullText.match(/[^.!?]+[.!?]+/g) || [fullText];

  const wordFrequency: Record<string, number> = {};

  fullText
    .toLocaleLowerCase()
    .split(/\s+/)
    .forEach((value) => {
      const word = value.replace(/[^a-z0-9]/g, '');

      if (word.length > 3) {
        wordFrequency[word] =
          (wordFrequency[word] || 0) + 1;
      }
    });

  const scored = sentences.map((sentence) => {
    const words = sentence
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);

    if (!words.length) {
      return {
        sentence,
        score: 0,
      };
    }

    const score =
      words.reduce(
        (sum, word) => sum + (wordFrequency[word] || 0),
        0,
      ) / words.length;

    return {
      sentence: sentence.trim(),
      score,
    };
  });

  const safeRatio = Math.max(
    1,
    Math.min(100, Number(ratio) || 20),
  );

  const keepCount = Math.max(
    1,
    Math.min(
      sentences.length,
      Math.floor(
        (sentences.length * safeRatio) / 100,
      ),
    ),
  );

  const selected = scored
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.score - a.score)
    .slice(0, keepCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const summary = selected.join(' ');

  return {
    blob: new Blob([summary], {
      type: 'text/plain;charset=utf-8',
    }),
    filename: 'summary.txt',
    mimeType: 'text/plain',
  };
}

// ─── Translate PDF ──────────────────────────────────────────

export async function translatePDF(
  file: File,
  targetLang: string,
): Promise<ConvertResult> {
  const language = targetLang.trim();

  if (!language) {
    throw new Error('Select a target language.');
  }

  return serverConvert(file, 'pdf-translate', {
    targetLang: language,
  });
}

// ─── PDF to Markdown ────────────────────────────────────────

export async function pdfToMarkdown(
  file: File,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let markdown = '';

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      markdown += `## Page ${pageNumber}\n\n`;

      let lastY: number | null = null;

      for (const item of content.items as any[]) {
        const value =
          typeof item.str === 'string' ? item.str : '';

        const y =
          Array.isArray(item.transform) &&
          item.transform.length >= 6
            ? Number(item.transform[5])
            : null;

        if (
          lastY !== null &&
          y !== null &&
          Math.abs(y - lastY) > 5
        ) {
          markdown += '\n';
        }

        markdown += `${value} `;

        if (y !== null) {
          lastY = y;
        }
      }

      markdown += '\n\n---\n\n';
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  return {
    blob: new Blob([markdown], {
      type: 'text/markdown;charset=utf-8',
    }),
    filename: 'converted.md',
    mimeType: 'text/markdown',
  };
}

// ─── Flatten PDF ────────────────────────────────────────────

export async function flattenPDF(
  file: File,
): Promise<ConvertResult> {
  const pdfjsLib = await loadPdfjs();

  const data = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let outputPdf: jsPDF | null = null;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create flattening canvas.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise;

      const imageData = canvas.toDataURL(
        'image/jpeg',
        0.92,
      );

      const orientation =
        baseViewport.width >= baseViewport.height
          ? 'landscape'
          : 'portrait';

      const widthMm =
        baseViewport.width * 25.4 / 72;

      const heightMm =
        baseViewport.height * 25.4 / 72;

      if (!outputPdf) {
        outputPdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: [widthMm, heightMm],
        });
      } else {
        outputPdf.addPage(
          [widthMm, heightMm],
          orientation,
        );
      }

      outputPdf.addImage(
        imageData,
        'JPEG',
        0,
        0,
        widthMm,
        heightMm,
        undefined,
        'FAST',
      );

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
  }

  if (!outputPdf) {
    throw new Error('The PDF contains no pages.');
  }

  return {
    blob: createPdfBlob(outputPdf),
    filename: 'flattened.pdf',
    mimeType: 'application/pdf',
  };
}

// ─── Helpers ────────────────────────────────────────────────

function parsePageRange(
  range: string,
  total: number,
): number[] {
  const result: number[] = [];

  if (!range.trim()) {
    return result;
  }

  for (const part of range.split(',')) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.includes('-')) {
      const rangeParts = trimmed
        .split('-')
        .map((value) =>
          Number.parseInt(value.trim(), 10),
        );

      const start = rangeParts[0];
      const end = rangeParts[1];

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        continue;
      }

      const first = Math.min(start, end);
      const last = Math.min(Math.max(start, end), total);

      for (let page = first; page <= last; page += 1) {
        if (page >= 1) {
          result.push(page - 1);
        }
      }
    } else {
      const page = Number.parseInt(trimmed, 10);

      if (
        Number.isInteger(page) &&
        page >= 1 &&
        page <= total
      ) {
        result.push(page - 1);
      }
    }
  }

  return [...new Set(result)].sort(
    (a, b) => a - b,
  );
}
