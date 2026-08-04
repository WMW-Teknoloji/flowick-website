import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initContactForm, TURNSTILE_SITEKEY } from './forms';

const FORM_HTML = `
  <form class="contact-form">
    <input type="text" name="ad" value="Berke">
    <input type="email" name="eposta" value="berke@example.com">
    <div class="cf-turnstile" data-sitekey="${'0x4AAAAAAEGHIvMD2W44X0ZR'}" data-action="turnstile-spin-v1"></div>
    <button type="submit" class="contact-submit">Gönder</button>
    <div class="form-status"></div>
  </form>
`;

function sahteTurnstile(jeton = 'jeton-1') {
  return {
    render: vi.fn((kap: HTMLElement, _secenekler: { sitekey: string; action?: string; theme?: string }) => {
      const gizli = document.createElement('input');
      gizli.type = 'hidden';
      gizli.name = 'cf-turnstile-response';
      gizli.value = jeton;
      kap.appendChild(gizli);
      return 'widget-1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
}

function formuGonder(): void {
  const form = document.querySelector<HTMLFormElement>('.contact-form')!;
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

function durumMetni(): string {
  return document.querySelector<HTMLElement>('.form-status')!.textContent ?? '';
}

let fetchSahte: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = FORM_HTML;
  fetchSahte = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSahte);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).turnstile;
  vi.restoreAllMocks();
});

describe('initContactForm — Turnstile widget çizimi', () => {
  it('Turnstile API hazırsa widget hemen çizilir', () => {
    const api = sahteTurnstile();
    (window as unknown as Record<string, unknown>).turnstile = api;

    initContactForm();

    expect(api.render).toHaveBeenCalledTimes(1);
    const [kap, secenekler] = api.render.mock.calls[0];
    expect(kap.className).toBe('cf-turnstile');
    expect(secenekler.sitekey).toBe(TURNSTILE_SITEKEY);
    expect(secenekler.action).toBe('turnstile-spin-v1');
    expect(secenekler.theme).toBe('light');
  });

  it('API sonradan yüklenirse widget yine çizilir', () => {
    vi.useFakeTimers();

    initContactForm();

    const api = sahteTurnstile();
    (window as unknown as Record<string, unknown>).turnstile = api;
    vi.advanceTimersByTime(300);

    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it('API hiç yüklenmezse yoklama sonsuza kadar sürmez', () => {
    vi.useFakeTimers();
    const temizle = vi.spyOn(globalThis, 'clearInterval');

    initContactForm();
    vi.advanceTimersByTime(20_000);

    expect(temizle).toHaveBeenCalled();
  });
});

describe('initContactForm — gönderim kapısı', () => {
  it('jeton boşsa istek atılmaz ve kullanıcı uyarılır', async () => {
    (window as unknown as Record<string, unknown>).turnstile = sahteTurnstile('');

    initContactForm();
    formuGonder();
    await vi.waitFor(() => expect(durumMetni()).not.toBe(''));

    expect(fetchSahte).not.toHaveBeenCalled();
    expect(durumMetni()).toContain('doğrulama');
  });

  it('jeton varsa istek gövdesinde cf-turnstile-response gider', async () => {
    (window as unknown as Record<string, unknown>).turnstile = sahteTurnstile('jeton-42');

    initContactForm();
    formuGonder();
    await vi.waitFor(() => expect(fetchSahte).toHaveBeenCalled());

    const [url, secenekler] = fetchSahte.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/contact');
    const gonderilen = JSON.parse(secenekler.body as string);
    expect(gonderilen['cf-turnstile-response']).toBe('jeton-42');
    expect(gonderilen.ad).toBe('Berke');
  });
});

describe('initContactForm — jeton tazeleme', () => {
  it('başarılı gönderimden sonra widget sıfırlanır', async () => {
    const api = sahteTurnstile();
    (window as unknown as Record<string, unknown>).turnstile = api;

    initContactForm();
    formuGonder();
    await vi.waitFor(() => expect(api.reset).toHaveBeenCalled());

    expect(api.reset).toHaveBeenCalledWith('widget-1');
  });

  it('sunucu hata döndürdüğünde de widget sıfırlanır', async () => {
    fetchSahte.mockResolvedValueOnce(
      new Response('{"error":"Çok fazla istek gönderdiniz."}', { status: 429 }),
    );
    const api = sahteTurnstile();
    (window as unknown as Record<string, unknown>).turnstile = api;

    initContactForm();
    formuGonder();
    await vi.waitFor(() => expect(api.reset).toHaveBeenCalled());

    expect(durumMetni()).toContain('Çok fazla istek');
  });

  it('ağ hatasında da widget sıfırlanır', async () => {
    fetchSahte.mockRejectedValueOnce(new Error('bağlantı koptu'));
    const api = sahteTurnstile();
    (window as unknown as Record<string, unknown>).turnstile = api;

    initContactForm();
    formuGonder();
    await vi.waitFor(() => expect(api.reset).toHaveBeenCalled());
  });
});
