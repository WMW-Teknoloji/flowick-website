// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './contact';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_URL = 'https://api.resend.com/emails';

const TAM_ORTAM = {
  RESEND_API_KEY: 'test-anahtar',
  TO_EMAIL: 'bora@flowick.com',
  FROM_EMAIL: 'noreply@flowick.com',
  TURNSTILE_SECRET_KEY: 'test-gizli',
};

const GECERLI_GOVDE = {
  ad: 'Berke',
  soyad: 'Sarı',
  telefon: '05551112233',
  eposta: 'berke@example.com',
  urun: 'Flowick BPM',
  konu: 'Demo talebi',
  mesaj: 'Merhaba',
  'cf-turnstile-response': 'gecerli-jeton',
};

function sahteKv(baslangic: Record<string, string> = {}) {
  const depo = new Map(Object.entries(baslangic));
  return {
    depo,
    get: vi.fn(async (anahtar: string) => depo.get(anahtar) ?? null),
    put: vi.fn(async (anahtar: string, deger: string) => {
      depo.set(anahtar, deger);
    }),
  };
}

function istek(govde: unknown, gecersizJson: boolean, ip: string | null) {
  return {
    json: async () => {
      if (gecersizJson) throw new SyntaxError('bozuk json');
      return govde;
    },
    headers: new Headers(ip ? { 'CF-Connecting-IP': ip } : {}),
  };
}

interface CagirSecenekleri {
  ortam?: Record<string, unknown>;
  gecersizJson?: boolean;
  ip?: string | null;
  kv?: ReturnType<typeof sahteKv> | null;
}

// Fonksiyon yalnizca ctx.request ve ctx.env kullaniyor; testte o ikisi yeterli.
function cagir(govde: unknown, secenekler: CagirSecenekleri = {}) {
  const {
    ortam = TAM_ORTAM,
    gecersizJson = false,
    ip = '203.0.113.7',
    kv = sahteKv(),
  } = secenekler;
  const ctx = {
    request: istek(govde, gecersizJson, ip),
    env: kv ? { ...ortam, RATE_LIMIT: kv } : ortam,
  };
  return (onRequestPost as unknown as (c: unknown) => Promise<Response>)(ctx);
}

function resendYaniti(durum = 200, govde = '{"id":"abc"}') {
  return new Response(govde, { status: durum });
}

function siteverifyYaniti(basarili: boolean, hatalar: string[] = []) {
  return new Response(JSON.stringify({ success: basarili, 'error-codes': hatalar }), {
    status: 200,
  });
}

let fetchSahte: ReturnType<typeof vi.fn>;

function cagriBul(url: string) {
  return fetchSahte.mock.calls.find((cagri) => cagri[0] === url) as
    | [string, RequestInit]
    | undefined;
}

function resendCagrildi(): boolean {
  return cagriBul(RESEND_URL) !== undefined;
}

function resendGovdesi(): Record<string, unknown> {
  const cagri = cagriBul(RESEND_URL);
  if (!cagri) throw new Error('Resend çağrılmadı');
  return JSON.parse(cagri[1].body as string);
}

