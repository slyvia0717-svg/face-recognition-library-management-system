<template>
  <div class="face-login">
    <el-button :disabled="disabled" @click="open">人脸登录</el-button>
    <p>首次使用请先密码登录，在“人脸识别设置”中录入。</p>
    <el-dialog v-model="visible" title="人脸登录" width="min(92vw, 540px)" destroy-on-close :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy" :before-close="beforeClose">
      <p>登录账号：{{ account }}</p>
      <FaceCamera v-if="visible" :disabled="busy" @captured="image = $event" />
      <p v-if="error" role="alert">{{ error }}</p>
      <template #footer><el-button :disabled="busy" @click="visible = false">取消</el-button><el-button type="primary" :disabled="!image || busy" @click="submit">{{ busy ? '识别中…' : '识别并登录' }}</el-button></template>
    </el-dialog>
    <p v-if="!visible && error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import FaceCamera from './FaceCamera.vue';
import { faceLogin } from '../auth';
const props = defineProps({ nickname: String, adminOnly: Boolean, disabled: Boolean });
const emit = defineEmits(['busy']);
const visible = ref(false), busy = ref(false), image = ref(''), error = ref(''), account = ref('');
const router = useRouter();
let controller;
watch(visible, value => { if (!value) image.value = ''; });
onBeforeUnmount(() => { controller?.abort(); image.value = ''; });
function open() {
  error.value = ''; image.value = ''; account.value = props.nickname?.trim() || '';
  if (!account.value) { error.value = '请先在上方填写用户名'; return; }
  visible.value = true;
}
function beforeClose(done) { if (!busy.value) done(); }
async function submit() {
  if (busy.value || !image.value) return;
  busy.value = true; emit('busy', true); error.value = '';
  try {
    controller = new AbortController();
    const user = await faceLogin(account.value, image.value, props.adminOnly, controller.signal);
    image.value = ''; visible.value = false;
    await router.replace(user.角色 === '管理员' ? '/admin' : '/user');
  } catch (err) { error.value = err.response?.data?.message || err.message || '识别失败，请尝试密码登录'; }
  finally { busy.value = false; emit('busy', false); }
}
</script>
<style scoped>
.face-login { margin: 18px auto; text-align: center; }
p { font-size: 14px; line-height: 1.6; }
.el-button--primary { background: #466d9f; border-color: #466d9f; color: #fff; }
.el-button--danger { background: #b84b4b; border-color: #b84b4b; color: #fff; }
</style>
