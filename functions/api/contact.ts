interface Env {
  RESEND_API_KEY: string;
  TO_EMAIL: string;
  FROM_EMAIL: string;
}

interface ContactBody {
  ad?: string;
  soyad?: string;
  telefon?: string;
  eposta?: string;
  urun?: string;
  konu?: string;
  mesaj?: string;
}

const ZORUNLU_DEGISKENLER = ['RESEND_API_KEY', 'TO_EMAIL', 'FROM_EMAIL'] as const;

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENEL_HATA = 'Mail gönderilemedi, lütfen tekrar deneyin.';

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
