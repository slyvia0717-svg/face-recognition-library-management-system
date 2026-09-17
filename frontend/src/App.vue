<template>
  <SessionBar />
  <div class="route-content" :class="publicPage ? 'is-public' : 'is-private'">
    <div v-if="!publicPage && currentUser && heading" class="workspace-heading">
      <p class="eyebrow">{{ currentUser.角色 === '管理员' ? '馆务 · 有序藏书' : '书房 · 阅读日常' }}</p>
      <h1>{{ heading.title }}</h1><p>{{ heading.description }}</p>
    </div>
    <router-view />
  </div>
  <LibraryNav />
</template>
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { currentUser } from './auth';
import SessionBar from './components/SessionBar.vue';
import LibraryNav from './components/LibraryNav.vue';
const route = useRoute();
const publicPage = computed(() => ['/', '/FirstPage', '/login', '/login2', '/registerPage'].includes(route.path));
const headings = {
  '/borrow': { title: '发现下一本好书', description: '查找喜欢的图书，扫描编号，即可开启阅读。' },
  '/return': { title: '归还图书', description: '查看待归还的图书，轻松完成本次借阅。' },
  '/userrecords': { title: '我的阅读足迹', description: '每一次借阅，都在这里留下记录。' },
  '/adminbooks': { title: '图书管理', description: '管理馆藏、图书编号与可借库存。' },
  '/adminpeople': { title: '人员管理', description: '查看与维护管理员及借阅者的账号信息。' },
  '/adminrecords2': { title: '借阅记录', description: '查看借还记录，核对并维护借阅信息。' },
  '/adminrecords': { title: '借阅统计', description: '查看图书归还情况与每日借阅数据。' },
  '/user': { title: '个人中心', description: '管理个人信息，设置更便捷的登录方式。' },
  '/admin': { title: '管理工作台', description: '集中管理图书、人员与借阅服务。' }
};
const heading = computed(() => headings[route.path]);
</script>
