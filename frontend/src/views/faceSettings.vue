<template>
  <main class="face-settings">
    <router-link :to="currentUser?.角色 === '管理员' ? '/admin' : '/user'">返回个人中心</router-link>
    <h1>人脸识别设置</h1>
    <p>登录账号：{{ currentUser?.用户名 }}</p>
    <p v-if="loading">正在查询录入状态…</p>
    <p v-else>当前状态：{{ enrolled ? '已录入' : '未录入' }} <span v-if="updatedAt">（{{ new Date(updatedAt).toLocaleString() }}）</span></p>
    <p>使用当前密码确认身份后，录入本人清晰正面人脸。录入或删除会注销该账号的其他登录会话。</p>
    <p>当前提供人脸比对，尚未加入活体检测。密码登录始终可用。</p>
    <el-input v-model="password" type="password" show-password maxlength="128" autocomplete="current-password" placeholder="请输入当前密码" :disabled="busy" />
    <div class="actions">
      <el-button type="primary" :disabled="loading || busy" @click="start">{{ enrolled ? '重新录入' : '录入本人' }}</el-button>
      <el-button v-if="enrolled" type="danger" :disabled="busy" @click="remove">删除人脸</el-button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <el-dialog v-model="visible" title="录入本人脸部" width="min(92vw, 540px)" destroy-on-close :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy" :before-close="beforeClose">
      <FaceCamera v-if="visible" :disabled="busy" @captured="image = $event" />
      <p v-if="error" role="alert">{{ error }}</p>
      <template #footer><el-button :disabled="busy" @click="visible = false">取消</el-button><el-button type="primary" :disabled="!image || busy" @click="enroll">{{ busy ? '录入中…' : '确认录入本人' }}</el-button></template>
    </el-dialog>
  </main>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import FaceCamera from '../components/FaceCamera.vue';
import { api, currentUser } from '../auth';
const loading = ref(true), enrolled = ref(false), updatedAt = ref(null), busy = ref(false), visible = ref(false);
const password = ref(''), image = ref(''), error = ref(''), message = ref('');
function explain(err) { return err.response?.data?.message || err.message || '操作失败，请稍后重试'; }
async function refresh() {
  loading.value = true;
  try { const { data } = await api.get('/face/status'); enrolled.value = data.enrolled; updatedAt.value = data.updatedAt; }
  finally { loading.value = false; }
}
function checkPassword() {
  error.value = ''; message.value = '';
  if (password.value.length < 8 || password.value.length > 128) { error.value = '请输入 8–128 个字符的当前密码'; return false; }
  return true;
}
function start() { if (checkPassword()) { image.value = ''; visible.value = true; } }
function beforeClose(done) { if (!busy.value) done(); }
watch(visible, value => { if (!value) image.value = ''; });
async function enroll() {
  if (busy.value || !image.value || !checkPassword()) return;
  busy.value = true;
  try {
    const { data } = await api.post('/face/enroll', { password: password.value, image: image.value }, { timeout: 60000 });
    message.value = data.message; visible.value = false; password.value = ''; image.value = '';
    await refresh();
  } catch (err) { error.value = explain(err); }
  finally { busy.value = false; }
}
async function remove() {
  if (busy.value || !checkPassword()) return;
  busy.value = true;
  try {
    await ElMessageBox.confirm('删除后将无法使用人脸登录，可以通过密码登录重新录入。', '删除人脸', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' });
    const { data } = await api.delete('/face', { data: { password: password.value } });
    message.value = data.message; password.value = ''; await refresh();
  } catch (err) { if (err !== 'cancel' && err !== 'close') error.value = explain(err); }
  finally { busy.value = false; }
}
onMounted(() => refresh().catch(err => { error.value = explain(err); }));
</script>
<style scoped>
.face-settings { max-width: 620px; margin: 0 auto; padding: 24px 18px; }
h1 { font-size: 24px; } p { line-height: 1.7; } .actions { display: flex; gap: 10px; margin: 18px 0; }
.el-button--primary { background: #466d9f; border-color: #466d9f; color: #fff; }
.el-button--danger { background: #b84b4b; border-color: #b84b4b; color: #fff; }
</style>
