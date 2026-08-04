export const TOAST_SURESI_MS = 5000;
export const TOAST_CIKIS_MS = 250;

export type ToastTuru = 'basari' | 'hata';

const IKONLAR: Record<ToastTuru, string> = {
  basari:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  hata: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
};

const KAPAT_IKONU =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

let acikToast: HTMLElement | undefined;
let kapatmaZamanlayicisi: number | undefined;
let kaldirmaZamanlayicisi: number | undefined;

function alanGetir(): HTMLElement {
  let alan = document.querySelector<HTMLElement>('.toast-alani');
  if (alan) return alan;

  alan = document.createElement('div');
  alan.className = 'toast-alani';
  document.body.appendChild(alan);
  return alan;
}

function zamanlayicilariDurdur(): void {
  if (kapatmaZamanlayicisi !== undefined) clearTimeout(kapatmaZamanlayicisi);
  if (kaldirmaZamanlayicisi !== undefined) clearTimeout(kaldirmaZamanlayicisi);
  kapatmaZamanlayicisi = undefined;
  kaldirmaZamanlayicisi = undefined;
}

function hemenKaldir(): void {
  acikToast?.remove();
  acikToast = undefined;
}

function kapat(): void {
  if (!acikToast) return;

  const kapanan = acikToast;
  kapanan.classList.add('toast--kapaniyor');
  kaldirmaZamanlayicisi = window.setTimeout(() => {
    kapanan.remove();
    if (acikToast === kapanan) acikToast = undefined;
  }, TOAST_CIKIS_MS);
}

/**
 * Sayfanın üstünde geçici bildirim gösterir. Aynı anda tek bildirim durur;
 * yenisi gelirse eskisi beklemeden kaldırılır ve zamanlayıcısı iptal edilir.
 */
export function bildirimGoster(mesaj: string, tur: ToastTuru = 'basari'): void {
  zamanlayicilariDurdur();
  hemenKaldir();

  const toast = document.createElement('div');
  toast.className = `toast toast--${tur}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const ikon = document.createElement('span');
  ikon.className = 'toast-ikon';
  ikon.innerHTML = IKONLAR[tur];

  // Metin kullanıcı girdisi taşıyabilir; textContent ile basılır, HTML olarak yorumlanmaz.
  const metin = document.createElement('p');
  metin.className = 'toast-metin';
  metin.textContent = mesaj;

  const kapatDugmesi = document.createElement('button');
  kapatDugmesi.type = 'button';
  kapatDugmesi.className = 'toast-kapat';
  kapatDugmesi.setAttribute('aria-label', 'Bildirimi kapat');
  kapatDugmesi.innerHTML = KAPAT_IKONU;
  kapatDugmesi.addEventListener('click', () => {
    zamanlayicilariDurdur();
    kapat();
  });

  toast.append(ikon, metin, kapatDugmesi);
  alanGetir().appendChild(toast);
  acikToast = toast;

  kapatmaZamanlayicisi = window.setTimeout(kapat, TOAST_SURESI_MS);
}
