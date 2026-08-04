interface Env {
  RESEND_API_KEY: string;
  TO_EMAIL: string;
  FROM_EMAIL: string;
  TURNSTILE_SECRET_KEY: string;
  // Pages'te bağlı olmayabilir; yoksa hız sınırı uygulanmaz, form çalışmaya devam eder.
  RATE_LIMIT?: KVNamespace;
}

interface ContactBody {
  ad?: string;
  soyad?: string;
  telefon?: string;
  eposta?: string;
  urun?: string;
  konu?: string;
  mesaj?: string;
  'cf-turnstile-response'?: string;
}

interface SiteverifyYaniti {
  success?: boolean;
  'error-codes'?: string[];
}

const ZORUNLU_DEGISKENLER = [
  'RESEND_API_KEY',
  'TO_EMAIL',
  'FROM_EMAIL',
  'TURNSTILE_SECRET_KEY',
] as const;

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// IP başına pencere içinde izin verilen istek sayısı. Turnstile'ı geçen istekler sayılır.
const HIZ_SINIRI = 5;
const HIZ_PENCERESI_SANIYE = 900;

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENEL_HATA = 'Mail gönderilemedi, lütfen tekrar deneyin.';
const DOGRULAMA_EKSIK = 'Doğrulama tamamlanmadı, lütfen kutucuğu işaretleyin.';
const DOGRULAMA_BASARISIZ = 'Doğrulama başarısız, sayfayı yenileyip tekrar deneyin.';
const COK_ISTEK = 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.';

function kacisliHtml(deger: string): string {
  return deger
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hucre(deger: string | undefined): string {
  if (!deger) return '-';
  return kacisliHtml(deger).replace(/\r?\n/g, '<br>');
}

/**
 * Jetonu Cloudflare'e doğrulatır. Ağ/HTTP hatasında `null` döner (arayan 500 verir),
 * böylece geçici bir kesinti "doğrulama başarısız" gibi görünmez.
 */
async function turnstileDogrula(
  gizliAnahtar: string,
  jeton: string,
  ip: string | null,
): Promise<SiteverifyYaniti | null> {
  const govde: Record<string, string> = { secret: gizliAnahtar, response: jeton };
  if (ip) govde.remoteip = ip;

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
  } catch (hata) {
    console.error(`[contact] siteverify'a ulaşılamadı: ${String(hata)}`);
    return null;
  }

  if (!res.ok) {
    console.error(`[contact] siteverify ${res.status} döndü`);
    return null;
  }

  try {
    return await res.json<SiteverifyYaniti>();
  } catch (hata) {
    console.error(`[contact] siteverify yanıtı çözümlenemedi: ${String(hata)}`);
    return null;
  }
}

/**
 * Sabit pencereli sayaç. KV atomik değil; eşzamanlı isteklerde sınır birkaç istek
 * kayabilir. İletişim formu için kabul edilebilir. KV yoksa ya da okunamazsa
 * açık kalır (fail-open) — koruma kaybolur ama form çalışmaya devam eder.
 */
async function hizSiniriAsildi(kv: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!kv) {
    console.warn('[contact] RATE_LIMIT bağlantısı yok, hız sınırı uygulanmıyor');
    return false;
  }

  const anahtar = `hiz:contact:${ip}`;
  try {
    const mevcut = await kv.get(anahtar);
    const sayilan = Number(mevcut);
    const sayi = Number.isFinite(sayilan) ? sayilan : 0;

    if (sayi >= HIZ_SINIRI) return true;

    await kv.put(anahtar, String(sayi + 1), { expirationTtl: HIZ_PENCERESI_SANIYE });
    return false;
  } catch (hata) {
    console.error(`[contact] hız sınırı sayacı okunamadı: ${String(hata)}`);
    return false;
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const eksik = ZORUNLU_DEGISKENLER.filter((ad) => !ctx.env[ad]);
  if (eksik.length > 0) {
    console.error(`[contact] eksik ortam değişkeni: ${eksik.join(', ')}`);
    return Response.json({ error: GENEL_HATA }, { status: 500 });
  }

  let body: ContactBody;
  try {
    body = await ctx.request.json<ContactBody>();
  } catch {
    return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const ip = ctx.request.headers.get('CF-Connecting-IP');

  const jeton = body['cf-turnstile-response'];
  if (!jeton) {
    return Response.json({ error: DOGRULAMA_EKSIK }, { status: 400 });
  }

  const dogrulama = await turnstileDogrula(ctx.env.TURNSTILE_SECRET_KEY, jeton, ip);
  if (!dogrulama) {
    return Response.json({ error: GENEL_HATA }, { status: 500 });
  }
  if (!dogrulama.success) {
    const kodlar = dogrulama['error-codes']?.join(', ') ?? 'kod yok';
    console.warn(`[contact] Turnstile doğrulaması reddedildi: ${kodlar}`);
    return Response.json({ error: DOGRULAMA_BASARISIZ }, { status: 403 });
  }

  if (await hizSiniriAsildi(ctx.env.RATE_LIMIT, ip ?? 'bilinmeyen')) {
    console.warn(`[contact] hız sınırı aşıldı: ${ip ?? 'bilinmeyen'}`);
    return Response.json({ error: COK_ISTEK }, { status: 429 });
  }

  const { ad, soyad, telefon, eposta, urun, konu, mesaj } = body;

  if (!ad || !eposta) {
    return Response.json({ error: 'Ad ve e-posta zorunludur.' }, { status: 400 });
  }

  if (!EPOSTA_DESENI.test(eposta)) {
    return Response.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
  }

  const emailHtml = `
    <h2>Flowick.com İletişim Formu</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Ad Soyad</td><td style="padding:8px;">${hucre(`${ad} ${soyad ?? ''}`.trim())}</td></tr>
      <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold;">E-Posta</td><td style="padding:8px;"><a href="mailto:${kacisliHtml(eposta)}">${kacisliHtml(eposta)}</a></td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Telefon</td><td style="padding:8px;">${hucre(telefon)}</td></tr>
      <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold;">İlgilenilen Ürün</td><td style="padding:8px;">${hucre(urun)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Konu</td><td style="padding:8px;">${hucre(konu)}</td></tr>
      <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold;">Mesaj</td><td style="padding:8px;">${hucre(mesaj)}</td></tr>
    </table>
  `;

  const alicilar = ctx.env.TO_EMAIL.split(',')
    .map((adres) => adres.trim())
    .filter(Boolean);

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ctx.env.FROM_EMAIL,
        to: alicilar,
        reply_to: eposta,
        subject: `Flowick İletişim: ${konu ?? `${ad} ${soyad ?? ''}`.trim()}`,
        html: emailHtml,
      }),
    });
  } catch (hata) {
    console.error(`[contact] Resend'e ulaşılamadı: ${String(hata)}`);
    return Response.json({ error: GENEL_HATA }, { status: 500 });
  }

  if (!res.ok) {
    const detay = await res.text().catch(() => '');
    console.error(`[contact] Resend ${res.status} döndü: ${detay.slice(0, 500)}`);
    return Response.json({ error: GENEL_HATA }, { status: 500 });
  }

  console.log(`[contact] mail gönderildi, alıcı sayısı: ${alicilar.length}`);
  return Response.json({ success: true });
};
