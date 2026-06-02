import { prisma } from '../db.js';

export function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/** Slug unique pour une organisation (ajoute un suffixe si déjà pris). */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  // Boucle bornée pour éviter tout blocage.
  while (i < 1000 && (await prisma.organization.findUnique({ where: { slug } }))) {
    slug = `${base}-${i++}`;
  }
  return slug;
}
