import { describe, it, expect, beforeEach } from 'vitest';
import { initOzelSecimler } from './select';

const HTML = `
  <div class="secim" data-secim>
    <input type="hidden" name="urun">
    <button type="button" class="secim-dugme" aria-haspopup="listbox" aria-expanded="false">
      <span class="secim-deger" data-secim-deger>Ürün Seçiniz</span>
    </button>
    <ul class="secim-liste" role="listbox" hidden>
      <li class="secim-secenek" role="option" aria-selected="false">Organizasyon Yönetimi</li>
      <li class="secim-secenek" role="option" aria-selected="false">Stok Yönetimi</li>
      <li class="secim-secenek" role="option" aria-selected="false">PDKS</li>
    </ul>
  </div>
`;

function dugme(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('.secim-dugme')!;
}
function liste(): HTMLElement {
  return document.querySelector<HTMLElement>('.secim-liste')!;
}
function secenekler(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.secim-secenek'));
}
function gizliDeger(): string {
  return document.querySelector<HTMLInputElement>('input[name="urun"]')!.value;
}
function etiket(): string {
  return document.querySelector<HTMLElement>('[data-secim-deger]')!.textContent ?? '';
}
function acikMi(): boolean {
  return dugme().getAttribute('aria-expanded') === 'true' && !liste().hidden;
}
function tus(ad: string): void {
  dugme().dispatchEvent(new KeyboardEvent('keydown', { key: ad, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = HTML;
  initOzelSecimler();
});

describe('initOzelSecimler — açma kapama', () => {
  it('başlangıçta kapalıdır ve değer boştur', () => {
    expect(acikMi()).toBe(false);
    expect(gizliDeger()).toBe('');
    expect(etiket()).toBe('Ürün Seçiniz');
  });

  it('düğmeye tıklayınca açılır, tekrar tıklayınca kapanır', () => {
    dugme().click();
    expect(acikMi()).toBe(true);

    dugme().click();
    expect(acikMi()).toBe(false);
  });

  it('Escape kapatır ve odağı düğmeye geri verir', () => {
    dugme().click();
    tus('Escape');

    expect(acikMi()).toBe(false);
    expect(document.activeElement).toBe(dugme());
  });

  it('dışarı tıklayınca kapanır', () => {
    dugme().click();
    document.body.click();

    expect(acikMi()).toBe(false);
  });
});

describe('initOzelSecimler — seçim', () => {
  it('seçeneğe tıklamak etiketi ve gizli girdiyi günceller, listeyi kapatır', () => {
    dugme().click();
    secenekler()[1].click();

    expect(etiket()).toBe('Stok Yönetimi');
    expect(gizliDeger()).toBe('Stok Yönetimi');
    expect(acikMi()).toBe(false);
  });

  it('seçili seçenek aria-selected alır, diğerleri bırakır', () => {
    dugme().click();
    secenekler()[2].click();
    dugme().click();
    secenekler()[0].click();

    expect(secenekler()[0].getAttribute('aria-selected')).toBe('true');
    expect(secenekler()[2].getAttribute('aria-selected')).toBe('false');
  });

  it('seçim yapılınca kap seçili işaretini alır', () => {
    dugme().click();
    secenekler()[0].click();

    expect(document.querySelector('.secim')!.classList.contains('secim--dolu')).toBe(true);
  });
});

describe('initOzelSecimler — klavye', () => {
  it('kapalıyken ArrowDown listeyi açar', () => {
    tus('ArrowDown');

    expect(acikMi()).toBe(true);
  });

  it('ArrowDown etkin seçeneği ilerletir, Enter onu seçer', () => {
    dugme().click();
    tus('ArrowDown');
    tus('ArrowDown');
    tus('Enter');

    expect(gizliDeger()).toBe('Stok Yönetimi');
    expect(acikMi()).toBe(false);
  });

  it('ArrowUp son seçenekten başlar', () => {
    dugme().click();
    tus('ArrowUp');
    tus('Enter');

    expect(gizliDeger()).toBe('PDKS');
  });

  it('Home ilk, End son seçeneğe gider', () => {
    dugme().click();
    tus('End');
    tus('Enter');
    expect(gizliDeger()).toBe('PDKS');

    dugme().click();
    tus('Home');
    tus('Enter');
    expect(gizliDeger()).toBe('Organizasyon Yönetimi');
  });

  it('etkin seçenek aria-activedescendant ile bildirilir', () => {
    dugme().click();
    tus('ArrowDown');

    const etkinKimlik = dugme().getAttribute('aria-activedescendant');
    expect(etkinKimlik).toBeTruthy();
    expect(document.getElementById(etkinKimlik!)).toBe(secenekler()[0]);
  });

  it('form içindeyken Enter formu göndermez', () => {
    dugme().click();
    tus('ArrowDown');
    const olay = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    dugme().dispatchEvent(olay);

    expect(olay.defaultPrevented).toBe(true);
  });
});
