const ROOTS=["/panel","/birimler","/servis","/kullanicilar","/ornek-isletme","/veri-yonetimi"];
export function safeWorkspacePath(value:string|null|undefined){
 if(!value||!value.startsWith("/")||value.startsWith("//"))return "/panel";
 try{const url=new URL(value,"https://workspace.invalid");if(url.origin!=="https://workspace.invalid"||!ROOTS.some(root=>url.pathname===root||url.pathname.startsWith(root+"/")))return "/panel";return url.pathname+url.search+url.hash;}catch{return "/panel";}
}
export function loginPath(returnTo:string){return "/giris?returnTo="+encodeURIComponent(safeWorkspacePath(returnTo));}
export function goToLogin(){location.replace(loginPath(location.pathname+location.search+location.hash));}
export function goToMfaSetup(){location.replace("/hesap-guvenligi?returnTo="+encodeURIComponent(safeWorkspacePath(location.pathname+location.search+location.hash)));}
