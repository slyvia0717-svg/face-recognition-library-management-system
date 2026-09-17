<template>
  <main class="auth-page">
    <router-link to="/FirstPage" class="auth-back">← 返回首页</router-link>
    <section class="auth-card">
      <div class="auth-brand"><span class="brand-mark">阅</span><span>自助图书管理系统</span></div>
      <p class="eyebrow">初见 · 开一卷新章</p><h1>创建借阅账号</h1><p class="auth-intro">填写个人信息，开启你的阅读旅程。</p>
      <form class="auth-form" @submit.prevent="submitForm">
        <label for="nickname">昵称<input id="nickname" v-model="nickname" required maxlength="64" autocomplete="username" placeholder="用来登录的昵称"></label>
        <div class="form-columns"><label for="name">姓名<input id="name" v-model="name" required maxlength="100" autocomplete="name" placeholder="你的姓名"></label><label for="contact">联系电话<input id="contact" v-model="contact" required maxlength="32" type="tel" autocomplete="tel" placeholder="你的电话号码"></label></div>
        <label for="password">密码<input id="password" v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="设置 8–128 个字符的密码"></label>
        <div class="optional-photo"><span>个人照片 <small>可选</small></span><button type="button" @click="openImagePicker">{{ imageUrl ? '重新选择照片' : '选择照片' }}</button><input hidden type="file" ref="imageInput" @change="handleImageChange" accept="image/*" capture="camera"><img v-if="imageUrl" :src="imageUrl" alt="所选个人照片预览"></div>
        <button type="submit" class="primary">创建账号 →</button>
      </form><p class="auth-bottom">已有账号？<router-link to="/login2">立即登录</router-link></p>
    </section>
  </main>
</template>
<script>
import { api as axios } from '../auth';

export default {
  name: 'registerPage',
  props: {
    msg: String
  },
  data() {
    return {
      nickname: '',
      password: '',
      name: '',
      contact: '',
      imageUrl: null
    };
  },
  methods: {
    openImagePicker() {
      this.$refs.imageInput.click();
    },
    handleImageChange(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.imageUrl = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    },
    async submitForm() {
      if (!this.nickname || !this.name || !this.contact || this.password.length < 8 || this.password.length > 128) {
        alert('请确保所有字段都已填写！');
        return;
      }
      else{


        const registerData = {
        nickname: this.nickname,
        password: this.password,
        name: this.name,
        contact: this.contact,
        imageUrl: this.imageUrl
      };
      try {
        const response = await axios.post('/register', registerData);
        this.password = '';
        alert(response.data.message);
        this.$router.push('/login2');
      } catch (error) {
        alert(error.response?.data?.message || '注册失败，请稍后再试');
      }
    }

    }
  }
};
</script>
