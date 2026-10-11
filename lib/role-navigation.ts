import {homeFor as roleHome,type AccessProfile} from "./access-rules";
export function homeFor(access:{profile:string;department?:string|null;jobRole?:string}){
 const home=roleHome(access.profile as AccessProfile,access.department);
 if(access.profile==="employee")return "/servis?view=today";
 return home.startsWith("#")?"/panel"+home:home;
}
