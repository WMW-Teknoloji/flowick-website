# NEREDE KALDIK — flowick-website

Güncelleme: 2026-08-04

## Son tur (2026-08-04, ikinci iş) — TURNSTILE + HIZ SINIRI

Form çalışıyordu ama korumasızdı: herkes `/api/contact`'a sınırsız POST atıp
Resend kotasını ve gelen kutusunu doldurabiliyordu. İki katman eklendi.

**Mimari kararı:** siteverify çağrısı ayrı bir Worker'a değil, **mevcut Pages
Function'ının içine** kondu. Ayrı Worker olsaydı saldırgan Worker'ı atlayıp
doğrudan `/api/contact`'a POST atabilirdi — koruma kâğıt üstünde kalırdı.

**İstek akışı** (`functions/api/contact.ts`):
1. Ortam değişkeni kontrolü — `TURNSTILE_SECRET_KEY` artık **zorunlu** listesinde
2. JSON çözümleme
3. Jeton (`cf-turnstile-response`) yoksa → **400**
4. Cloudflare siteverify → ağ/HTTP hatası **500**, `success:false` → **403**
5. Hız sınırı (KV) → aşıldıysa **429**
6. Alan doğrulaması → **400**
7. Resend

Sıra kasıtlı: **Turnstile hız sınırından önce**. Jetonu çözemeyen bot KV'ye hiç
dokunmaz, yani KV ücretsiz kotası flood'da yanmaz.

**Hız sınırı:** IP başına **15 dakikada 5 istek**, sabit pencere, KV sayacı
(`hiz:contact:<ip>`, `expirationTtl 900`). KV atomik değil — eşzamanlı isteklerde
sınır birkaç istek kayabilir, iletişim formu için kabul edilebilir.

**Hata davranışı — bilerek asimetrik:**
- `TURNSTILE_SECRET_KEY` yoksa → **fail-closed** (500). Güvenlik kontrolü sessizce
  devre dışı kalmasın diye. **Bu yüzden secret push'tan ÖNCE girilmeli.**
- KV bağlı değilse ya da okunamıyorsa → **fail-open** (form çalışır, `console.warn`).
  Koruma kaybolur ama form ölmez.

**Frontend** (`src/forms.ts`): `api.js?render=explicit` + JS ile açık çizim.
SPA gezinmesinde form sonradan basıldığı için örtük (implicit) çizim ıskalardı.
API henüz yüklenmemişse 100 ms'de bir yoklanır, 15 sn sonra bırakılır. Jeton
**tek kullanımlık** — her denemeden sonra `finally` içinde `turnstile.reset()`.
Jeton boşsa istek hiç atılmaz.

**Altyapı:**
- KV namespace `RATE_LIMIT` = `5c6910b20ae4423eaa800613feb64dd7`, `wrangler.toml`'de
- Turnstile widget: hesap seviyesinde (zone altında DEĞİL), Managed, pre-clearance kapalı,
  hostname'ler `flowick.com` / `www.flowick.com` / `localhost` / `127.0.0.1`
- Sitekey `src/forms.ts`'te tek sabit; `home.ts` şablonu oradan okur (sürüklenme olmasın)
- `.dev.vars` gitignore'a eklendi (eskiden değildi — secret sızma riskiydi)

