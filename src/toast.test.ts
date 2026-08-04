import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bildirimGoster, TOAST_SURESI_MS, TOAST_CIKIS_MS } from './toast';

function toast(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.toast');
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bildirimGoster', () => {
  it('mesajı sayfaya ekler', () => {
    bildirimGoster('Mesajınız alındı');

    expect(toast()).not.toBeNull();
    expect(toast()!.textContent).toContain('Mesajınız alındı');
  });

  it('ekran okuyucuya duyurulur ama odağı çalmaz', () => {
    bildirimGoster('Mesajınız alındı');

    expect(toast()!.getAttribute('role')).toBe('status');
    expect(toast()!.getAttribute('aria-live')).toBe('polite');
  });

  it('süre dolunca kendiliğinden kaybolur', () => {
    bildirimGoster('Mesajınız alındı');

    vi.advanceTimersByTime(TOAST_SURESI_MS + TOAST_CIKIS_MS);

    expect(toast()).toBeNull();
  });

  it('süre dolmadan durur', () => {
    bildirimGoster('Mesajınız alındı');

    vi.advanceTimersByTime(TOAST_SURESI_MS - 100);

    expect(toast()).not.toBeNull();
  });

  it('kapat düğmesi anında kapatır', () => {
    bildirimGoster('Mesajınız alındı');

    document.querySelector<HTMLButtonElement>('.toast-kapat')!.click();
    vi.advanceTimersByTime(TOAST_CIKIS_MS);

    expect(toast()).toBeNull();
  });

  it('ikinci bildirim birincinin yerine geçer, ikisi üst üste birikmez', () => {
    bildirimGoster('birinci');
    bildirimGoster('ikinci');

    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    expect(toast()!.textContent).toContain('ikinci');
  });

  it('eski bildirimin zamanlayıcısı yenisini erken kapatmaz', () => {
    bildirimGoster('birinci');
    vi.advanceTimersByTime(TOAST_SURESI_MS - 50);
    bildirimGoster('ikinci');
    vi.advanceTimersByTime(100);

    expect(toast()!.textContent).toContain('ikinci');
  });

  it('metni kaçırır, HTML olarak yorumlamaz', () => {
    bildirimGoster('<img src=x onerror=alert(1)>');

    expect(toast()!.querySelector('img')).toBeNull();
    expect(toast()!.textContent).toContain('<img src=x');
  });

  it('hata türü ayrı sınıf alır', () => {
    bildirimGoster('Bir şeyler ters gitti', 'hata');

    expect(toast()!.classList.contains('toast--hata')).toBe(true);
  });

  it('varsayılan tür başarıdır', () => {
    bildirimGoster('Tamam');

    expect(toast()!.classList.contains('toast--basari')).toBe(true);
  });
});
