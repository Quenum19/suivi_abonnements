import type PDFDocument from 'pdfkit';

type Doc = InstanceType<typeof PDFDocument>;

const INK = '#1B1A17';
const MUTED = '#6E685D';
const LINE = '#E5DDCF';
const PAPER = '#F7F3EC';
const DEFAULT_BRAND = '#1F4D46';

export const MARGIN = 44;

/** Valide une couleur hex, sinon renvoie la couleur de marque par défaut. */
export function safeBrand(hex: string | null | undefined): string {
  return hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : DEFAULT_BRAND;
}

/** Choisit du texte noir ou blanc selon la luminance du fond. */
export function idealText(hexBg: string): string {
  let h = hexBg.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? INK : '#FFFFFF';
}

/** Charge un logo (data URL base64 ou http) en Buffer PNG/JPEG, ou null. */
export async function getLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const m = url.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      return m ? Buffer.from(m[2], 'base64') : null;
    }
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url);
      if (!r.ok) return null;
      if (!/png|jpe?g/i.test(r.headers.get('content-type') || '')) return null;
      return Buffer.from(await r.arrayBuffer());
    }
  } catch {
    return null;
  }
  return null;
}

/** Bandeau d'en-tête coloré : logo + titre + sous-titre. */
export function header(
  doc: Doc,
  opts: { brand: string; title: string; subtitle: string; logo: Buffer | null },
): void {
  const W = doc.page.width;
  const fg = idealText(opts.brand);
  doc.save();
  doc.rect(0, 0, W, 104).fill(opts.brand);
  let textX = MARGIN;
  if (opts.logo) {
    try {
      doc.roundedRect(MARGIN, 28, 48, 48, 8).fill('#FFFFFF');
      doc.image(opts.logo, MARGIN + 4, 32, { fit: [40, 40] });
      textX = MARGIN + 64;
    } catch {
      textX = MARGIN;
    }
  }
  doc.fillColor(fg).font('Helvetica-Bold').fontSize(20).text(opts.title, textX, 34, { width: W - textX - MARGIN });
  doc.font('Helvetica').fontSize(10).fillColor(fg).opacity(0.85).text(opts.subtitle, textX, 62, { width: W - textX - MARGIN });
  doc.opacity(1).restore();
  doc.fillColor(INK);
  doc.x = MARGIN;
  doc.y = 128;
}

/** Rangée de cartes de synthèse. */
export function statCards(
  doc: Doc,
  cards: { label: string; value: string }[],
  brand: string,
): void {
  const W = doc.page.width;
  const gap = 12;
  const usable = W - MARGIN * 2;
  const cw = (usable - gap * (cards.length - 1)) / cards.length;
  const y = doc.y;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cw + gap);
    doc.roundedRect(x, y, cw, 56, 10).fillAndStroke(PAPER, LINE);
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text(c.label.toUpperCase(), x + 12, y + 11, { width: cw - 24 });
    doc.fillColor(brand).font('Helvetica-Bold').fontSize(14).text(c.value, x + 12, y + 26, { width: cw - 24 });
  });
  doc.fillColor(INK).font('Helvetica');
  doc.y = y + 56 + 20;
  doc.x = MARGIN;
}

export interface Column {
  label: string;
  width: number; // proportion (sommée librement)
  align?: 'left' | 'right';
}

/** Tableau structuré avec en-tête coloré, lignes alternées et pagination. */
export function table(doc: Doc, columns: Column[], rows: string[][], brand: string): void {
  const W = doc.page.width;
  const usable = W - MARGIN * 2;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const widths = columns.map((c) => (c.width / totalW) * usable);
  const xs: number[] = [];
  let acc = MARGIN;
  for (const w of widths) {
    xs.push(acc);
    acc += w;
  }
  const headFg = idealText(brand);
  const rowH = 22;
  const bottom = doc.page.height - 56;

  const drawHead = () => {
    const y = doc.y;
    doc.rect(MARGIN, y, usable, rowH).fill(brand);
    doc.fillColor(headFg).font('Helvetica-Bold').fontSize(8.5);
    columns.forEach((c, i) => {
      doc.text(c.label.toUpperCase(), xs[i] + 8, y + 7, {
        width: widths[i] - 16,
        align: c.align ?? 'left',
        lineBreak: false,
      });
    });
    doc.y = y + rowH;
    doc.fillColor(INK).font('Helvetica');
  };

  drawHead();
  rows.forEach((row, r) => {
    if (doc.y + rowH > bottom) {
      doc.addPage();
      doc.y = MARGIN;
      drawHead();
    }
    const y = doc.y;
    if (r % 2 === 1) doc.rect(MARGIN, y, usable, rowH).fill(PAPER);
    doc.fillColor(INK).font('Helvetica').fontSize(8.5);
    columns.forEach((c, i) => {
      doc.fillColor(i === 0 ? INK : '#444444').text(row[i] ?? '', xs[i] + 8, y + 7, {
        width: widths[i] - 16,
        align: c.align ?? 'left',
        lineBreak: false,
      });
    });
    doc.y = y + rowH;
  });
  // Filet de fin de tableau.
  doc.moveTo(MARGIN, doc.y).lineTo(W - MARGIN, doc.y).strokeColor(LINE).stroke();
  doc.fillColor(INK);
}

/** Pieds de page « Page X / Y » sur toutes les pages (doc en bufferPages). */
export function footers(doc: Doc, left: string): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 36;
    doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(left, MARGIN, y + 8, { width: 300, align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} / ${range.count}`, doc.page.width - MARGIN - 120, y + 8, {
      width: 120,
      align: 'right',
      lineBreak: false,
    });
  }
}
