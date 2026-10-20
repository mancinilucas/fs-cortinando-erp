import { buildContentDisposition } from './document-filename.js';

describe('buildContentDisposition', () => {
  it('builds the commercial filename with an ASCII fallback and filename*', () => {
    expect(buildContentDisposition('commercial-pdf', 'ORÇ-2026-0001')).toBe(
      'inline; filename="orcamento-ORC-2026-0001.pdf"; ' +
        "filename*=UTF-8''orcamento-OR%C3%87-2026-0001.pdf",
    );
  });

  it('builds the production order filename', () => {
    expect(buildContentDisposition('production-order', 'ORÇ-2026-0001')).toBe(
      'inline; filename="ordem-de-producao-ORC-2026-0001.pdf"; ' +
        "filename*=UTF-8''ordem-de-producao-OR%C3%87-2026-0001.pdf",
    );
  });

  it('omits filename* when the quote number is already ASCII', () => {
    expect(buildContentDisposition('commercial-pdf', 'ORC-2026-0001')).toBe(
      'inline; filename="orcamento-ORC-2026-0001.pdf"',
    );
  });

  it('sanitizes unsafe characters from the fallback filename', () => {
    const disposition = buildContentDisposition(
      'commercial-pdf',
      '../ORÇ 2026/001"',
    );

    expect(disposition).toContain('filename="orcamento-ORC-2026-001.pdf"');
    expect(disposition).not.toContain('filename="orcamento-..');
    expect(disposition).not.toContain('001".pdf"');
    expect(disposition).toContain("filename*=UTF-8''");
  });
});
