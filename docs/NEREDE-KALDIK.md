# NEREDE KALDIK — flowick-website

Güncelleme: 2026-08-03

## Durum

SEO çalışması (ilk büyük tur) TAMAM, commit bekliyor / yeni commit'lendi.

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

- **Cloudflare dashboard: "Block AI bots" KAPATILACAK** (kullanıcı onayladı, kendisi yapacak).
  Şu an GPTBot/ClaudeBot/CCBot vb. engelli + robots.txt'ye CF managed content signals ekleniyor.
  Kapatılınca bizim `public/robots.txt` temiz servis edilir.
- **Görev Yönetimi ürün ikonu**: Bubble CDN 403 veriyor (canlıda da kırıktı). Kart şimdilik
  görselsiz; yeni ikon bulununca `products.ts` içine eklenecek.
- **Deploy**: repo CF Pages'e git-bağlıysa push yeter; değilse `npm run deploy`
  (wrangler pages deploy dist).
- **GA4/GTM yok** — çerez politikası GA'dan bahsediyor ama ölçüm scripti yok. Measurement ID gerekli.
- **OG görseli**: şimdilik hero.png; 1200x630 özel OG görseli üretilebilir.
- **Search Console**: sitemap.xml gönderilecek (Google hesabı gerekli).
- Sosyal medyadaki facebook/twitter linkleri hâlâ `#`.

## Sıradaki adaylar (öncelik sırasıyla)

1. Deploy + Search Console kaydı + sitemap gönderimi
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
