// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from './contact';

const TAM_ORTAM = {
  RESEND_API_KEY: 'test-anahtar',
  TO_EMAIL: 'bora@flowick.com',
  FROM_EMAIL: 'noreply@flowick.com',
};

const GECERLI_GOVDE = {
  ad: 'Berke',
  soyad: 'Sarı',
  telefon: '05551112233',
  eposta: 'berke@example.com',
  urun: 'Flowick BPM',
  konu: 'Demo talebi',
  mesaj: 'Merhaba',
};

function istek(govde: unknown, gecersizJson = false) {
  return {
    json: async () => {
      if (gecersizJson) throw new SyntaxError('bozuk json');
      return govde;
    },
  };
}

// Fonksiyon yalnizca ctx.request ve ctx.env kullaniyor; testte o ikisi yeterli.
function cagir(govde: unknown, ortam: Record<string, string> = TAM_ORTAM, gecersizJson = false) {
  const ctx = { request: istek(govde, gecersizJson), env: ortam };
  return (onRequestPost as unknown as (c: unknown) => Promise<Response>)(ctx);
}

function resendYaniti(durum = 200, govde = '{"id":"abc"}') {
  return new Response(govde, { status: durum });
}

let fetchSahte: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSahte = vi.fn(async () => resendYaniti());
  vi.stubGlobal('fetch', fetchSahte);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('onRequestPost — ortam değişkeni doğrulaması', () => {
  it('eksik değişkende Resend çağrılmadan 500 döner ve hangisinin eksik olduğunu loglar', async () => {
    const res = await cagir(GECERLI_GOVDE, { RESEND_API_KEY: 'x' });

    expect(res.status).toBe(500);
    expect(fetchSahte).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('eksik ortam değişkeni: TO_EMAIL, FROM_EMAIL'),
    );
  });

  it('boş string de eksik sayılır', async () => {
    const res = await cagir(GECERLI_GOVDE, { ...TAM_ORTAM, TO_EMAIL: '' });

    expect(res.status).toBe(500);
    expect(fetchSahte).not.toHaveBeenCalled();
  });
});

describe('onRequestPost — girdi doğrulaması', () => {
  it('bozuk JSON için 400 döner', async () => {
    const res = await cagir(null, TAM_ORTAM, true);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Geçersiz istek.' });
  });

  it('ad veya e-posta yoksa 400 döner', async () => {
    const res = await cagir({ ad: 'Berke' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Ad ve e-posta zorunludur.' });
    expect(fetchSahte).not.toHaveBeenCalled();
  });

  it('biçimi bozuk e-posta için 400 döner', async () => {
    const res = await cagir({ ...GECERLI_GOVDE, eposta: 'berke-at-example' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Geçerli bir e-posta adresi girin.' });
    expect(fetchSahte).not.toHaveBeenCalled();
  });
});

describe('onRequestPost — başarılı gönderim', () => {
  it('200 döner ve Resend gövdesini doğru kurar', async () => {
    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });

    const [url, secenekler] = fetchSahte.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const gonderilen = JSON.parse(secenekler.body as string);
    expect(gonderilen.from).toBe('noreply@flowick.com');
    expect(gonderilen.to).toEqual(['bora@flowick.com']);
    expect(gonderilen.reply_to).toBe('berke@example.com');
    expect(gonderilen.subject).toBe('Flowick İletişim: Demo talebi');
    expect(gonderilen.html).toContain('Berke Sarı');
    expect(gonderilen.html).toContain('05551112233');
  });

  it('TO_EMAIL virgülle ayrılmışsa çoklu alıcıya gönderir', async () => {
    await cagir(GECERLI_GOVDE, {
      ...TAM_ORTAM,
      TO_EMAIL: 'bora@flowick.com, info@flowick.com ',
    });

    const gonderilen = JSON.parse((fetchSahte.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(gonderilen.to).toEqual(['bora@flowick.com', 'info@flowick.com']);
  });

  it('konu boşsa ad soyadı konu olarak kullanır', async () => {
    await cagir({ ...GECERLI_GOVDE, konu: undefined });

    const gonderilen = JSON.parse((fetchSahte.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(gonderilen.subject).toBe('Flowick İletişim: Berke Sarı');
  });
});

describe('onRequestPost — HTML kaçışı', () => {
  it('mesajdaki HTML etiketlerini kaçırır', async () => {
    await cagir({ ...GECERLI_GOVDE, mesaj: '<script>alert(1)</script>' });

    const gonderilen = JSON.parse((fetchSahte.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(gonderilen.html).not.toContain('<script>');
    expect(gonderilen.html).toContain('&lt;script&gt;');
  });

  it('e-posta adresindeki tırnağı kaçırır, mailto bağlantısı bozulmaz', async () => {
    await cagir({ ...GECERLI_GOVDE, ad: 'A"><b>x' });

    const gonderilen = JSON.parse((fetchSahte.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(gonderilen.html).not.toContain('<b>x');
    expect(gonderilen.html).toContain('&quot;&gt;&lt;b&gt;x');
  });

  it('mesajdaki satır sonlarını <br> yapar', async () => {
    await cagir({ ...GECERLI_GOVDE, mesaj: 'birinci\nikinci' });

    const gonderilen = JSON.parse((fetchSahte.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(gonderilen.html).toContain('birinci<br>ikinci');
  });
});

describe('onRequestPost — Resend hataları', () => {
  it('Resend hata döndürürse 500 döner ve durum kodunu loglar', async () => {
    fetchSahte.mockResolvedValueOnce(resendYaniti(401, '{"message":"API key is invalid"}'));

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Resend 401 döndü'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('API key is invalid'));
  });

  it('ağ hatasında 500 döner ve loglar', async () => {
    fetchSahte.mockRejectedValueOnce(new Error('bağlantı koptu'));

    const res = await cagir(GECERLI_GOVDE);

    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Resend'e ulaşılamadı"));
  });
});