beforeEach(() => {
  fetchSahte = vi.fn(async (url: string) => {
    if (url === SITEVERIFY_URL) return siteverifyYaniti(true);
    return resendYaniti();
  });
  vi.stubGlobal('fetch', fetchSahte);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('onRequestPost — ortam değişkeni doğrulaması', () => {
  it('eksik değişkende Resend çağrılmadan 500 döner ve hangisinin eksik olduğunu loglar', async () => {
    const res = await cagir(GECERLI_GOVDE, { ortam: { RESEND_API_KEY: 'x' } });

    expect(res.status).toBe(500);
    expect(fetchSahte).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('eksik ortam değişkeni: TO_EMAIL, FROM_EMAIL, TURNSTILE_SECRET_KEY'),
    );
  });

  it('boş string de eksik sayılır', async () => {
    const res = await cagir(GECERLI_GOVDE, { ortam: { ...TAM_ORTAM, TO_EMAIL: '' } });

    expect(res.status).toBe(500);
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('TURNSTILE_SECRET_KEY eksikse form açık kalmaz, 500 döner', async () => {
    const { TURNSTILE_SECRET_KEY: _atilan, ...gizlisiz } = TAM_ORTAM;

    const res = await cagir(GECERLI_GOVDE, { ortam: gizlisiz });

    expect(res.status).toBe(500);
    expect(fetchSahte).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('TURNSTILE_SECRET_KEY'),
    );
  });
});

describe('onRequestPost — Turnstile doğrulaması', () => {
  it('jeton yoksa 400 döner, ne siteverify ne Resend çağrılır', async () => {
    const { 'cf-turnstile-response': _atilan, ...jetonsuz } = GECERLI_GOVDE;

    const res = await cagir(jetonsuz);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Doğrulama tamamlanmadı, lütfen kutucuğu işaretleyin.',
    });
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('siteverify başarısız dönerse 403 döner ve Resend çağrılmaz', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return siteverifyYaniti(false, ['invalid-input-response']);
      return resendYaniti();
    });

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: 'Doğrulama başarısız, sayfayı yenileyip tekrar deneyin.',
    });
    expect(resendCagrildi()).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid-input-response'),
    );
  });

  it('siteverify gövdesine gizli anahtar, jeton ve ziyaretçi IP\'si gönderilir', async () => {
    await cagir(GECERLI_GOVDE, { ip: '198.51.100.4' });

    const cagri = cagriBul(SITEVERIFY_URL);
    expect(cagri).toBeDefined();
    const gonderilen = JSON.parse(cagri![1].body as string);
    expect(gonderilen).toEqual({
      secret: 'test-gizli',
      response: 'gecerli-jeton',
      remoteip: '198.51.100.4',
    });
  });

  it('IP başlığı yoksa remoteip alanı gönderilmez', async () => {
    await cagir(GECERLI_GOVDE, { ip: null });

    const gonderilen = JSON.parse(cagriBul(SITEVERIFY_URL)![1].body as string);
    expect(gonderilen).not.toHaveProperty('remoteip');
  });

  it('siteverify ağ hatası verirse 500 döner ve Resend çağrılmaz', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) throw new Error('bağlantı koptu');
      return resendYaniti();
    });

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(resendCagrildi()).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('siteverify'),
    );
  });

  it('siteverify HTTP hatası verirse 500 döner ve Resend çağrılmaz', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return new Response('bozuk', { status: 502 });
      return resendYaniti();
    });

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(resendCagrildi()).toBe(false);
  });

  it('doğrulama alan kontrolünden önce yapılır — geçersiz jetonlu boş form Resend\'e ulaşmaz', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return siteverifyYaniti(false);
      return resendYaniti();
    });

    const res = await cagir({ 'cf-turnstile-response': 'sahte' });

    expect(res.status).toBe(403);
    expect(resendCagrildi()).toBe(false);
  });
});

describe('onRequestPost — hız sınırı', () => {
  it('sınır altındaki istek geçer ve sayacı artırır', async () => {
    const kv = sahteKv();

    const res = await cagir(GECERLI_GOVDE, { kv, ip: '203.0.113.9' });

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith(
      'hiz:contact:203.0.113.9',
      '1',
      { expirationTtl: 900 },
    );
  });

  it('aynı IP\'den 5 istekten sonrası 429 döner ve Resend çağrılmaz', async () => {
    const kv = sahteKv({ 'hiz:contact:203.0.113.9': '5' });

    const res = await cagir(GECERLI_GOVDE, { kv, ip: '203.0.113.9' });

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.',
    });
    expect(resendCagrildi()).toBe(false);
  });

  it('sınıra takılan istek sayacı daha da artırmaz', async () => {
    const kv = sahteKv({ 'hiz:contact:203.0.113.9': '5' });

    await cagir(GECERLI_GOVDE, { kv, ip: '203.0.113.9' });

    expect(kv.put).not.toHaveBeenCalled();
  });

  it('sayaç IP başına ayrı tutulur', async () => {
    const kv = sahteKv({ 'hiz:contact:203.0.113.9': '5' });

    const res = await cagir(GECERLI_GOVDE, { kv, ip: '198.51.100.1' });

    expect(res.status).toBe(200);
    expect(kv.depo.get('hiz:contact:198.51.100.1')).toBe('1');
  });

  it('mevcut sayaç üstüne birer birer eklenir', async () => {
    const kv = sahteKv({ 'hiz:contact:203.0.113.9': '2' });

    await cagir(GECERLI_GOVDE, { kv, ip: '203.0.113.9' });

    expect(kv.depo.get('hiz:contact:203.0.113.9')).toBe('3');
  });

  it('hız sınırı Turnstile doğrulamasından SONRA işler — geçersiz jeton KV\'ye dokunmaz', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return siteverifyYaniti(false);
      return resendYaniti();
    });
    const kv = sahteKv();

    await cagir(GECERLI_GOVDE, { kv });

    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('KV bağlantısı yoksa form çalışmaya devam eder ve uyarı loglanır', async () => {
    const res = await cagir(GECERLI_GOVDE, { kv: null });

    expect(res.status).toBe(200);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('RATE_LIMIT'));
  });

  it('KV okuma hatası formu düşürmez', async () => {
    const kv = sahteKv();
    kv.get.mockRejectedValueOnce(new Error('kv patladı'));

    const res = await cagir(GECERLI_GOVDE, { kv });

    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('hız sınırı'));
  });
});

