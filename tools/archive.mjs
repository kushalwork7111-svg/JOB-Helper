// Minimal standards-compliant uncompressed ZIP writer for deployment and QA artifacts.
export function zip(parts) {
  const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  const entries=[],central=[];let offset=0;
  for(const part of parts){
    const name=Buffer.from(part.path,'utf8'),body=Buffer.from(part.content,'utf8'),sum=crc(body);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(sum,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
    const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt16LE(33,14);cd.writeUInt32LE(sum,16);cd.writeUInt32LE(body.length,20);cd.writeUInt32LE(body.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);
    entries.push(local,name,body);central.push(cd,name);offset+=local.length+name.length+body.length;
  }
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...entries,cd,end]);
}
