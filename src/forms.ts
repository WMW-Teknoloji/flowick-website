import { bildirimGoster } from './toast';

export const TURNSTILE_SITEKEY = '0x4AAAAAAEGHIvMD2W44X0ZR';
const TURNSTILE_ACTION = 'turnstile-spin-v1';
// Form turuncu zeminde; Turnstile'ın varsayılan koyu teması tokuşuyordu.
const TURNSTILE_TEMA = 'light';

// api.js `render=explicit` ile yükleniyor; hazır olması main.ts'ten bağımsız,
// bu yüzden kısa aralıklarla yoklayıp bir kez çiziyoruz.
const YOKLAMA_ARALIGI_MS = 100;
const YOKLAMA_SURESI_MS = 15_000;

interface TurnstileApi {
  render(
    kap: HTMLElement,
    secenekler: { sitekey: string; action?: string; theme?: string },
  ): string;
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

  widgetKimligi = api.render(kap, {
    sitekey: TURNSTILE_SITEKEY,
    action: TURNSTILE_ACTION,
    theme: TURNSTILE_TEMA,
  });
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

// Türkiye numaraları: 0 ile 11 hane (05551112233) ya da 0'sız 10 hane (5551112233).
const TELEFON_EN_AZ_HANE = 10;
const TELEFON_EN_COK_HANE = 11;

/**
 * Rakamları (5XX) XXX XX XX kalıbına diziyor. Baştaki 0 (trunk kodu) varsa
 * grupların dışında ayrı tutulur — hem 10 hem 11 haneli girişi kapsar.
 * Basit maske: her tuş vuruşunda değeri baştan yeniden kurar, imleç sona gider.
 */
function telefonBicimlendir(rakamlar: string): string {
  let onEk = '';
  let kalan = rakamlar;
  if (kalan.startsWith('0')) {
    onEk = '0 ';
    kalan = kalan.slice(1);
  }

  const gruplar: string[] = [];
  if (kalan.length > 0) gruplar.push(kalan.slice(0, 3));
  if (kalan.length > 3) gruplar.push(kalan.slice(3, 6));
  if (kalan.length > 6) gruplar.push(kalan.slice(6, 8));
  if (kalan.length > 8) gruplar.push(kalan.slice(8, 10));

  if (gruplar.length === 0) return onEk.trim();

  let sonuc = `(${gruplar[0]}${kalan.length >= 3 ? ')' : ''}`;
  for (let i = 1; i < gruplar.length; i += 1) sonuc += ` ${gruplar[i]}`;

  return onEk + sonuc;
}

function telefonAlaniniKur(form: HTMLFormElement): void {
  const alan = form.querySelector<HTMLInputElement>('input[name="telefon"]');
  if (!alan) return;

  alan.addEventListener('input', () => {
    const rakamlar = alan.value.replace(/\D/g, '').slice(0, TELEFON_EN_COK_HANE);
    const bicimli = telefonBicimlendir(rakamlar);
    if (alan.value !== bicimli) alan.value = bicimli;
  });
}

/** Hata rengi satır içi stil yerine sınıfla verilir; turuncu zeminde okunur biçim CSS'te. */
function durumYaz(kutu: HTMLElement, mesaj: string, hata = false): void {
  kutu.textContent = mesaj;
  kutu.classList.toggle('form-status--hata', hata && mesaj !== '');
}

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('.contact-form');
  if (!form) return;

  turnstileKur(form);
  telefonAlaniniKur(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector<HTMLElement>('.form-status');
    const btn = form.querySelector<HTMLButtonElement>('.contact-submit');
    if (!status || !btn) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const jeton = data['cf-turnstile-response'];

    const telefon = typeof data.telefon === 'string' ? data.telefon : '';
    const telefonHaneSayisi = telefon.replace(/\D/g, '').length;
    if (telefon !== '' && (telefonHaneSayisi < TELEFON_EN_AZ_HANE || telefonHaneSayisi > TELEFON_EN_COK_HANE)) {
      durumYaz(status, 'Telefon numarası 10 veya 11 haneli olmalı.', true);
      return;
    }

    if (typeof jeton !== 'string' || jeton === '') {
      durumYaz(status, 'Lütfen güvenlik doğrulamasını tamamlayın.', true);
      return;
    }

    btn.disabled = true;
    durumYaz(status, 'Gönderiliyor...');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (res.ok && json.success) {
        // Başarı geçici bilgi: sayfa üstünde bildirime çıkar, formun altını temiz bırak.
        durumYaz(status, '');
        bildirimGoster('Mesajınız alındı, en kısa sürede size dönüş yapacağız.');
        form.reset();
      } else {
        durumYaz(status, json.error ?? 'Bir hata oluştu, lütfen tekrar deneyin.', true);
      }
    } catch {
      durumYaz(status, 'Bağlantı hatası, lütfen tekrar deneyin.', true);
    } finally {
      btn.disabled = false;
      // Jeton tek kullanımlık: her denemeden sonra tazelenmeli.
      window.turnstile?.reset(widgetKimligi);
    }
  });
}
