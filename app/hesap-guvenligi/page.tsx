import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Hesap güvenliği"
      title="Hesabınızı koruma altına alın"
      intro="Güçlü parola, iki adımlı doğrulama ve oturum yönetimi ile hesabınızın güvenliğini artırın. Bu ayarlara giriş yaptıktan sonra hesap menüsünden ulaşabilirsiniz."
      sections={[{"title": "Öneriler", "bullets": ["En az 12 karakterli, tahmin edilmesi zor bir parola kullanın.", "İki adımlı doğrulamayı (MFA) etkinleştirin.", "Şüpheli bir durumda parolanızı hemen değiştirin."]}]}
      cta={{"label": "Giriş yap", "href": "/giris"}}
    />
  );
}
