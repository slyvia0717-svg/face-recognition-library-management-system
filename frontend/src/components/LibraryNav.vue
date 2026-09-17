<template>
  <nav v-if="currentUser && !publicPage" class="library-nav" aria-label="主要导航">
    <router-link v-for="item in items" :key="item.to" :to="item.to" :class="{ selected: active(item.to) }" :aria-current="active(item.to) ? 'page' : undefined">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="item.icon" /></svg>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { currentUser } from '../auth';
const route = useRoute();
const publicPage = computed(() => ['/', '/FirstPage', '/login', '/login2', '/registerPage'].includes(route.path));
const book = 'M3 4h7a3 3 0 0 1 2 2 3 3 0 0 1 2-2h7v15h-7a3 3 0 0 0-2 2 3 3 0 0 0-2-2H3z M12 6v15';
const people = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8';
const record = 'M7 3h10v4H7z M7 5H4v16h16V5h-3 M8 12h8 M8 16h5';
const user = 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8';
const items = computed(() => currentUser.value?.角色 === '管理员' ? [
  { to: '/adminbooks', label: '图书管理', icon: book }, { to: '/adminpeople', label: '人员管理', icon: people },
  { to: '/adminrecords2', label: '借阅记录', icon: record }, { to: '/admin', label: '个人中心', icon: user }
] : [
  { to: '/borrow', label: '借阅图书', icon: book }, { to: '/return', label: '归还图书', icon: 'M9 4H4v5 M4 4l6 6 M5 15a8 8 0 1 0 2-9' },
  { to: '/userrecords', label: '借阅记录', icon: record }, { to: '/user', label: '个人中心', icon: user }
]);
function active(to) { return route.path === to || (to === '/adminrecords2' && route.path === '/adminrecords') || (['/admin','/user'].includes(to) && route.path === '/faceSettings'); }
</script>
