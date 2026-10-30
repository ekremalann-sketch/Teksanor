// SQLite accepts missing anonymous values as NULL; D1's bind contract must not be silently relaxed.
export function assertSqlBindings(query, values) {
  let expected=0, quote='', line=false, block=false;
  for(let i=0;i<query.length;i++){
    const c=query[i], n=query[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(c===quote){if(n===quote)i++;else quote='';}continue;}
    if(c==='-'&&n==='-'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
    if(c==='['){quote=']';continue;}
    if(c==='?')expected++;
  }
  if(values.length!==expected)throw new Error(`SQL binding count mismatch: expected ${expected}, received ${values.length}`);
}
