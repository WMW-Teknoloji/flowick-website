# NEREDE KALDIK — flowick-website

Güncelleme: 2026-08-03

## Durum

SEO çalışması (ilk büyük tur) TAMAM ve **CANLIDA**. Canlıda doğrulandı:
6 route'un hepsi 200 + özgün title, bilinmeyen URL 404 veriyor, `robots.txt` temiz
servis ediliyor (Cloudflare "Managed robots.txt" kapatıldı), `sitemap.xml` erişilebilir.

## Bu turda yapılanlar (SEO)

1. **Prerender**: `scripts/prerender.ts` — build sonrası her route için statik HTML üretir
   (`/`, `/urunler`, `/blog`, `/blog/:slug`). Her sayfaya özgün title, description,
   canonical, OG/Twitter kartları ve JSON-LD (`Organization`, ana sayfada `SoftwareApplication`,
   blog yazılarında `BlogPosting` + `BreadcrumbList`) gömülür.
   `npm run build` = tsc + vite build + prerender. Çıktı ayrıca `sitemap.xml` ve `404.html` üretir.
2. **`src/seo.ts`**: meta kayıtları tek kaynak; SPA gezinmelerinde `applyMeta` head'i günceller
   (main.ts `wrapWithNav` içinden çağrılır).
3. **İç linkler**: nav'daki Ürünler/Blog artık gerçek `<a href>`; blog kartları `<a>`;
   blog detaydaki "Blog'a Dön" `<a>`. Router `[data-link]` tıklamalarını intercept eder,
   ctrl/cmd/shift/orta tık native bırakılır.
4. **`public/_redirects` silindi**: statik dosyalar doğrudan servis edilir; bilinmeyen URL'ler
   CF Pages'in `404.html`'ine düşer (noindex'li). Router bilinmeyen path'te içeriğe dokunmaz.
5. **`public/robots.txt`** eklendi (herkese açık + Sitemap satırı).
6. **Görseller lokale taşındı**: 11 referans logosu (`refs/`), 19 ürün ikonu (`products/`),
   3 blog yazısının card+hero görselleri (`blog/`), 3 sertifika (zaten repoda vardı, index.html
   referansları güncellendi). Bubble CDN bağımlılığı bitti (tek istisna aşağıda).
7. **İnce ayar**: boş alt'lar dolduruldu, below-fold görsellere `loading="lazy"`,
   hero'ya `fetchpriority="high"`, fonts `display=swap` + preconnect, ürünler sayfasındaki
   nested `<main>` düzeltildi, ürünler sayfasına h1'li başlık bloğu eklendi,
   blog detayda h2 altyazı → `<p class="blog-detail-subtitle">`.

## Doğrulama

- `npm run build` temiz, vitest 8/8 yeşil.
- Playwright ile 5 route ekran görüntüsü alındı: konsol hatası sıfır, SPA gezinmede title değişiyor.

## Açık işler / dış girdi bekleyenler

- **Cloudflare bot ayarları TAMAM** (2026-08-03): "Managed robots.txt" kapatıldı,
  "Block AI bots Scope" → *Do not block* yapıldı, ardından AI Crawl Control → Security'de
  12 kazıyıcı tek tek engellendi (Bytespider, CCBot, Amazonbot, Anchor Browser, FacebookBot,
  Meta-ExternalAgent, PetalBot, TikTok Spider, Novellum, Timpibot, ProRataInc, Arquivo).
  Gerçek user-agent'larla doğrulandı: ClaudeBot/GPTBot/PerplexityBot → 200,
  CCBot/Bytespider → 403.
- **Görev Yönetimi ürün ikonu**: Bubble CDN 403 veriyor (canlıda da kırıktı). Kart şimdilik
  görselsiz; yeni ikon bulununca `products.ts` içine eklenecek.
- **Deploy**: push'ta otomatik (CF Pages git bağlı, master'dan deploy ediyor — doğrulandı).
- **GA4/GTM yok** — çerez politikası GA'dan bahsediyor ama ölçüm scripti yok. Measurement ID gerekli.
- **OG görseli**: şimdilik hero.png; 1200x630 özel OG görseli üretilebilir.
- **Search Console**: sitemap.xml gönderilecek (Google hesabı gerekli).
- Sosyal medyadaki facebook/twitter linkleri hâlâ `#`.

## Sıradaki adaylar (öncelik sırasıyla)

1. Search Console kaydı + sitemap gönderimi (Google hesabı gerekli)
2. GA4 kurulumu (dönüşüm: form gönderimi, telefon tıklaması, store linkleri)
3. Blog içerik takvimi (BPM/süreç yönetimi anahtar kelimeleri; mevcut 3 yazı iyi bir çekirdek)
4. Özel OG görselleri + ürün kartlarına gerçek ekran görüntüleri
5. FontAwesome 4.7 → yerel ikon subseti (render-block + eski sürüm)

## Tuzaklar

- `npm run build` prerender dahil; sadece `vite build` çalıştırırsan dist'te meta'sız SPA kalır.
- `dist/index.html` şablon olarak kullanılır: `<main id="app"></main>` ve
  `<meta name="description" ...>` yapısı değişirse `scripts/prerender.ts` regex'leri güncellenmeli
  (bulamazsa hata fırlatır, sessiz geçmez).
- Kaynak dosyalar UTF-8; PowerShell'de `Get-Content` mojibake gösterir, aldırma.
- Prerender çıktısı **`foo.html`** biçiminde yazılır, `foo/index.html` DEĞİL. Cloudflare Pages
  ikincisini `/foo/` altında servis edip `/foo`yu 308'ler; kanonik URL'lerimiz eğik çizgisiz
  olduğu için bu yönlendirme zinciri istenmiyor.
