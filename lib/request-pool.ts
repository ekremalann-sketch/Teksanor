/** Limit concurrent list requests so opening a workspace does not flood the server. */
export async function runLimited<T>(items:T[], worker:(item:T)=>Promise<void>, concurrency=4, signal?:AbortSignal) {
 let next=0;
 const runners=Array.from({length:Math.min(items.length,Math.max(1,Math.floor(concurrency)))},async()=>{
  while(next<items.length){if(signal?.aborted)return;const item=items[next++];await worker(item);}
 });
 await Promise.all(runners);
}
