import { getContainer } from '../router';

export function renderProducts(_params: Record<string, string>): void {
  const container = getContainer();
  container.innerHTML = productsHTML();
}

interface ProductCard {
  title: string;
  color: string;
  img?: string;
}

const products: ProductCard[] = [
  { title: 'İnsan Kaynakları', color: 'rgb(117,81,204)', img: '/assets/images/products/insan-kaynaklari.png' },
  { title: 'İntranet', color: 'rgb(53,90,130)', img: '/assets/images/products/intranet.png' },
  { title: 'Organizasyon Yönetimi', color: 'rgb(0,155,87)' },
  { title: 'Avans Masraf Yönetimi', color: 'rgb(17,142,147)', img: '/assets/images/products/avans-masraf.png' },
  // Görev Yönetimi ikonu Bubble CDN'de 403 veriyor (canlıda da kırıktı) — görsel bulunana dek boş
  { title: 'Görev Yönetimi', color: 'rgb(254,1,100)' },
  { title: 'Ürün Envanter Yönetimi', color: 'rgb(255,164,0)', img: '/assets/images/products/urun-envanter.png' },
  { title: 'Stok Yönetimi', color: 'rgb(40,44,59)', img: '/assets/images/products/stok-yonetimi.png' },
  { title: 'Müşteri İlişkileri Modülü', color: 'rgb(53,90,130)', img: '/assets/images/products/musteri-iliskileri.png' },
  { title: 'PDKS', color: 'rgb(0,155,87)', img: '/assets/images/products/pdks.png' },
  { title: 'Puantaj ve Hakedişler', color: 'rgb(117,81,204)', img: '/assets/images/products/puantaj.png' },
  { title: 'Proje Yönetimi', color: 'rgb(17,142,147)' },
  { title: 'Hedef Yönetimi', color: 'rgb(254,1,100)' },
  { title: 'Satın Alma Yönetimi', color: 'rgb(255,164,0)', img: '/assets/images/products/satin-alma.png' },
  { title: 'Üretim Yönetimi', color: 'rgb(40,44,59)' },
  { title: 'Kalite ve Kontrol Yönetimi', color: 'rgb(53,90,130)', img: '/assets/images/products/kalite-kontrol.png' },
  { title: 'Doküman Yönetimi', color: 'rgb(0,155,87)', img: '/assets/images/products/dokuman-yonetimi.png' },
  { title: 'Malzeme ve Tedarik Planlama', color: 'rgb(117,81,204)', img: '/assets/images/products/malzeme-tedarik.png' },
  { title: 'Finans Yönetimi', color: 'rgb(17,142,147)', img: '/assets/images/products/finans-yonetimi.png' },
  { title: 'Değerlendirme Yönetimi', color: 'rgb(254,1,100)', img: '/assets/images/products/degerlendirme.png' },
  { title: 'Hatırlatma Yönetimi', color: 'rgb(255,164,0)', img: '/assets/images/products/hatirlatma.png' },
  { title: 'Eğitim Yönetimi', color: 'rgb(40,44,59)', img: '/assets/images/products/egitim-yonetimi.png' },
  { title: 'QR Menü', color: 'rgb(17,142,147)', img: '/assets/images/products/qr-menu.png' },
  { title: 'Lojistik Yönetimi', color: 'rgb(40,44,59)', img: '/assets/images/products/lojistik.png' },
  { title: 'Ayarlar', color: 'rgb(0,155,87)', img: '/assets/images/products/ayarlar.png' },
];

export function productsHTML(): string {
  const cards = products
    .map((p) => {
      const imgArea = p.img
        ? `<div class="urun-img-area"><img src="${p.img}" alt="${p.title}" loading="lazy"></div>`
        : '<div class="urun-img-area"></div>';
      return `<div class="urun-card" style="--card-color:${p.color}"><span class="urun-title">${p.title}</span>${imgArea}</div>`;
    })
    .join('\n        ');

  return `
    <div class="urunler-main">
      <header class="urunler-header">
        <h1>Flowick BPM Modülleri</h1>
        <p>İnsan kaynaklarından finansa, stok yönetiminden CRM'e — iş süreçlerinizi uçtan uca yöneten, kurumunuza göre özelleştirilen modüller.</p>
      </header>
      <div class="urunler-grid">
        ${cards}
      </div>
    </div>
  `;
}
