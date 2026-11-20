/* Browser-only photo optimizer and dependency-free ZIP writer.
 * Files never leave this browser until the teacher manually imports the ZIP into GitHub.
 */
const encoder=new TextEncoder();
export function photoName(chapterId,stageId,phase,slideIndex,filename,serial=1){
 const stem=String(filename||'photo').replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,36).toLowerCase()||'photo';
 return `ch${chapterId}-st${String(stageId).replace(/-/g,'_')}-${phase}-${slideIndex+1}-${serial}-${stem}.webp`;
}
export async function optimizePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, or WEBP photo.');
 if(file.size>16*1024*1024)throw Error('This photo exceeds 16 MB. Resize it before selecting.');
 if(typeof createImageBitmap==='function'&&typeof document!=='undefined'){
  try{
   const bitmap=await createImageBitmap(file);
   const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.83));
   canvas.width=canvas.height=0;
   if(blob&&blob.type==='image/webp'&&blob.size)return blob;
  }catch(error){console.warn('Photo optimization fallback:',error)}
 }
 // Browser fallback: preserve compatible image bytes under the correct extension.
 return file;
}
function put16(view,p,v){view.setUint16(p,v,true)}
function put32(view,p,v){view.setUint32(p,v>>>0,true)}
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export async function photoPackZip(entries,{kind='image'}={}){
 if(!['image','audio'].includes(kind))throw Error('Unknown asset pack type.');
 if(!entries.length)throw Error('No staged photos to export.');
 if(entries.length>(kind==='audio'?40:250))throw Error('Too many files in asset pack.');
 const output=[],central=[];let offset=0,total=0;
 for(const entry of entries){
  const name=String(entry.name||'');
  const allowed=kind==='audio'?/^docs\/story\/audio\/[a-z0-9][a-z0-9_.-]*\.(?:mp3|m4a|webm|opus|ogg|wav)$/:/^docs\/story\/images\/[a-z0-9_.-]+\.(webp|png|jpg|jpeg)$/;
  if(!allowed.test(name))throw Error('Unsafe filename in asset pack.');
  const bytes=new Uint8Array(await entry.blob.arrayBuffer());const fname=encoder.encode(name);
  total+=bytes.length;if(total>(kind==='audio'?100:60)*1024*1024)throw Error('Asset pack too large. Export smaller batches or compress the audio.');
  const crc=crc32(bytes);
  const local=new Uint8Array(30+fname.length);const l=new DataView(local.buffer);
  put32(l,0,0x04034b50);put16(l,4,20);put16(l,6,0x0800);put16(l,8,0);put16(l,10,0);put16(l,12,0);
  put32(l,14,crc);put32(l,18,bytes.length);put32(l,22,bytes.length);put16(l,26,fname.length);put16(l,28,0);local.set(fname,30);
  const head=new Uint8Array(46+fname.length);const h=new DataView(head.buffer);
  put32(h,0,0x02014b50);put16(h,4,20);put16(h,6,20);put16(h,8,0x0800);put16(h,10,0);put16(h,12,0);put16(h,14,0);
  put32(h,16,crc);put32(h,20,bytes.length);put32(h,24,bytes.length);put16(h,28,fname.length);put16(h,30,0);put16(h,32,0);put16(h,34,0);put16(h,36,0);put32(h,38,0);put32(h,42,offset);head.set(fname,46);
  output.push(local,bytes);central.push(head);offset+=local.length+bytes.length;
 }
 const start=offset;for(const c of central){output.push(c);offset+=c.length}
 const end=new Uint8Array(22);const e=new DataView(end.buffer);
 put32(e,0,0x06054b50);put16(e,4,0);put16(e,6,0);put16(e,8,entries.length);put16(e,10,entries.length);put32(e,12,offset-start);put32(e,16,start);put16(e,20,0);output.push(end);
 return new Blob(output,{type:'application/zip'});
}
