<template>
    <div class="header">
        <div class="search-bar">
            <input type="text" v-model="searchQuery" placeholder="请输入要查询的书籍名称" />
            <button @click="queryBooks">查询</button>
        </div>
    </div>
    <div class="main-content">
        <div class="book-item" v-for="book in filteredBooks" :key="book.id">
            <!-- 书籍封面显示图片，现在图片命名规则为 book图书id.jpg -->
            <div class="book-cover" :style="{ backgroundImage: 'url(' + getCoverImage(book.id) + ')' }"></div>

            <div class="book-info">
                <p>书名:
                    <span v-if="book.isEditing">
                        <input v-model="book.书名" placeholder="修改书名"/>
                    </span>
                    <span v-else>{{ book.书名 || '无' }}</span>
                </p>

                <p>图书编号：
                    <input v-if="book.isEditing" v-model.trim="book.barcode" type="text" maxlength="64" aria-label="图书条形码编号" />
                    <span v-else>{{ book.barcode }}</span>
                </p>
                <p>库存:
                    <span>{{ book.库存 || 0 }}（自动计算）</span>
                    <span v-if="book.legacy_reserved">，旧账待核对占用 {{ book.legacy_reserved }}</span>
                </p>

                <p>总数:
                    <span v-if="book.isEditing">
                        <input v-model="book.总数" type="number" min="0" step="1" placeholder="修改总数"/>
                    </span>
                    <span v-else>{{ book.总数 || 0 }}</span>
                </p>
                <button @click="modifyBook(book)" v-if="!book.isEditing">修改</button>
                <button @click="saveBook(book)" v-if="book.isEditing">保存</button>
                <button class="danger-text" @click="deleteBook(book)" v-if="!book.isEditing">下架</button>
            </div>
        </div>
    </div>
    <router-link to="/bookCodes" class="code-link">查看 / 下载图书二维码</router-link>
    <button class="add-book-button" aria-label="添加图书" @click="toggleModal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
    </button>


    <div v-if="showModal" class="modal">
        <div class="modal-content">
  <h2>添加图书</h2>
  <form>
    <label for="new-title">书名：</label>
    <input type="text" id="new-title" v-model="newBook.title" />
    <label for="new-total">总量：</label>
    <input type="number" id="new-total" v-model="newBook.total" min="0" step="1" />
    <label for="new-ma">条形码：</label>
    <input type="text" id="new-ma" v-model.trim="newBook.barcode" maxlength="64" placeholder="可填 ISBN；留空自动生成编号" />
    <br>
    <button type="button" @click="addNewBook">保存</button>
    <button type="button" @click="toggleModal">取消</button>
  </form>
</div>
    </div>

</template>

<script>
import { api as axios } from '../auth';

export default {
    name: 'adminbooks',
    props: {
        msg: String
    },
    data() {
        return {
            searchQuery: '',
            books: [],
            navItems: [
                { label: '图书', icon: require('../assets/nav1.png'), route: '/adminbooks' },
                { label: '人员', icon: require('../assets/nav2.png'), route: '/adminpeople' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/adminrecords2' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/admin' }
            ],showModal: false,
            newBook: {
            title: '',
            barcode: '',
            total: 0
        }

        };
    },
    computed: {
        filteredBooks() {
            if (!this.searchQuery) return this.books;
            return this.books.filter(book => {
                const title = book.书名 || '';
                const idStr = String(book.id);
                return title.includes(this.searchQuery) || idStr.includes(this.searchQuery);
            });
        }
    },
    methods: {
        getCoverImage(id) {
    // 根据书籍ID返回封面图片
    switch (id) {
    case 1: return require('../assets/book1.jpg');
    case 2: return require('../assets/book2.jpg');
    case 3: return require('../assets/book3.jpg');
    case 4: return require('../assets/book4.jpg');
    case 5: return require('../assets/book4.jpg');
    case 6: return require('../assets/book4.jpg');
    case 7: return require('../assets/book4.jpg');
    case 8: return require('../assets/book4.jpg');
    case 9: return require('../assets/book4.jpg');
    case 10: return require('../assets/book4.jpg');
    case 11: return require('../assets/book4.jpg');
    case 12: return require('../assets/book4.jpg');
    case 13: return require('../assets/book4.jpg');
    case 14: return require('../assets/book4.jpg');
    case 15: return require('../assets/book4.jpg');
    case 16: return require('../assets/book4.jpg');
    case 17: return require('../assets/book4.jpg');
}
        },
        addNewBook() {
    // 将新图书信息添加到后端，并更新前端数组
    axios.post('/addBook', {
        title: this.newBook.title,
        ...(this.newBook.barcode ? { barcode: this.newBook.barcode } : {}),
        total: this.newBook.total
    })
    .then(response => {
        if (response.data.success) {
            // 将新书籍信息添加到books数组中
            this.books.push(response.data.data);
            // 重置新图书信息对象
            this.newBook = {
                title: '',
                barcode: '',
                total: 0
            };
            // 关闭模态框
            this.toggleModal();
        } else {
            // 处理添加失败的情况
            console.error('添加书籍失败:', response.data.message);
        }
    })
    .catch(error => {
        alert(error.response?.data?.message || '添加失败');
    });
},

        navigate(route) {
            this.$router.push(route);
        },
        saveBook(book) {
            axios.post('/saveBook', { id: book.id, title: book.书名, total: book.总数, barcode: book.barcode })
              .then(response => {
                    console.log('保存书籍成功:', response.data);
                    Object.assign(book, response.data.data);
                    book.isEditing = false;
                })
              .catch(error => {
                    alert(error.response?.data?.message || '保存失败');
                });
        },
        toggleModal() {
            this.showModal =!this.showModal;
        },
        modifyBook(book) {
            // 切换到编辑状态
            book.isEditing = true;
            console.log('Modifying book:', book);
        },
        deleteBook(book) {
    axios.post('/deleteBook', { id: book.id })
      .then(response => {
          if (response.data.success) {
              // 从数组中移除书籍
              const index = this.books.findIndex(b => b.id === book.id);
              if (index > -1) {
                  this.books.splice(index, 1);
              }
          } else {
              console.error('删除书籍失败:', response.data.message);
          }
      })
      .catch(error => {
          alert(error.response?.data?.message || '下架失败');
      });
},

        async queryBooks() {
            try {
                const response = await axios.get('/books');
                this.books = response.data.filter(book => !book.archived).map(book => ({
                  ...book,
                    isEditing: false
                }));
            } catch (error) {
                console.error('查询图书信息失败:', error);
            }
        }
    },

    mounted() {
        this.queryBooks();
    }
};
</script>

<style scoped>
.code-link { display: block; max-width: 480px; margin: 0 auto 90px; text-align: center; }
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
.search-bar{margin-top: 15px;
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
    height: 150px;
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
.add-book-button {
    position: fixed;
top: 85%;
left: 50%;
width: 50px;
height: 50px;
border-radius: 50%;
background-color: transparent;
border: none;
cursor: pointer;
transform: translate(-50%, -50%);
}
.add-book-button img {
  position: relative;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.modal {
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background-color: rgba(0, 0, 0, 0.5);
display: flex;
justify-content: center;
align-items: center;
}
.modal-content {
background-color: #fff;
padding: 20px;
border-radius: 5px;
width: 230px;
}
button:first-child {
  margin-right: 10px; /* 修改按钮添加右外边距 */
}
button:last-child {
  margin-left: 20px; /* 删除按钮添加左外边距 */
}

</style>
