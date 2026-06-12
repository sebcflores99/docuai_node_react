import mammoth from 'mammoth';
import { AppError } from '../../lib/errors';

export interface ExtractedDocument {
  /** Full plain-text content of the document. */
  content: string;
  /**
   * Character offsets where each page begins (page 1 starts at 0). Used by the
   * chunker to assign real page numbers to chunks. A single-page document has
   * boundaries `[0]`.
   */
  pageBoundaries: number[];
}

export interface ExtractInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ESM-only modules (pdfjs-dist v6) must be loaded via a real dynamic import.
// Using `new Function` prevents TypeScript (module: commonjs) from rewriting
// import() into require(), which would fail on an ES module.
const importESM = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

/**
 * Extracts plain text (and page boundaries) from an uploaded file. Supports
 * pdf, docx, and plain text (txt/md). All extraction is local — no external
 * OCR service. Image-only/scanned PDFs (no extractable text) are rejected with
 * a clear error so the caller can mark the document FAILED.
 */
export async function extractText(input: ExtractInput): Promise<ExtractedDocument> {
  if (input.buffer.length === 0) {
    throw new AppError(400, 'Uploaded file is empty', 'EMPTY_FILE');
  }
  if (input.buffer.length > MAX_FILE_BYTES) {
    throw new AppError(400, 'File exceeds the 10 MB limit', 'FILE_TOO_LARGE');
  }

  const kind = detectKind(input.fileName, input.mimeType);

  switch (kind) {
    case 'pdf':
      return extractPdf(input.buffer);
    case 'docx':
      return extractDocx(input.buffer);
    case 'text':
      return singlePage(input.buffer.toString('utf-8'));
    default:
      throw new AppError(415, `Unsupported file type: ${kind}`, 'UNSUPPORTED_FILE_TYPE');
  }
}

type Kind = 'pdf' | 'docx' | 'text' | 'unsupported';

function detectKind(fileName: string, mimeType?: string): Kind {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (
    ext === 'docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  // Old binary .doc isn't supported by local libs without heavy deps.
  if (ext === 'doc' || mimeType === 'application/msword') return 'unsupported';
  if (['txt', 'md', 'markdown', 'text', 'csv', 'log'].includes(ext)) return 'text';
  if (mimeType?.startsWith('text/')) return 'text';
  return 'unsupported';
}

/** Wraps a plain string as a single-page document. */
function singlePage(content: string): ExtractedDocument {
  return { content, pageBoundaries: [0] };
}

async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    if (!value.trim()) {
      throw new AppError(422, 'No extractable text found in the document', 'NO_TEXT_EXTRACTED');
    }
    // Word has no reliable page model in raw text; treat as a single page.
    return singlePage(value);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(422, 'Failed to read the Word document', 'EXTRACTION_FAILED');
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const pdfjs = (await importESM('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;

  const pageBoundaries: number[] = [];
  let content = '';

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      pageBoundaries.push(content.length);
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      content += `${pageText}\n`;
      page.cleanup();
    }
  } finally {
    await doc.cleanup();
  }

  if (!content.trim()) {
    throw new AppError(
      422,
      'No extractable text found — the PDF appears to be scanned or image-only',
      'NO_TEXT_EXTRACTED',
    );
  }

  return { content, pageBoundaries: pageBoundaries.length > 0 ? pageBoundaries : [0] };
}
