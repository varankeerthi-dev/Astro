// SEO scoring — port of the audit-notebook rule set (the same checklist that
// scored the live site 69/100). Admin-only; publishers can override warnings.
export interface ScoreInput {
  seoTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  slug: string;
  bodyText?: string;        // visible text of the page (or content md/html)
  headingsText?: string;    // all heading text concatenated
  hasImagesWithAlt: boolean;
  hasCanonical: boolean;
  hasOg: boolean;
  hasTwitter: boolean;
  internalLinks: number;
}

export interface SeoWarning {
  rule: string;
  message: string;
  weight: number;
}

export function scoreSeo(input: ScoreInput): { score: number; warnings: SeoWarning[] } {
  const warnings: SeoWarning[] = [];
  const title = (input.seoTitle ?? '').trim();
  const desc = (input.metaDescription ?? '').trim();
  const kw = (input.focusKeyword ?? '').trim().toLowerCase();
  const body = (input.bodyText ?? '').toLowerCase();
  const headings = (input.headingsText ?? '').toLowerCase();
  const words = (input.bodyText ?? '').split(/\s+/).filter(Boolean).length;

  const add = (weight: number, rule: string, message: string, ok: boolean) => {
    if (!ok) warnings.push({ rule, message, weight });
  };

  // title (20)
  add(10, 'title.length', `SEO title should be 30–60 chars (now ${title.length}).`, title.length >= 30 && title.length <= 60);
  add(10, 'title.duplicateSite', 'SEO title should not just repeat the site name.', !title.toLowerCase().includes('origin-erp') || title.length > 25);

  // description (15)
  add(15, 'desc.length', `Meta description should be 70–160 chars (now ${desc.length}).`, desc.length >= 70 && desc.length <= 160);

  // keyword placement (25)
  add(8, 'kw.title', 'Focus keyword should appear in the SEO title.', kw === '' || title.toLowerCase().includes(kw));
  add(6, 'kw.h1', 'Focus keyword should appear in a heading.', kw === '' || headings.includes(kw));
  add(6, 'kw.body', 'Focus keyword should appear in the body copy.', kw === '' || body.includes(kw));
  add(5, 'kw.slug', 'Focus keyword should appear in the URL slug.', kw === '' || input.slug.toLowerCase().includes(kw.split(' ')[0]));

  // content (10)
  add(10, 'content.length', `Aim for at least 300 visible words (now ${words}).`, words >= 300);

  // on-page structure (10)
  add(5, 'images.alt', 'Every image needs alt text.', input.hasImagesWithAlt);
  add(5, 'h1.single', 'Exactly one H1 per page.', true); // enforced by the editor; placeholder rule

  // technical/social (20)
  add(5, 'canonical', 'Canonical URL must be set.', input.hasCanonical);
  add(5, 'og', 'Open Graph tags must be set.', input.hasOg);
  add(5, 'twitter', 'Twitter card tags must be set.', input.hasTwitter);
  add(5, 'internal.links', 'At least one internal link on the page.', input.internalLinks >= 1);

  const deducted = warnings.reduce((sum, w) => sum + w.weight, 0);
  return { score: Math.max(0, 100 - deducted), warnings };
}
