"use client";
import {useEffect,useRef,useState} from "react";

// 600×200 mantıksal tuval; parmak, kalem veya fareyle çizilir.
// Çizgiler tamsayı koordinat dizisi olarak üst bileşene verilir; sunucu bunları doğrular.
const W=600,H=200;
export type Strokes=number[][];

export function SignaturePad({onChange,disabled}:{onChange:(strokes:Strokes)=>void;disabled?:boolean}){
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const strokes=useRef<Strokes>([]);
 const drawing=useRef(false);
 const [count,setCount]=useState(0);

 function paint(){
  const c=canvas.current;const ctx=c?.getContext("2d");if(!c||!ctx)return;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle="#9fb0c2";ctx.lineWidth=1;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(24,H-40);ctx.lineTo(W-24,H-40);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle="#0b1929";ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";
  for(const s of strokes.current){ctx.beginPath();ctx.moveTo(s[0],s[1]);for(let i=2;i<s.length;i+=2)ctx.lineTo(s[i],s[i+1]);if(s.length===2)ctx.lineTo(s[0]+1,s[1]);ctx.stroke();}
 }
 useEffect(()=>{paint();},[]);

 function point(e:React.PointerEvent<HTMLCanvasElement>){
  const r=e.currentTarget.getBoundingClientRect();
  const x=Math.round(Math.min(W,Math.max(0,(e.clientX-r.left)/r.width*W)));
  const y=Math.round(Math.min(H,Math.max(0,(e.clientY-r.top)/r.height*H)));
  return [x,y];
 }
 function down(e:React.PointerEvent<HTMLCanvasElement>){
  if(disabled||strokes.current.length>=60)return;
  e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;
  strokes.current.push(point(e));paint();
 }
 function move(e:React.PointerEvent<HTMLCanvasElement>){
  if(!drawing.current)return;
  const s=strokes.current[strokes.current.length-1];const [x,y]=point(e);
  // Çok yakın noktaları atla: veri küçük kalır, çizgi düzgün görünür.
  if(Math.abs(x-s[s.length-2])+Math.abs(y-s[s.length-1])<3||s.length>=400)return;
  s.push(x,y);paint();
 }
 function up(){if(!drawing.current)return;drawing.current=false;setCount(strokes.current.length);onChange(strokes.current.map(s=>[...s]));}
 function clear(){strokes.current=[];setCount(0);paint();onChange([]);}

 return <div className="signature-pad service-wide">
  <span id="signature-label">İmza <small>(isteğe bağlı; parmağınızla veya fareyle çizin)</small></span>
  <canvas ref={canvas} width={W} height={H} role="img" aria-labelledby="signature-label" aria-describedby="signature-help"
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}/>
  <small id="signature-help">İmza çizmek zorunlu değildir; adınız ve onay kutusu onay için yeterlidir. Klavye kullanıyorsanız bu alanı atlayabilirsiniz.</small>
  <div className="service-actions"><button type="button" onClick={clear} disabled={disabled||count===0}>İmzayı temizle</button></div>
 </div>;
}

/** Saklanan (sunucuda doğrulanmış) imza yolunu gösterir. */
export function SignatureView({path,label}:{path:string;label:string}){
 return <svg className="signature-view" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}><path d={path}/></svg>;
}
