<template>
  <router-link to="/adminrecords2" class="text-link">← 返回借阅记录</router-link>
  <div class="statistics-layout">
    <section class="statistics-card"><p class="eyebrow">总览 · 借还有序</p><h2>归还状态</h2><p>查看全馆借阅记录的归还情况。</p><div class="metric-grid"><div><span>未归还数量</span><strong>{{ unreturnedCount }}</strong><small>借阅中的图书</small></div><div><span>已归还数量</span><strong>{{ returnedCount }}</strong><small>已完成的借阅</small></div></div></section>
    <section class="statistics-card"><p class="eyebrow">日录 · 书来书往</p><h2>每日借阅</h2><p>选择要查询的日期，了解当天借还情况。</p><form class="date-search" @submit.prevent="searchByDate"><label for="statistics-date">查询日期<input id="statistics-date" v-model="searchDate" placeholder="YYYYMMDD，例如 20260917" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" required></label><button type="submit">查询</button></form><div class="metric-grid"><div><span>当日借出</span><strong>{{ dailyBorrowedCount }}</strong><small>借出图书数量</small></div><div><span>当日归还</span><strong>{{ dailyReturnedCount }}</strong><small>归还图书数量</small></div></div></section>
  </div>
</template>
<script>
import { api as axios } from '../auth';

export default {
  name: 'adminrecords',
  props: {
    msg: String
  },
  data() {
    return {
      showModal: false,
      navItems: [
        { label: '图书', icon: require('../assets/nav1.png'), route: '/adminbooks' },
        { label: '人员', icon: require('../assets/nav2.png'), route: '/adminpeople' },
        { label: '记录', icon: require('../assets/nav3.png'), route: '/adminrecords' },
        { label: '我的', icon: require('../assets/nav4.png'), route: '/admin' }
      ],
      // 新增的数据绑定变量
      unreturnedCount: 0,
      returnedCount: 0,
      searchDate: '',
      dailyBorrowedCount: 0,
      dailyReturnedCount: 0
    };
  },
  methods: {
    navigate(route) {
      this.$router.push(route);
    },
    // 新增的方法，用于按日期搜索
    async searchByDate() {
      if (!this.searchDate) {
        return;
      }
      try {
        const response = await axios.get(`/queryBorrowRecords?date=${this.searchDate}`);
        this.dailyBorrowedCount = response.data.dailyBorrowedCount;
        this.dailyReturnedCount = response.data.dailyReturnedCount;
      } catch (error) {
        console.error('按日期查询失败:', error);
      }
    },
    async fetchReturnStatus() {
      try {
        const response = await axios.get('/getReturnStatus');
        this.unreturnedCount = response.data.unreturned_count;
        this.returnedCount = response.data.returned_count;
      } catch (error) {
        console.error('获取归还状态统计数据失败:', error);
      }
    }
  },
  mounted() {
    this.fetchReturnStatus();
  }
};
</script>
