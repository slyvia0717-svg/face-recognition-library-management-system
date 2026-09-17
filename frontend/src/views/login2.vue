<template>
  <main class="auth-page">
    <router-link to="/FirstPage" class="auth-back">← 返回首页</router-link>
    <section class="auth-card">
      <div class="auth-brand"><span class="brand-mark">阅</span><span>自助图书管理系统</span></div>
      <p class="eyebrow">重逢 · 续一程书香</p><h1>借阅者登录</h1><p class="auth-intro">登录账号，继续你的阅读旅程。</p>
      <form @submit.prevent="submitForm" class="auth-form">
        <label for="nickname">昵称<input id="nickname" v-model.trim="nickname" autocomplete="username" required maxlength="64" placeholder="请输入你的昵称"></label>
        <label for="password">密码<input id="password" v-model="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128" placeholder="请输入登录密码"></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <button type="submit" class="primary" :disabled="busy || faceBusy">{{ busy ? '登录中…' : '登录 →' }}</button>
      </form>
      <div class="auth-divider"><span>或使用便捷登录</span></div>
      <FaceLogin :nickname="nickname"  :disabled="busy" @busy="faceBusy = $event" />
      <p class="auth-bottom">还没有账号？<router-link to="/registerPage">立即注册</router-link></p>
    </section>
  </main>
</template>
<script setup>
import { ref } from 'vue';
import FaceLogin from '../components/FaceLogin.vue';
import { useRouter } from 'vue-router';
import { login } from '../auth';
const nickname = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);
const faceBusy = ref(false);
const router = useRouter();
async function submitForm() {
  if (busy.value || faceBusy.value) return;
  busy.value = true; error.value = '';
  try {
    const user = await login(nickname.value, password.value, false);
    password.value = '';
    await router.replace(user.角色 === '管理员' ? '/admin' : '/user');
  } catch (err) { error.value = err.response?.data?.message || err.message || '登录失败'; }
  finally { busy.value = false; }
}
</script>
