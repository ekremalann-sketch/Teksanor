import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Hesap kurtarma"
      title="Erişiminizi geri kazanın"
      intro="Parolanızı unuttuysanız veya hesabınıza erişemiyorsanız, kurtarma adımlarını izleyerek erişiminizi güvenli biçimde geri kazanabilirsiniz."
      sections={[{"title": "Adımlar", "bullets": ["Giriş sayfasında 'Parolamı unuttum' bağlantısını kullanın.", "Kayıtlı e-posta adresinize gönderilen talimatları izleyin.", "Sorun devam ederse yöneticinizle iletişime geçin."]}]}
      cta={{"label": "Giriş sayfası", "href": "/giris"}}
    />
  );
}
