const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../../frontend/src');
function fixture(api) {
  const entries=new Map();
  const sessionStorage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const c={module:{exports:{}},crypto:require('node:crypto').webcrypto,sessionStorage};vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,'borrowRequest.js'),'utf8').replace('export function','function')+'\nmodule.exports={pendingBorrowKey};',c);
  const setter={};
  const scan={process:{env:{BASE_URL:'/'}},module:{exports:{}},setZXingModuleOverrides:o=>Object.assign(setter,o)};vm.createContext(scan);
  vm.runInContext(fs.readFileSync(path.join(root,'scanner.js'),'utf8').replace(/^import .*$/mg,'').replace(/export /g,'')+'\nmodule.exports={scanFormats,uniqueCodes};',scan);
  assert.equal(setter.locateFile('zxing_reader.wasm'),'/wasm/zxing_reader.wasm');
  const ctx={module:{exports:{}},api,currentUser:{value:{id:2}},pendingBorrowKey:c.module.exports.pendingBorrowKey,
    QrcodeStream:{},scanFormats:scan.module.exports.scanFormats,uniqueCodes:scan.module.exports.uniqueCodes,
    window:{isSecureContext:true},navigator:{mediaDevices:{getUserMedia(){}}},require:()=>''};
  vm.createContext(ctx);
  const script=fs.readFileSync(path.join(root,'views/borrow.vue'),'utf8').split('<script>')[1].split('</script>')[0];
  vm.runInContext(script.replace(/^import .*$/mg,'').replace('export default','module.exports ='),ctx);
  const component=ctx.module.exports,state=component.data();state.$message={success(){}};
  for(const [key,method] of Object.entries(component.methods))state[key]=method.bind(state);
  return {state,entries};
}
test('scanner blocks mismatches and empty stock, handles multiple codes and cancels stale lookups',async()=>{
  let posts=0,calls=0;
  const book={id:2,书名:'book',barcode:'LIB000002',库存:1};
  const api={get:async()=>{calls++;return {data:{book}}},post:async()=>{posts++;}};
  const {state:s}=fixture(api);
  s.showCamera({id:1,书名:'expected'});await s.lookupCode('LIB000002');assert.equal(s.matchedBook,null);assert.match(s.scanError,/不一致/);
  await s.borrowBook();assert.equal(posts,0);
  s.showCamera();s.onDetect([{rawValue:'LIB000001'},{rawValue:'LIB000002'}]);assert.match(s.scanError,/一个/);assert.equal(calls,1);
  book.库存=0;await s.lookupCode('LIB000002');assert.equal(s.matchedBook.库存,0);await s.borrowBook();assert.equal(posts,0);
  s.resetScan();await s.lookupCode('https://example.com');assert.match(s.scanError,/编号格式/);
  let release;api.get=()=>new Promise(resolve=>release=resolve);
  const pending=s.lookupCode('LIB000002');s.showingCamera=false;s.closeCamera();release({data:{book}});await pending;assert.equal(s.matchedBook,null);
  s.onCameraError({name:'NotAllowedError'});assert.equal(s.cameraFailed,true);assert.match(s.scanError,/权限/);
});
test('decoder result leads to lookup and confirmed borrowing; timeouts reuse the operation key',async()=>{
  const payloads=[];let first=true;
  const book={id:1,书名:'test',barcode:'00012345',库存:1};
  const api={get:async url=>url==='/books'?{data:[book]}:{data:{book}},post:async(url,body)=>{
    payloads.push(body);if(first){first=false;throw new Error('timeout');}return {data:{success:true,message:'借阅成功'}};
  }};
  const {state:s,entries}=fixture(api);
  s.showCamera();s.onDetect([{rawValue:'00012345'},{rawValue:'00012345'}]);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(s.matchedBook.barcode,'00012345');
  assert.equal(payloads.length,0);await s.borrowBook();assert.equal(s.showingCamera,true);assert.equal(entries.size,1);
  book.barcode='00099999';
  await s.borrowBook();assert.equal(payloads.length,2);assert.equal(payloads[0].requestId,payloads[1].requestId);
  assert.equal(payloads[0].bookId,1);assert.equal(payloads[0].barcode,'00012345');assert.equal(payloads[1].barcode,'00012345');assert.equal(entries.size,0);assert.equal(s.showingCamera,false);
});
