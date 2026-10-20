import { extractText, getDocumentProxy } from 'unpdf';

// D200/D201: generated files are inspected through a real PDF parser instead
// of matching bytes or reading pdf-lib internals. This helper is test-only;
// unpdf is a devDependency and is never imported by runtime code.
export interface ExtractedPdf {
  totalPages: number;
  text: string;
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  // pdf.js takes ownership of the buffer it is given; the copy keeps the
  // caller's bytes usable after extraction.
  const document = await getDocumentProxy(Uint8Array.from(bytes));
  const { totalPages, text } = await extractText(document, {
    mergePages: true,
  });

  return { totalPages, text };
}
