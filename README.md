# Flowick BPM — Web Sitesi

[flowick.com](https://flowick.com) — TypeScript + Vite ile yazılmış tek sayfalık uygulama (SPA),
Cloudflare Pages üzerinde yayında. `master`'a push edildiğinde otomatik deploy olur.

## Klasör Yapısı

```
flowick-website/
├── index.html            # HTML kabuğu (navbar, footer, KVKK/gizlilik/çerez modalları)
├── src/
│   ├── main.ts           # Giriş noktası; route'ları bağlar
│   ├── router.ts         # History API tabanlı yönlendirici
│   ├── seo.ts            # Route başına meta/JSON-LD tek kaynağı
│   ├── header.ts         # Mobil menü, bölüme kaydırma
│   ├── forms.ts          # İletişim formu → /api/contact, Turnstile, telefon maskesi
│   ├── select.ts         # Ürün seçimi için erişilebilir özel açılır liste
│   ├── toast.ts          # Sayfa üstü geçici bildirim (form başarı mesajı)
│   ├── pages/            # home, urunler, blog, blog-detay
│   ├── content/          # Blog yazıları (veri olarak)
│   └── shared/           # Akordeon, modallar, HTML kaçış yardımcısı
├── scripts/prerender.ts  # Build sonrası statik HTML + sitemap + 404 üretimi
├── functions/api/        # Cloudflare Pages Function (iletişim formu)
└── public/               # Statik dosyalar (görseller, CSS, robots.txt)
```

## Komutlar

```bash
npm install
npm run dev        # Geliştirme sunucusu
npm run build      # tsc + vite build + prerender  ← deploy edilecek çıktı
npm test           # Vitest
npm run preview    # Build çıktısını yerelde servis et
npm run deploy     # wrangler pages deploy dist (elle deploy gerekirse)
```

> `npm run build` prerender adımını içerir. Sadece `vite build` çalıştırırsan
> `dist/` içinde meta'sız, içeriği boş bir SPA kalır.

## SEO Altyapısı

Site istemci tarafında çiziliyor; arama motorlarının boş HTML görmemesi için build
sırasında her route statik olarak üretiliyor.

- **Prerender** (`scripts/prerender.ts`): `dist/index.html`'i şablon alıp her route için
  içeriği dolu HTML yazar — `/`, `/urunler`, `/blog` ve her blog yazısı. Çıktı
  `foo.html` biçimindedir (`foo/index.html` değil); Cloudflare Pages ikinci biçimi
  `/foo/` altında servis edip `/foo`yu 308'lediği ve kanonik URL'lerimiz eğik çizgisiz
  olduğu için bu önemli.
- **Meta** (`src/seo.ts`): Her route'un kendi title, description, canonical ve
  Open Graph/Twitter kartı var. Aynı modül SPA gezinmelerinde `<head>`'i günceller.
- **Yapısal veri**: `Organization` her sayfada; ana sayfada `SoftwareApplication`;
  blog yazılarında `BlogPosting` + `BreadcrumbList`.
- **sitemap.xml** ve **404.html** (noindex'li) build sırasında üretilir.
- **robots.txt** (`public/`) tüm botlara açık, sitemap'i işaret eder.
- İç linkler gerçek `<a href>` — router tıklamayı devralır ama ctrl/cmd/orta tıkı
  tarayıcıya bırakır.
- Görseller repoda; Bubble.io CDN bağımlılığı yok.

Prerender şablonu doğrular: `index.html`'deki `<title>`, meta description,
`</head>` veya `<main id="app"></main>` yapısı değişirse build sessizce geçmez, hata verir.

### Cloudflare bot ayarları

AI Crawl Control'de "Managed robots.txt" kapalı ve "Block AI bots" → *Do not block*.
Arama/asistan botları (ClaudeBot, GPTBot, PerplexityBot, OAI-SearchBot vb.) geçebilir;
model eğitimi ve veri kazıma botları (Bytespider, CCBot, Amazonbot, PetalBot vb.)
tek tek engellenmiştir.

## İletişim Formu

`functions/api/contact.ts` bir Cloudflare Pages Function'dır; form gönderimini
`/api/contact` üzerinden alır. İstek akışı: Turnstile jetonu doğrulanır →
IP başına hız sınırı (KV, 15 dk'da 5 istek) → alan doğrulaması → Resend.

**Gerekli ortam değişkenleri** (Pages → Settings → Variables and Secrets, tümü Secret):

| Değişken | Amaç |
|---|---|
| `RESEND_API_KEY` | Mail gönderimi |
| `TO_EMAIL` | Alıcı(lar), virgülle ayrılabilir |
| `FROM_EMAIL` | Gönderen adresi |
| `TURNSTILE_SECRET_KEY` | Bot doğrulaması — **eksikse form 500 döner** (fail-closed, kasıtlı) |

**KV binding** (`wrangler.toml`'de tanımlı, `RATE_LIMIT`): hız sınırı sayacı için.
Bağlı değilse form yine çalışır ama korumasız kalır (fail-open, `console.warn` loglar).

Yerel geliştirme için `.dev.vars` gerekir (gitignore'da, repoda yok). Turnstile'ın
herkese açık test anahtarlarını kullanabilirsiniz: `1x0000000000000000000000000000000AA`
(her zaman geçer) / `2x0000000000000000000000000000000AA` (her zaman reddeder).

## Bilinen Eksikler

- GA4 / ölçüm kodu yok (çerez politikası bahsediyor ama script eklenmedi).
- Google Search Console kaydı ve sitemap gönderimi yapılmadı.
- Footer'daki Facebook ve Twitter linkleri hâlâ `#`.
- "Görev Yönetimi" ürün kartının ikonu yok (kaynak görsel Bubble CDN'de 403 veriyor).
- Rate limit yalnız `/api/contact`'ı korur, site geneli WAF kuralı yok.
- KVKK açık rıza kutusu hukuki inceleme görmedi.

Devam eden işler ve devir notu: [`docs/NEREDE-KALDIK.md`](docs/NEREDE-KALDIK.md)