**Doğrulama:** 48 test yeşil (25 yeni). Ayrıca `wrangler pages dev` ile gerçek
runtime'da: jetonsuz → 400, `2x00…` gizli anahtarıyla gerçek siteverify → 403,
6. istek → 429, `--kv` bayrağı olmadan `env.RATE_LIMIT` bağlandı (yani binding
`wrangler.toml`'den geliyor, canlıda da gelecek).

**Tuzaklar:**
- Turnstile paneli **hesap** seviyesinde: `dash.cloudflare.com/<account_id>/turnstile`.
  Alan adının içinden bakınca görünmez.
- wrangler OAuth token'ında Turnstile yetkisi **yok**; widget ya panelden ya da
  `Account.Turnstile:Edit` izinli ayrı API token'la yaratılır.
- Test anahtarları: `1x0000000000000000000000000000000AA` her zaman geçer,
  `2x0000000000000000000000000000000AA` her zaman reddeder.

**Açık kalan:** Rate limit yalnız `/api/contact`'ı korur; site geneli WAF kuralı yok.
Sayaç IP başına — NAT arkasındaki ofis paylaşımlı sayaca düşer (5 istek/15 dk o ofis için).

## Önceki tur (2026-08-04) — İLETİŞİM FORMU BOZUKTU, DÜZELTİLDİ

**Arıza:** `POST /api/contact` canlıda 500 dönüyordu. Pages production ortamında
`RESEND_API_KEY`, `TO_EMAIL`, `FROM_EMAIL` **hiç tanımlı değildi** (wrangler
`secret put` "Creating" dedi, yani yoklardı). Formu dolduran herkes kırmızı hata
gördü, hiçbir başvuru ulaşmadı. Resend gönderim kaydına göre **17 Haziran'dan
4 Ağustos'a kadar tek bir gerçek gönderim yok** — 7 hafta sessiz veri kaybı.

**Teşhis zinciri:** doğrudan Resend API'ye gönderim 200 + `delivered` (anahtar,
domain, `noreply@flowick.com` sağlam) → aynı iş Function üzerinden 500 →
`pages secret list` boş. Yani kod ve Resend değil, ortam değişkenleri.

**Yapılanlar:**
1. Üç değişken Pages production'a **Secret** olarak girildi
   (`wrangler pages secret put ... --project-name flowick-website-page-deployment`).
   `TO_EMAIL` = `bora@flowick.com` (sahibi bu adresi okuduğunu doğruladı;
   `developer@flowick.com`'a 7 test teslim edilmişti ama kimse görmüyordu).
2. `functions/api/contact.ts` sertleştirildi (commit `6a5a67e`):
   ortam değişkeni doğrulaması + eksik olanın adıyla log, Resend/ağ hatalarının
   durum kodu + gövdeyle loglanması, HTML kaçışı, satır sonu → `<br>`,
   e-posta biçim doğrulaması (400, eskiden 500'e düşüyordu), `TO_EMAIL` için
   virgülle çoklu alıcı.
3. `wrangler.toml` proje adı gerçek Pages projesiyle eşitlendi
   (`flowick-website` → `flowick-website-page-deployment`).
4. 13 test eklendi (`functions/api/contact.test.ts`), toplam 23 yeşil.

**Canlı doğrulama:** push sonrası deployment `6a5a67e`, gerçek gönderim 200,
mail `bora@flowick.com`'a `delivered`.

**Kalan riskler:** ~~bot koruması yok, rate limit yok~~ (ikinci turda kapatıldı),
KVKK açık rıza kutusu kontrol edilmedi. Resend API anahtarı bir sohbet oturumunda
açığa çıktı, sahibi aynı anahtarı kullanmayı seçti — rotasyon hâlâ önerilir.

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

0. **Turnstile + rate limit** — `/api/contact` şu an korumasız; bot bulursa gelen
   kutusu ve Resend kotası yanar. `turnstile-spin` skill'i uçtan uca kuruyor.
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
- **Pages ortam değişkeni değiştirmek tek başına yetmez** — mevcut deployment eski
  ortamla çalışmaya devam eder, yeni deployment şart (push ya da "Retry deployment").
- **Gerçek Pages projesi `flowick-website-page-deployment`**, repo adı `flowick-website`.
  `--project-name` vermeden deploy edersen yanlış/yeni projeye gider. `wrangler.toml`
  artık doğru adı taşıyor, bozma.
- **Canlı formu mail göndermeden yoklamak:** bozuk biçimli e-posta gönder
  (`{"ad":"x","eposta":"gecersiz"}`); yeni sürüm 400 "Geçerli bir e-posta adresi girin."
  döndürür, Resend'e hiç gitmez. Deployment'ın geçtiğini anlamanın ucuz yolu.
- Prerender çıktısı **`foo.html`** biçiminde yazılır, `foo/index.html` DEĞİL. Cloudflare Pages
  ikincisini `/foo/` altında servis edip `/foo`yu 308'ler; kanonik URL'lerimiz eğik çizgisiz
  olduğu için bu yönlendirme zinciri istenmiyor.
