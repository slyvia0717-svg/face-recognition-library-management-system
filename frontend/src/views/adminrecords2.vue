<template>

    <div class="main-content">

        <router-link to="/adminrecords" class="register">查看借阅统计 → </router-link>
        <div v-if="!borrowRecords.length" class="empty-state">暂无借阅记录，新借阅会显示在这里。</div>
        <div class="records" v-for="record in borrowRecords" :key="record.id">
            <div class="m">
                <p>借阅单号: {{ record.id }}</p>
                <p>借阅用户名:
                    <span v-if="record.isEditing">
                        <select v-model.number="record.user_id"><option :value="null" disabled>请选择正确用户</option><option v-for="person in people" :key="person.id" :value="person.id">{{ person.用户名 }}（ID {{ person.id }}）</option></select>
                    </span>
                    <span v-else>{{ record.用户名 }}</span>
                </p>
            </div>
            <div class="records-state">
                <p>书籍名:
                    <span v-if="record.isEditing">
                        <select v-model.number="record.book_id"><option :value="null" disabled>请选择正确图书</option><option v-for="book in books" :key="book.id" :value="book.id">{{ book.书名 }}（ID {{ book.id }}{{ book.archived ? '，已下架' : '' }}）</option></select>
                    </span>
                    <span v-else>{{ record.书名 }}</span>
                </p>
                <p>借阅状态:
                    <span v-if="record.isEditing">
                        <select v-model="record.借阅状态"><option>借阅</option><option>已还</option></select>
                    </span>
                    <span v-else>{{ record.借阅状态 }}</span>
                </p>
            </div>
            <div class="records-time">
                <p>借阅时间:
                    <span v-if="record.isEditing">
                        <input v-model="record.借阅时间" placeholder="修改借阅开始时间"/>
                    </span>
                    <span v-else>{{ record.借阅时间 }}</span>
                </p>
                <p>归还时间:
                    <span v-if="record.isEditing">
                        <input v-model="record.归还时间" placeholder="修改借阅结束时间"/>
                    </span>
                    <span v-else>{{ record.归还时间 }}</span>
                </p>
            </div>
            <p v-if="record.migration_issue" role="alert">待核对：{{ record.migration_issue }}</p>
            <button v-if="!record.isEditing" @click="modifyRecord(record)">修改</button>
            <button v-if="record.isEditing" @click="saveRecord(record)" :disabled="record.saving">保存</button>
            <button v-if="record.isEditing" @click="fetchBorrowRecords" :disabled="record.saving">取消</button>
        </div>
    </div>

</template>

<script>
import { api as axios } from '../auth';

export default {
    name: 'adminrecords2',
    props: {
        msg: String
    },
    data() {
        return {
            showModal: false,
            navItems: [
                { label: '图书', icon: require('../assets/nav1.png'), route: '/adminbooks' },
                { label: '人员', icon: require('../assets/nav2.png'), route: '/adminpeople' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/adminrecords2' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/admin' }
            ],
            // 借阅记录数据
            borrowRecords: [],
            people: [],
            books: [],
        };
    },
    methods: {
        navigate(route) {
            this.$router.push(route);
        },
        async fetchBorrowRecords() {
            try {
                const response = await axios.get('/queryAllBorrowRecords');
                this.borrowRecords = response.data;
            } catch (error) {
                console.error('获取借阅记录失败:', error);
            }
        },
        modifyRecord(record) {
            record.isEditing = true;
        },
        async saveRecord(record) {
            if (record.saving) return;
            record.saving = true;
            try {
                await axios.put('/updateBorrowRecord', {
                    id: record.id, userId: record.user_id, bookId: record.book_id,
                    status: record.借阅状态, borrowTime: record.借阅时间,
                    returnTime: record.借阅状态 === '已还' ? record.归还时间 : null
                });
                await this.fetchBorrowRecords();
                alert('记录已更新，库存已同步');
            } catch (error) { alert(error.response?.data?.message || '保存失败'); }
            finally { record.saving = false; }
        },
        async fetchChoices() {
            try {
                const [admins, users, books] = await Promise.all([
                    axios.get('/getAdminPeople'), axios.get('/getUserPeople'), axios.get('/books')
                ]);
                this.people = [...admins.data, ...users.data];
                this.books = books.data;
            } catch (err) { alert('无法加载用户和图书选项，请刷新重试'); }
        }
    },
    mounted() {
        this.fetchBorrowRecords();
        this.fetchChoices();
    },
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
.register{
    display: block;
    margin: 30px auto;
    color:rgb(77, 108, 139);
    text-decoration: underline;
    cursor: pointer;
    font-family: "Gill Sans Extrabold";
    font-size: 16px;

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
.m p{text-align: left;}
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
