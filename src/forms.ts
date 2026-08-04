export const TURNSTILE_SITEKEY = '0x4AAAAAAEGHIvMD2W44X0ZR';
const TURNSTILE_ACTION = 'turnstile-spin-v1';

// api.js `render=explicit` ile yükleniyor; hazır olması main.ts'ten bağımsız,
// bu yüzden kısa aralıklarla yoklayıp bir kez çiziyoruz.
const YOKLAMA_ARALIGI_MS = 100;
const YOKLAMA_SURESI_MS = 15_000;

interface TurnstileApi {
  render(kap: HTMLElement, secenekler: { sitekey: string; action?: string }): string;
  reset(widgetKimligi?: string): void;
  remove(widgetKimligi: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let widgetKimligi: string | undefined;

function widgetiCiz(kap: HTMLElement): void {
  const api = window.turnstile;
  if (!api) return;

  if (widgetKimligi !== undefined) {
    // SPA gezinmesinde eski kap DOM'dan düştü; Turnstile'ın kaydını da temizle.
    try {
      api.remove(widgetKimligi);
    } catch {
      // Eski kimlik zaten geçersizse önemsiz.
    }
    widgetKimligi = undefined;
  }

  widgetKimligi = api.render(kap, { sitekey: TURNSTILE_SITEKEY, action: TURNSTILE_ACTION });
}

function turnstileKur(form: HTMLFormElement): void {
  const kap = form.querySelector<HTMLElement>('.cf-turnstile');
  if (!kap) return;

  if (window.turnstile) {
    widgetiCiz(kap);
    return;
  }

  const yoklama = setInterval(() => {
    if (!window.turnstile) return;
    clearInterval(yoklama);
    widgetiCiz(kap);
  }, YOKLAMA_ARALIGI_MS);

  setTimeout(() => clearInterval(yoklama), YOKLAMA_SURESI_MS);
}

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('.contact-form');
  if (!form) return;

  turnstileKur(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector<HTMLElement>('.form-status');
    const btn = form.querySelector<HTMLButtonElement>('.contact-submit');
    if (!status || !btn) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const jeton = data['cf-turnstile-response'];

    if (typeof jeton !== 'string' || jeton === '') {
      status.textContent = 'Lütfen güvenlik doğrulamasını tamamlayın.';
      status.style.color = '#e74c3c';
      return;
    }

    btn.disabled = true;
    status.textContent = 'Gönderiliyor...';
    status.style.color = '';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (res.ok && json.success) {
        status.textContent = 'Mesajınız alındı, en kısa sürede size dönüş yapacağız.';
        status.style.color = '#2ecc71';
        form.reset();
      } else {
        status.textContent = json.error ?? 'Bir hata oluştu, lütfen tekrar deneyin.';
        status.style.color = '#e74c3c';
      }
    } catch {
      status.textContent = 'Bağlantı hatası, lütfen tekrar deneyin.';
      status.style.color = '#e74c3c';
    } finally {
      btn.disabled = false;
      // Jeton tek kullanımlık: her denemeden sonra tazelenmeli.
      window.turnstile?.reset(widgetKimligi);
    }
  });
}
