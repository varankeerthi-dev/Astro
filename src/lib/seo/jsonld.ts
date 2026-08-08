// JSON-LD builders per page type (design doc §9.2).
export type JsonLd = Record<string, unknown> | Record<string, unknown>[];

export function organization(siteName: string, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url,
  };
}

export function breadcrumb(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function blogPosting(post: {
  title: string;
  url: string;
  excerpt: string;
  author?: string | null;
  publishAt: string;
  imageUrl?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url: post.url,
    description: post.excerpt,
    ...(post.author ? { author: { '@type': 'Person', name: post.author } } : {}),
    datePublished: post.publishAt,
    ...(post.imageUrl ? { image: post.imageUrl } : {}),
  };
}

export function servicePage(loc: {
  name: string;
  url: string;
  description: string;
  city: string;
  state: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: loc.name,
    url: loc.url,
    description: loc.description,
    areaServed: { '@type': 'City', name: loc.city, address: { '@type': 'PostalAddress', addressRegion: loc.state } },
    provider: { '@type': 'Organization', name: 'Origin-ERP' },
  };
}

export function techArticle(article: {
  title: string;
  url: string;
  summary: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    url: article.url,
    description: article.summary,
    dateModified: article.updatedAt,
  };
}


export function webSite(siteName: string, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url,
  };
}
