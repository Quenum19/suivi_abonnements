/** Applique la couleur de marque d'une organisation via des variables CSS. */

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Teinte claire (mélange avec du blanc) pour les fonds « soft ». */
function tint([r, g, b]: [number, number, number], ratio = 0.88): string {
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function applyBranding(brandColor: string | null | undefined): void {
  const root = document.documentElement;
  const rgb = brandColor ? hexToRgb(brandColor) : null;
  if (rgb) {
    root.style.setProperty('--brand', brandColor!);
    root.style.setProperty('--brand-soft', tint(rgb));
  } else {
    root.style.removeProperty('--brand');
    root.style.removeProperty('--brand-soft');
  }
}
