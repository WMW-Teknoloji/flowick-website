import { findPostBySlug, type BlogPost } from './content/blog-posts';

export const SITE_URL = 'https://flowick.com';
export const SITE_NAME = 'Flowick';
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/hero.png`;

const ORG_ID = `${SITE_URL}/#organization`;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mycompany.flowickbpm';
const APP_STORE_URL = 'https://apps.apple.com/us/app/flowick-bpm/id6736679156';

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  ogImage: string;
  ogType: 'website' | 'article';
}

/** dd/mm/yyyy → yyyy-mm-dd */
export function toIsoDate(date: string): string {
  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
}

function truncate(text: string, max = 155): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function metaForPath(path: string): PageMeta {
  if (path === '/urunler') {
    return {
      title: 'Flowick BPM Modülleri — İK, CRM, Stok, Finans ve 20+ Ürün',
      description:
        'Flowick BPM modülleri: İnsan Kaynakları, İntranet, Görev Yönetimi, PDKS, Puantaj, Satın Alma, Doküman, Finans, CRM ve daha fazlası. Kurumunuza göre özelleştirilir.',
      path: '/urunler',
      ogImage: DEFAULT_OG_IMAGE,
      ogType: 'website',
    };
  }

  if (path === '/blog') {
    return {
      title: 'Blog — Dijital Dönüşüm ve İş Süreçleri Yönetimi | Flowick',
      description:
        'Dijital dönüşüm, insan kaynakları ve iş süreçleri yönetimi üzerine Flowick ekibinden güncel yazılar ve pratik rehberler.',
      path: '/blog',
      ogImage: DEFAULT_OG_IMAGE,
      ogType: 'website',
    };
  }

  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = findPostBySlug(blogMatch[1] ?? '');
    if (post) {
      return {
        title: `${post.title} | Flowick Blog`,
        description: truncate(post.subtitle),
        path: `/blog/${post.slug}`,
        ogImage: `${SITE_URL}${post.heroImage}`,
        ogType: 'article',
      };
    }
  }

  return {
    title: 'Flowick BPM — İş Süreçleri Yönetim Yazılımı | Süreç Otomasyonu',
    description:
      'Flowick BPM ile iş süreçlerinizi tek platformdan yönetin. İK, CRM, stok, finans dahil 20+ modül; web ve mobil uygulama. Kurumunuza özel süreç otomasyonu için bize ulaşın.',
    path: '/',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
  };
}

const organizationJsonLd = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'Flowick Teknoloji Hizmetleri A.Ş.',
  url: SITE_URL,
  logo: `${SITE_URL}/assets/logos/flowick-logo-nav.svg`,
  telephone: '+90 850 307 3785',
  email: 'info@flowick.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Küçükbakkalköy Mah. Defne Sk. Flora Residance No:1 İç Kapı No:365',
    addressLocality: 'Ataşehir',
    addressRegion: 'İstanbul',
    addressCountry: 'TR',
  },
  sameAs: [
    'https://www.linkedin.com/company/flowick-teknoloji/',
    'https://www.instagram.com/flowickteknoloji/',
    PLAY_STORE_URL,
    APP_STORE_URL,
  ],
};

function blogPostingJsonLd(post: BlogPost): object[] {
  const url = `${SITE_URL}/blog/${post.slug}`;
  return [
    {
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.subtitle,
      image: `${SITE_URL}${post.heroImage}`,
      datePublished: toIsoDate(post.date),
      inLanguage: 'tr',
      author: { '@type': 'Person', name: post.author },
      publisher: { '@id': ORG_ID },
      mainEntityOfPage: url,
      url,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
}

export function jsonLdForPath(path: string): object {
  const graph: object[] = [organizationJsonLd];

  if (path === '/') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'Flowick BPM',
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      inLanguage: 'tr',
      description:
        'İş süreçleri yönetimi (BPM) yazılımı: süreç otomasyonu, İK, görev, doküman ve finans yönetimi tek platformda.',
      installUrl: [PLAY_STORE_URL, APP_STORE_URL],
      publisher: { '@id': ORG_ID },
    });
  }

  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = findPostBySlug(blogMatch[1] ?? '');
    if (post) graph.push(...blogPostingJsonLd(post));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function upsertMetaByName(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** SPA gezinmelerinde head'i güncel tutar; ilk yükte prerender edilmiş head zaten doludur. */
export function applyMeta(meta: PageMeta): void {
  document.title = meta.title;
  upsertMetaByName('description', meta.description);

  const canonicalUrl = meta.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${meta.path}`;
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);

  upsertMetaByProperty('og:title', meta.title);
  upsertMetaByProperty('og:description', meta.description);
  upsertMetaByProperty('og:url', canonicalUrl);
  upsertMetaByProperty('og:image', meta.ogImage);
  upsertMetaByProperty('og:type', meta.ogType);
}
