"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Başlangıç",
    price: "₺4.900",
    period: "/ ay",
    text: "Küçük teknik servis ve bakım ekipleri için temel operasyon çekirdeği.",
    features: [
      "5 kullanıcıya kadar",
      "İş emri ve saha ziyareti yönetimi",
      "Müşteri ve ekipman kaydı",
      "Temel finansal takip",
    ],
  },
  {
    name: "Profesyonel",
    price: "₺9.900",
    period: "/ ay",
    highlighted: true,
    text: "Büyüyen firmalar için tam operasyon, finans ve raporlama.",
    features: [
      "25 kullanıcıya kadar",
      "Periyodik bakım ve varlık envanteri",
      "Satın alma, risk ve otomasyon modülleri",
      "Rol bazlı yetkilendirme ve denetim kaydı",
    ],
  },
  {
    name: "Kurumsal",
    price: "Özel",
    period: "",
    text: "Çok lokasyonlu operasyonlar ve özel entegrasyon ihtiyaçları için.",
    features: [
      "Sınırsız kullanıcı",
      "Özel entegrasyonlar ve API erişimi",
      "Yapay zekâ destekli iş analizi",
      "Öncelikli destek ve pilot çalışma",
    ],
  },
];

export default function PublicMarket() {
  return (
    <section className="public-market" id="fiyatlandirma" aria-label="Teksanor planları">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Planlar</span>
          <h2>İhtiyacınıza göre ölçeklenen kullanım paketleri.</h2>
        </div>
        <p>Tüm planlar firma bazlı veri ayrımı, güvenli erişim ve işlem geçmişi ile gelir.</p>
      </div>
      <div className="market-grid">
        {plans.map((plan) => (
          <article
            className="market-card"
            key={plan.name}
            style={plan.highlighted ? { borderColor: "var(--brand)", boxShadow: "var(--shadow)" } : undefined}
          >
            <h3>{plan.name}</h3>
            <p>{plan.text}</p>
            <div className="market-price">
              {plan.price} <small>{plan.period}</small>
            </div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} /> {feature}
                </li>
              ))}
            </ul>
            <Link className="primary-action" href="/giris#kayit" style={{ width: "100%", justifyContent: "center" }}>
              Başla <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
