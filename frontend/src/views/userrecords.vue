<template>

    <div class="main-content">
        <div v-if="!borrowRecords.length" class="empty-state">还没有借阅记录，阅读旅程从第一本书开始。</div>
        <div class="records" v-for="record in borrowRecords" :key="record.id">
            <p>借阅单号: {{ record.id }}</p>
            <div class="records-state">
                <p>书籍名: {{ record.书名 }}</p>
                <p>借阅状态: {{ record.借阅状态 }}</p>
            </div>
            <div class="records-time">
                <p>借阅时间: {{ record.借阅时间 }}</p>
                <p>归还时间: {{ record.归还时间 }}</p>
            </div>
        </div>
    </div>

</template>

<script>
import { api as axios } from '../auth';
export default {
    name: 'userrecords',
    props: {
        msg: String
    },
    data() {
        return {
            showModal: false,
            navItems: [
                { label: '借书', icon: require('../assets/nav5.png'), route: '/borrow' },
                { label: '还书', icon: require('../assets/nav6.png'), route: '/return' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/userrecords' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/user' }
            ],
            // 借阅记录数据
            borrowRecords: []
        };
    },
    methods: {
        navigate(route) {
            this.$router.push(route);
        },
        async fetchRecords() {
            try { const response = await axios.get('/myBorrowRecords'); this.borrowRecords = response.data; }
            catch (err) { alert(err.response?.data?.message || '无法加载借阅记录'); }
        }
    },
    mounted() { this.fetchRecords(); }
};
</script>

<style scoped>
.header {
    background-image: url('../assets/header.png');
    width: 100%;
    height: 55px;
    background-size: contain;
    position: fixed;/* 固定在页面顶部 */
    top: 0;/* 距离顶部 0px */
    left: 0;/* 距离左边 0px */
    z-index: 1000;/* 确保 header 在最上面 */
}

.nav {
    position: fixed; /* 固定定位 */
    bottom: 0; /* 距离底部0距离 */
    left: 0; /* 距离左侧0距离 */
    width: 380px; /* 宽度100% */
    background-image: url('../assets/nav.jpg');
    height: 55px; /* 高度固定 */
    background-size: contain; /* 背景图片包含 */
    display: flex; /* 弹性布局 */
    justify-content: space-around; /* 项目分布 */
    padding: 10px; /* 内边距 */
    z-index: 1000; /* 确保导航栏在最上层 */
}

.nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
}

.nav-icon {
    width: 30px;
    height: 30px;
    margin-bottom: 5px; /* 控制图标与其他元素的间距 */
}
.records {
    margin: 18px;
    padding: 15px;
    background-color: #f9f9f9;
    border-radius: 5px;
    border-color: rgb(94, 93, 93);
    border-style: solid; /* 添加边框样式 */
    border-width: 1px; /* 添加边框宽度 */
}
.records p {
    margin: 6px 0; /* 设置上下间距为2px，左右间距为0 */
}
.records-state{
    display: flex;
    justify-content: space-between; /* 调整子元素的间距 */
}
.records-time {
    display: flex;
    justify-content: space-between; /* 调整子元素的间距 */
}
.main-content{
    margin-top: 60px;
}
</style>
