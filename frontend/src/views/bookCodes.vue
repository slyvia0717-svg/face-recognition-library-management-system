<template>
  <main class="codes-page">
    <router-link to="/borrow">返回借书页</router-link>
    <h1>图书测试二维码</h1>
    <p>可下载二维码并放在手机屏幕上，使用另一台设备的摄像头扫描。二维码内容就是图书编号。</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">正在生成二维码…</p>
    <section v-for="book in books" :key="book.id" class="code-card">
      <h2>{{ book.书名 }}</h2>
      <p>{{ book.barcode }} · 可借 {{ book.库存 }} 本</p>
      <img v-if="book.image" :src="book.image" :alt="book.书名 + '的二维码'" width="320" height="320" />
      <p v-if="book.error" role="alert">{{ book.error }}</p>
      <a v-if="book.image" :href="book.image" :download="book.barcode + '.svg'">下载二维码</a>
    </section>
  </main>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../auth';
const books = ref([]), error = ref(''), loading = ref(true);
onMounted(async () => {
  try {
    books.value = (await api.get('/books')).data.filter(book => !book.archived);
    await Promise.all(books.value.map(async book => {
      try {
        const { data } = await api.get('/bookCode', { params: { bookId: book.id } });
        book.image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data.svg);
      } catch (err) { book.error = '二维码生成失败，请刷新重试'; }
    }));
  } catch (err) { error.value = err.response?.data?.message || '图书加载失败'; }
  finally { loading.value = false; }
});
</script>
<style scoped>
.codes-page { max-width: 760px; margin: 0 auto; padding: 24px 16px; }
h1 { font-size: 24px; }
h2 { font-size: 20px; }
.code-card { padding: 20px; margin: 20px 0; border: 1px solid #ddd; border-radius: 12px; text-align: center; }
img { max-width: 100%; height: auto; display: block; margin: 0 auto 16px; background: white; }
</style>