describe('onRequestPost — girdi doğrulaması', () => {
  it('bozuk JSON için 400 döner', async () => {
    const res = await cagir(null, { gecersizJson: true });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Geçersiz istek.' });
  });

  it('ad veya e-posta yoksa 400 döner', async () => {
    const res = await cagir({ ad: 'Berke', 'cf-turnstile-response': 'gecerli-jeton' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Ad ve e-posta zorunludur.' });
    expect(resendCagrildi()).toBe(false);
  });

  it('telefon boş bırakılabilir', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, telefon: '' });

    expect(res.status).toBe(200);
  });

  it('eksik haneli telefon için 400 döner', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, telefon: '0555' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Telefon numarası 10 veya 11 haneli olmalı.',
    });
    expect(resendCagrildi()).toBe(false);
  });

  it('11 haneden uzun telefon için 400 döner', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, telefon: '055511122334455' });

    expect(res.status).toBe(400);
    expect(resendCagrildi()).toBe(false);
  });

  it('rakam dışı karakterler ayıklandıktan sonra değerlendirilir', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, telefon: '0(555) 111 22 33' });

    expect(res.status).toBe(200);
  });

  it('10 haneli numara kabul edilir', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, telefon: '5551112233' });

    expect(res.status).toBe(200);
  });

  it('biçimi bozuk e-posta için 400 döner', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, eposta: 'berke-at-example' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Geçerli bir e-posta adresi girin.' });
    expect(resendCagrildi()).toBe(false);
  });
});

describe('onRequestPost — başarılı gönderim', () => {
  it('200 döner ve Resend gövdesini doğru kurar', async () => {
    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });

    const gonderilen = resendGovdesi();
    expect(gonderilen.from).toBe('noreply@flowick.com');
    expect(gonderilen.to).toEqual(['bora@flowick.com']);
    expect(gonderilen.reply_to).toBe('berke@example.com');
    expect(gonderilen.subject).toBe('Flowick İletişim: Demo talebi');
    expect(gonderilen.html).toContain('Berke Sarı');
    expect(gonderilen.html).toContain('05551112233');
  });

  it('Turnstile jetonu mail gövdesine sızmaz', async () => {
    await cagir(GECERLI_GOVDE);

    expect(resendGovdesi().html).not.toContain('gecerli-jeton');
  });

  it('TO_EMAIL virgülle ayrılmışsa çoklu alıcıya gönderir', async () => {
    await cagir(GECERLI_GOVDE, {
      ortam: { ...TAM_ORTAM, TO_EMAIL: 'bora@flowick.com, info@flowick.com ' },
    });

    expect(resendGovdesi().to).toEqual(['bora@flowick.com', 'info@flowick.com']);
  });

  it('konu boşsa ad soyadı konu olarak kullanır', async () => {
    await cagir({ ...GECERLI_GOVDE, konu: undefined });

    expect(resendGovdesi().subject).toBe('Flowick İletişim: Berke Sarı');
  });
});

describe('onRequestPost — HTML kaçışı', () => {
  it('mesajdaki HTML etiketlerini kaçırır', async () => {
    await cagir({ ...GECERLI_GOVDE, mesaj: '<script>alert(1)</script>' });

    const gonderilen = resendGovdesi();
    expect(gonderilen.html).not.toContain('<script>');
    expect(gonderilen.html).toContain('&lt;script&gt;');
  });

  it('e-posta adresindeki tırnağı kaçırır, mailto bağlantısı bozulmaz', async () => {
    await cagir({ ...GECERLI_GOVDE, ad: 'A"><b>x' });

    const gonderilen = resendGovdesi();
    expect(gonderilen.html).not.toContain('<b>x');
    expect(gonderilen.html).toContain('&quot;&gt;&lt;b&gt;x');
  });

  it('mesajdaki satır sonlarını <br> yapar', async () => {
    await cagir({ ...GECERLI_GOVDE, mesaj: 'birinci\nikinci' });

    expect(resendGovdesi().html).toContain('birinci<br>ikinci');
  });
});

describe('onRequestPost — Resend hataları', () => {
  it('Resend hata döndürürse 500 döner ve durum kodunu loglar', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return siteverifyYaniti(true);
      return resendYaniti(401, '{"message":"API key is invalid"}');
    });

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Resend 401 döndü'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('API key is invalid'));
  });

  it('ağ hatasında 500 döner ve loglar', async () => {
    fetchSahte.mockImplementation(async (url: string) => {
      if (url === SITEVERIFY_URL) return siteverifyYaniti(true);
      throw new Error('bağlantı koptu');
    });

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Resend'e ulaşılamadı"));
  });
});
