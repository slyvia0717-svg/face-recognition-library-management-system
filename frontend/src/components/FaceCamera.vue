<template>
  <div class="face-camera">
    <p>请独自正对摄像头，保持光线充足。拍摄的照片仅用于本次验证。</p>
    <video v-if="!photo" ref="video" autoplay muted playsinline aria-label="摄像头预览"></video>
    <img v-else :src="photo" alt="本次拍摄预览">
    <p v-if="error" role="alert">{{ error }}</p>
    <el-button v-if="!photo" :disabled="!ready || disabled" @click="capture">拍摄</el-button>
    <el-button v-else :disabled="disabled" @click="retake">重新拍摄</el-button>
    <el-button v-if="error" :disabled="disabled" @click="start">重新开启摄像头</el-button>
  </div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
defineProps({ disabled: Boolean });
const emit = defineEmits(['captured']);
const video = ref(null), photo = ref(''), error = ref(''), ready = ref(false);
let stream = null, generation = 0, disposed = false;
function stop() {
  generation++; ready.value = false;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  if (video.value) video.value.srcObject = null;
}
async function start() {
  stop(); error.value = '';
  const own = generation;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('摄像头需要 HTTPS 或 localhost，请使用安全地址打开页面');
    const incoming = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
    if (disposed || own !== generation) { incoming.getTracks().forEach(track => track.stop()); return; }
    stream = incoming;
    await nextTick();
    if (!video.value) { stop(); return; }
    video.value.srcObject = stream;
    await video.value.play();
    if (!disposed && own === generation) ready.value = true;
  } catch (err) {
    if (disposed || own !== generation) return;
    stop();
    error.value = err.name === 'NotAllowedError' ? '摄像头权限被拒绝，请在浏览器中允许访问摄像头' : err.name === 'NotFoundError' ? '未找到摄像头，请连接摄像头后重试' : err.message || '摄像头启动失败';
  }
}
function capture() {
  const source = video.value;
  if (!ready.value || !source?.videoWidth || !source.videoHeight) { error.value = '摄像头尚未准备好，请稍后拍摄'; return; }
  const scale = Math.min(1, 640 / Math.max(source.videoWidth, source.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  photo.value = canvas.toDataURL('image/jpeg', 0.85);
  stop(); emit('captured', photo.value);
}
async function retake() { photo.value = ''; emit('captured', ''); await nextTick(); await start(); }
onMounted(start);
onBeforeUnmount(() => { disposed = true; stop(); photo.value = ''; });
</script>
<style scoped>
.face-camera { text-align: center; }
video, img { display: block; width: 100%; max-width: 480px; max-height: 360px; object-fit: contain; margin: 12px auto; border-radius: 12px; background: #18202b; }
p { line-height: 1.6; }
</style>
