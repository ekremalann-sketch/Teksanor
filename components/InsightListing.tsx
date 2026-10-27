import Link from "next/link";
import {ArrowRight, BarChart3, Workflow} from "lucide-react";
export default function InsightListing(){return (      <section className="insights-section" id="icgoruler">
        <div className="insights-preview">
          <div className="insights-heading">
            <div>
              <span className="section-kicker">Teksanor içgörüleri</span>
              <h2>İşletmenin içinden gelen, uygulanabilir fikirler.</h2>
              <p>Yönetim kararlarını etkileyen konuları; saha deneyimi, finansal görünürlük ve mühendislik disipliniyle ele alıyoruz.</p>
            </div>
            <aside>
              <span>YAYIN DOSYASI · 01</span>
              <b>İşletme dönüşümü</b>
              <small>4 kapsamlı inceleme · 35 dakika</small>
            </aside>
          </div>

          <div className="insights-topics" role="region" tabIndex={0} aria-label="İçerik başlıkları">
            <span>İş analizi</span><span>Mühendislik</span><span>Finansal görünürlük</span><span>Süreç tasarımı</span>
          </div>

          <div className="insights-editorial-grid">
            <Link className="insight-feature" href="/icerikler/yapay-zeka-is-analizi">
              <img src="/assets/teksanor-digital-twin.webp" alt="Endüstriyel veri ve iş analizi merkezi" />
              <div className="insight-feature-copy">
                <div><span>YAPAY ZEKÂ · İŞ ANALİZİ</span><small>8 dakika</small></div>
                <b>Yapay zekâ, bir işletmenin gerçek problemini nasıl anlamlandırır?</b>
                <p>İyi bir sistem neden teknoloji seçerek değil, doğru iş sorusunu tanımlayarak başlar?</p>
                <em>Oku <ArrowRight size={16} /></em>
              </div>
            </Link>

            <div className="insight-side-stack">
              <Link className="insight-card insight-engineering" href="/icerikler/muhendislik-danismanligi">
                <img src="/assets/teksanor-engineering-lab.webp" alt="Teksanor mühendislik çalışma ortamı" />
                <div>
                  <span>MÜHENDİSLİK YAKLAŞIMI · 10 DAKİKA</span>
                  <b>Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?</b>
                  <em>Oku <ArrowRight size={15} /></em>
                </div>
              </Link>
              <Link className="insight-card insight-finance" href="/icerikler/veri-karar-destek">
                <div className="insight-card-icon"><BarChart3 size={28} /></div>
                <div>
                  <span>FİNANSAL GÖRÜNÜRLÜK · 9 DAKİKA</span>
                  <b>Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?</b>
                  <p>Veriyi yeniden girmeden ortak bir karar ekranı kurmanın temel adımları.</p>
                  <em>Oku <ArrowRight size={15} /></em>
                </div>
              </Link>
            </div>

            <Link className="insight-wide" href="/icerikler/surec-otomasyonu">
              <div>
                <span>SÜREÇ TASARIMI · 8 DAKİKA</span>
                <b>Otomasyon nerede başlamalı, insan kararı nerede kalmalı?</b>
                <p>Tekrar eden işi sadeleştirirken yetki, sorumluluk ve kontrol çizgisini kaybetmeyen bir çalışma modeli.</p>
              </div>
              <div className="insight-wide-action"><Workflow size={22} /><ArrowRight size={18} /></div>
            </Link>
          </div>
        </div>
      </section>

);}
