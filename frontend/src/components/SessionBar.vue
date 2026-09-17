<template>
  <div v-if="currentUser && !publicPage" class="session-bar">
    <router-link class="session-brand" :to="currentUser.角色 === '管理员' ? '/admin' : '/user'"><span class="brand-mark">阅</span><span>图书管理<small>自助借阅 · 书香相伴</small></span></router-link>
    <span class="account" :title="currentUser.用户名">{{ currentUser.用户名 }}</span>
    <button type="button" :disabled="busy" @click="signOut">{{ busy ? '退出中…' : '退出登录' }}</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { currentUser, logout } from '../auth';
const route = useRoute(), router = useRouter();
const publicPage = computed(() => ['/', '/FirstPage', '/login', '/login2', '/registerPage'].includes(route.path));
const busy = ref(false), error = ref('');
async function signOut() {
  if (busy.value) return;
  const destination = currentUser.value?.角色 === '管理员' ? '/login' : '/login2';
  busy.value = true; error.value = '';
  try {
    await logout();
    await router.replace(destination);
  } catch (err) { error.value = err.response?.data?.message || '退出登录失败，请重试'; }
  finally { busy.value = false; }
}
</script>
