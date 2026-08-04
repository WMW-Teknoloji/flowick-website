/**
 * Yerel `<select>` yerine erişilebilir açılır liste.
 *
 * Sebep: yerel select'in açılan listesini tarayıcı çiziyor, yüksekliği CSS ile
 * sınırlanamıyor. 21 ürünle liste ekranın dibine kadar uzuyordu. Bu bileşende
 * liste sıradan bir öğe, yüksekliği CSS'ten sınırlanır ve kaydırılır.
 *
 * Değer gizli girdide durur, alan adı değişmez — form gövdesi eskisi gibi `urun` gönderir.
 */

const ETKIN_SINIFI = 'secim-secenek--etkin';

let sayac = 0;

function kur(kok: HTMLElement): void {
  const dugme = kok.querySelector<HTMLButtonElement>('.secim-dugme');
  const liste = kok.querySelector<HTMLElement>('.secim-liste');
  const gizli = kok.querySelector<HTMLInputElement>('input[type="hidden"]');
  const degerEl = kok.querySelector<HTMLElement>('[data-secim-deger]');
  const secenekler = Array.from(kok.querySelectorAll<HTMLElement>('.secim-secenek'));

  if (!dugme || !liste || !gizli || !degerEl || secenekler.length === 0) return;

  const onEk = `secim-${(sayac += 1)}`;
  liste.id ||= `${onEk}-liste`;
  dugme.setAttribute('aria-controls', liste.id);
  secenekler.forEach((secenek, i) => {
    secenek.id ||= `${onEk}-secenek-${i}`;
  });

  let acik = false;
  let etkinIndeks = -1;

  function seciliIndeks(): number {
    return secenekler.findIndex((s) => s.getAttribute('aria-selected') === 'true');
  }

  function etkinIsaretle(indeks: number): void {
    etkinIndeks = indeks;
    secenekler.forEach((secenek, i) => secenek.classList.toggle(ETKIN_SINIFI, i === indeks));

    if (indeks < 0) {
      dugme!.removeAttribute('aria-activedescendant');
      return;
    }
    dugme!.setAttribute('aria-activedescendant', secenekler[indeks].id);
    // jsdom scrollIntoView'i uygulamıyor; tarayıcıda uzun listede görünür tutar.
    secenekler[indeks].scrollIntoView?.({ block: 'nearest' });
  }

  function ac(): void {
    if (acik) return;
    acik = true;
    liste!.hidden = false;
    dugme!.setAttribute('aria-expanded', 'true');
    kok.classList.add('secim--acik');
    etkinIsaretle(seciliIndeks());
  }

  function kapat(): void {
    if (!acik) return;
    acik = false;
    liste!.hidden = true;
    dugme!.setAttribute('aria-expanded', 'false');
    kok.classList.remove('secim--acik');
    etkinIsaretle(-1);
  }

  function sec(indeks: number): void {
    const secilen = secenekler[indeks];
    if (!secilen) return;

    const deger = secilen.dataset.deger ?? secilen.textContent?.trim() ?? '';
    secenekler.forEach((secenek, i) =>
      secenek.setAttribute('aria-selected', String(i === indeks)),
    );
    gizli!.value = deger;
    degerEl!.textContent = deger;
    kok.classList.add('secim--dolu');
    kapat();
    dugme!.focus();
  }

  dugme.addEventListener('click', () => {
    if (acik) kapat();
    else ac();
  });

  secenekler.forEach((secenek, i) => {
    secenek.addEventListener('click', () => sec(i));
  });

  kok.addEventListener('keydown', (olay) => {
    const { key } = olay as KeyboardEvent;

    if (key === 'Escape') {
      if (!acik) return;
      olay.preventDefault();
      kapat();
      dugme.focus();
      return;
    }

    if (key === 'Enter' || key === ' ') {
      if (!acik) {
        olay.preventDefault();
        ac();
        return;
      }
      olay.preventDefault();
      if (etkinIndeks >= 0) sec(etkinIndeks);
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      olay.preventDefault();
      if (!acik) {
        ac();
        return;
      }
      const son = secenekler.length - 1;
      if (key === 'Home') etkinIsaretle(0);
      else if (key === 'End') etkinIsaretle(son);
      else if (key === 'ArrowDown') etkinIsaretle(etkinIndeks >= son ? 0 : etkinIndeks + 1);
      else etkinIsaretle(etkinIndeks <= 0 ? son : etkinIndeks - 1);
    }
  });

  document.addEventListener('click', (olay) => {
    if (!acik) return;
    if (kok.contains(olay.target as Node)) return;
    kapat();
  });
}

export function initOzelSecimler(): void {
  document.querySelectorAll<HTMLElement>('[data-secim]').forEach(kur);
}
