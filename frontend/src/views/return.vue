<template>
    <div class="header">
        <div class="search-bar">
            <input type="text" v-model="searchQuery" placeholder="请输入要查询的书籍名称" />
            <button @click="queryBooks">查询</button>
        </div>
    </div>
    <div class="main-content">
        <div v-if="books.length > 0" class="book-item" v-for="book in filteredBooks" :key="book.id">
            <!-- 书籍封面显示图片 -->
            <div class="book-cover" :style="{ backgroundImage: 'url(' + getCoverImage(book.book_id) + ')' }"></div>
            <div class="book-info">
                <p>书名: {{ book.书名 }}</p>
                <p>借阅单号: {{ book.id }}</p>
                <p>借阅时间: {{ book.借阅时间 }}</p>
                <p v-if="book.migration_issue">此旧记录需管理员核对</p>
                <button @click="returnBook(book)" :disabled="returning || !!book.migration_issue">{{ returning === book.id ? '归还中…' : '还书' }}</button>
            </div>
        </div>
        <div v-else class="empty-state">没有待归还的图书，去发现下一本好书吧。</div>
    </div>

</template>

<script>
import { api as axios } from '../auth';

export default {
    name: 'return',
    props: {
        msg: String
    },
    data() {
        return {
            searchQuery: '',
            books: [],
            returning: null,
            navItems: [
                { label: '借书', icon: require('../assets/nav5.png'), route: '/borrow' },
                { label: '还书', icon: require('../assets/nav6.png'), route: '/return' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/userrecords' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/user' }
            ]
        };
    },
    computed: {
        filteredBooks() {
            if (!this.searchQuery) return this.books;
            return this.books.filter(book =>
                book.书名.includes(this.searchQuery)
            );
        }
    },
    methods: {
        navigate(route) {
            this.$router.push(route);
        },
        async queryBooks() {
            try {
                const response = await axios.get('/myBorrowRecords');
                console.log('获取到的图书数据:', response.data);
                this.books = response.data.filter(record => record.借阅状态 === '借阅');
            } catch (error) {
                console.error('获取图书信息失败:', error);
            }
        },
        async returnBook(book) {
            if (this.returning) return;
            this.returning = book.id;
            try {
                const response = await axios.post('/returnBook', {
                    recordId: book.id
                });
                alert(response.data.message);
                // 重新获取图书信息
                this.queryBooks();
            } catch (error) {
                alert(error.response?.data?.message || '请求未确认，请重试；不会重复增加库存');
            } finally { this.returning = null; }
        },
        getCoverImage(id) {
            // 根据书籍ID返回封面图片
            switch (id) {
                case 5: return require('../assets/book13.jpg');
                case 6: return require('../assets/book14.jpg');
                case 7: return require('../assets/book15.jpg');
                case 8: return require('../assets/book16.jpg');
                case 15: return require('../assets/book16.jpg');
                case 10: return require('../assets/book16.jpg');
                case 14: return require('../assets/book16.jpg');
                case 16: return require('../assets/book13.jpg');
                case 17: return require('../assets/book13.jpg');
                case 18: return require('../assets/book13.jpg');
                case 19: return require('../assets/book14.jpg');
                case 20: return require('../assets/book14.jpg');
                case 4: return require('../assets/book14.jpg');
            }
        }
    },
    mounted() {
        this.queryBooks();
    }
};
</script>

<style scoped>
.header {
    background-image: url('../assets/header.png');
    width: 100%;
    height: 55px;
    background-size: contain;
    position: fixed;   /* 固定在页面顶部 */
    top: 0;            /* 距离顶部 0px */
    left: 0;           /* 距离左边 0px */
    z-index: 1000;     /* 确保 header 在最上面 */
}

.main-content {
    margin-top: 65px;  /* 给 main-content 留出空间，避免被 header 遮挡 */
    padding: 10px;
}


.nav {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background-image: url('../assets/nav.jpg');
    height: 55px;
    background-size: contain;
    display: flex;
    justify-content: space-around;
    padding: 10px;
    z-index: 1000;
}

.main-content {
    margin-top: 65px;
    padding: 10px;
}

.book-item {
    display: flex;
    margin-bottom: 10px;
    padding: 10px; /* 增加外边距避免紧贴边框 */
    background-color: #f9f9f9; /* 添加背景色，使书籍信息更突出 */
    border-radius: 8px; /* 圆角效果 */
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); /* 添加阴影效果 */
}

.book-cover {
    width: 100px;
    height: 140px;
    margin-left: 5px;
    margin-top: 15px;
    margin-right: 10px;
    background-size: cover;
    background-position: center;
}

.book-info {
    flex: 1;
    border: 1px solid #ddd; /* 添加边框 */
    padding: 10px; /* 内边距，给信息和边框之间留出空间 */
    border-radius: 8px; /* 圆角效果，确保边框不会太尖锐 */
    background-color: #fff; /* 背景色，确保信息内容清晰 */
}
.book-info p{
    margin: 10px 0; /* 设置上下间距为2px，左右间距为0 */
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
    margin-bottom: 5px;
}

input {
    margin-top: 5px;
    padding: 5px;
    border-radius: 4px;
    border: 1px solid #ccc;
}
.search-bar{margin-top: 15px;
}
</style>
