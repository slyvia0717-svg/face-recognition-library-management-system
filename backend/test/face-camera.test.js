const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function camera(getUserMedia, secure = true) {
  let mounted, unmount;
  const events = [], canvases = [];
  const ctx = { module: { exports: {} }, ref: value => ({ value }), defineProps: () => ({}), defineEmits: () => (...args) => events.push(args),
    onMounted: cb => { mounted = cb; }, onBeforeUnmount: cb => { unmount = cb; }, nextTick: async () => {},
    window: { isSecureContext: secure }, navigator: { mediaDevices: { getUserMedia } },
    document: { createElement: () => { const canvas = { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,example' }; canvases.push(canvas); return canvas; } } };
  vm.createContext(ctx);
  const script = fs.readFileSync(path.join(__dirname,'../../frontend/src/components/FaceCamera.vue'),'utf8').split('<script setup>')[1].split('</script>')[0];
  vm.runInContext(script.replace(/^import .*$/mg,'')+'\nmodule.exports={video,photo,error,ready,start,capture,retake};',ctx);
  const instance = ctx.module.exports;
  instance.video.value = { videoWidth: 1280, videoHeight: 720, play: async () => {}, srcObject: null };
  return { instance, events, canvases, mount: () => mounted(), unmount: () => unmount() };
}
const feed = () => { let stops = 0; const stream = { getTracks: () => [{ stop: () => { stops++; } }] }; return { stream, stops: () => stops }; };
test('camera capture preserves aspect ratio, emits JPEG, stops tracks and retakes', async () => {
  const incoming = feed(); let calls = 0;
  const c = camera(async constraints => { calls++; assert.equal(constraints.audio,false); return incoming.stream; });
  await c.mount(); assert.equal(c.instance.ready.value,true);
  c.instance.capture();
  assert.equal(c.canvases[0].width,640); assert.equal(c.canvases[0].height,360);
  assert.equal(c.events[0][0],'captured'); assert.match(c.events[0][1],/^data:image\/jpeg/);
  assert.equal(incoming.stops(),1); assert.equal(c.instance.ready.value,false); assert.equal(c.instance.video.value.srcObject,null);
  await c.instance.retake(); assert.equal(c.events[1][1],''); assert.equal(calls,2);
  c.unmount(); assert.equal(incoming.stops(),2); assert.equal(c.instance.photo.value,'');
});
test('closing before permission or playback completes cleans up late streams', async () => {
  const incoming = feed(); let release;
  const c = camera(() => new Promise(resolve => { release = resolve; }));
  const running = c.mount(); c.unmount(); release(incoming.stream); await running;
  assert.equal(incoming.stops(),1); assert.equal(c.instance.ready.value,false); assert.equal(c.instance.video.value.srcObject,null);
  const playback = feed(); let play;
  const d = camera(async () => playback.stream);
  d.instance.video.value.play = () => new Promise(resolve => { play = resolve; });
  const pending = d.mount(); await new Promise(resolve => setImmediate(resolve));
  d.unmount(); play(); await pending;
  assert.equal(playback.stops(),1); assert.equal(d.instance.ready.value,false);
});
test('camera failures are actionable and insecure pages do not request access', async () => {
  let calls = 0;
  const insecure = camera(async () => { calls++; },false); await insecure.mount();
  assert.equal(calls,0); assert.match(insecure.instance.error.value,/HTTPS/);
  const denied = camera(async () => { throw Object.assign(new Error('denied'),{name:'NotAllowedError'}); }); await denied.mount();
  assert.equal(denied.instance.ready.value,false); assert.match(denied.instance.error.value,/权限/);
  denied.instance.capture(); assert.equal(denied.events.length,0);
});
