<template>
    <div class="header">
        <div class="search-bar">
            <input v-model="searchQuery" placeholder="输入书名或图书编号" aria-label="查询图书" />
            <button @click="queryBooks">查询</button>
        </div>
    </div>
    <div class="main-content">
        <div class="scan-tools">
            <button @click="showCamera()">扫码借书</button>
            <router-link to="/bookCodes">查看测试二维码</router-link>
        </div>
        <p v-if="listError" role="alert">{{ listError }}</p>
        <div v-for="book in filteredBooks" :key="book.id" class="book-item">
            <div class="book-cover" :style="{ backgroundImage: 'url(' + getCoverImage(book.id) + ')' }"></div>
            <div class="book-info">
                <p>{{ book.书名 }}</p>
                <p>图书编号：{{ book.barcode }}</p>
                <p class="stock-line"><span :class="book.库存 > 0 ? 'stock-available' : 'stock-empty'">{{ book.库存 > 0 ? '可借阅' : '暂无库存' }}</span> {{ book.库存 }} / {{ book.总数 }}</p>
                <button @click="showCamera(book)">扫描此书借阅</button>
            </div>
        </div>
        <p v-if="!filteredBooks.length && !listError" class="empty-state">没有找到匹配的图书，试试其他书名或编号。</p>
    </div>

    <el-dialog v-model="showingCamera" title="扫码借书" width="min(94vw, 460px)"
        :close-on-click-modal="!borrowing" :close-on-press-escape="!borrowing"
        :show-close="!borrowing" @closed="closeCamera">
        <p v-if="expectedBook">请扫描《{{ expectedBook.书名 }}》的条形码或二维码。</p>
        <p v-else>将图书条形码或二维码放入摄像头画面，识别后确认借阅。</p>
        <div v-if="showingCamera && !matchedBook && !cameraFailed" class="camera-view">
            <qrcode-stream :key="cameraVersion" :formats="formats" :paused="lookingUp"
                :constraints="{ facingMode: 'environment' }" @detect="onDetect" @error="onCameraError" />
        </div>
        <p v-if="lookingUp" role="status">正在查找图书…</p>
        <p v-if="scanError" class="scan-error" role="alert">{{ scanError }}</p>
        <form v-if="!matchedBook" class="manual-lookup" @submit.prevent="lookupCode(manualCode)">
            <label for="manual-code">也可手动输入图书编号</label>
            <el-input id="manual-code" v-model="manualCode" maxlength="64" :disabled="lookingUp || borrowing" />
            <el-button native-type="submit" :disabled="lookingUp || borrowing || !manualCode.trim()">查找图书</el-button>
        </form>
        <div v-if="matchedBook" class="matched-book">
            <h3>{{ matchedBook.书名 }}</h3>
            <p>图书编号：{{ matchedBook.barcode }}</p>
            <p>可借库存：{{ matchedBook.库存 }}</p>
            <p v-if="matchedBook.库存 === 0" class="scan-error">暂无库存，无法借阅。</p>
        </div>
        <div class="scan-actions">
            <el-button :disabled="borrowing || lookingUp" @click="resetScan">重新扫描</el-button>
            <el-button :disabled="borrowing" @click="showingCamera = false">关闭</el-button>
            <el-button v-if="matchedBook" type="primary" :loading="borrowing" :disabled="matchedBook.库存 <= 0" @click="borrowBook">确认借阅</el-button>
        </div>
    </el-dialog>
</template>
<script>
import { currentUser, api } from '../auth';
import { pendingBorrowKey } from '../borrowRequest';
import { QrcodeStream } from 'vue-qrcode-reader';
import { scanFormats, uniqueCodes } from '../scanner';
export default {
    name: 'borrow',
    components: { QrcodeStream },
    data() {
        return {
            searchQuery: '', books: [], listError: '', formats: scanFormats,
            showingCamera: false, expectedBook: null, matchedBook: null, manualCode: '',
            scanError: '', lookingUp: false, borrowing: false, cameraFailed: false,
            cameraVersion: 0, lookupVersion: 0,
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
            return this.books.filter(book => book.书名.includes(this.searchQuery) || book.barcode.includes(this.searchQuery));
        }
    },
    beforeUnmount() { this.lookupVersion++; },
    methods: {
        navigate(route) { this.$router.push(route); },
        showCamera(book = null) {
            this.expectedBook = book;
            this.resetScan();
            this.showingCamera = true;
        },
        closeCamera() {
            this.lookupVersion++; this.lookingUp = false; this.matchedBook = null;
        },
        resetScan() {
            this.lookupVersion++; this.lookingUp = false; this.matchedBook = null;
            this.manualCode = ''; this.scanError = ''; this.cameraVersion++;
            this.cameraFailed = !window.isSecureContext || !navigator.mediaDevices?.getUserMedia;
            if (this.cameraFailed) this.scanError = '摄像头需要 HTTPS 或 localhost 访问；也可手动输入编号。';
        },
        onCameraError(error) {
            this.cameraFailed = true;
            const messages = {
                NotAllowedError: '摄像头权限被拒绝，请允许访问后重新扫描。',
                NotFoundError: '未检测到摄像头，可手动输入编号。',
                NotReadableError: '摄像头可能被其他程序占用，请关闭占用程序后重试。',
                OverconstrainedError: '摄像头不支持当前配置，请更换设备或手动输入编号。'
            };
            this.scanError = messages[error.name] || '摄像头或解码组件初始化失败，请重新扫描，也可手动输入编号。';
        },
        onDetect(detections) {
            if (this.lookingUp || this.matchedBook || this.borrowing) return;
            const codes = uniqueCodes(detections);
            if (codes.length !== 1) { this.scanError = '请一次只扫描一个图书编号。'; return; }
            this.lookupCode(codes[0]);
        },
        async lookupCode(raw) {
            if (this.lookingUp || this.borrowing) return;
            const barcode = raw.trim();
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(barcode)) { this.scanError = '编号格式不正确，请扫描图书编号，不要扫描网址。'; return; }
            const version = ++this.lookupVersion;
            this.lookingUp = true; this.scanError = ''; this.matchedBook = null;
            try {
                const { data } = await api.get('/books/byBarcode', { params: { barcode } });
                if (version !== this.lookupVersion || !this.showingCamera) return;
                if (this.expectedBook && data.book.id !== this.expectedBook.id) {
                    this.scanError = '扫描的图书与所选图书不一致，请重新扫描。'; return;
                }
                this.matchedBook = data.book;
            } catch (err) {
                if (version === this.lookupVersion) this.scanError = err.response?.data?.message || '查询失败，请重试。';
            } finally { if (version === this.lookupVersion) this.lookingUp = false; }
        },
        async queryBooks() {
            this.listError = '';
            try { this.books = (await api.get('/books')).data.filter(book => !book.archived); }
            catch (err) { this.listError = err.response?.data?.message || '图书加载失败，请重试。'; }
        },
        async borrowBook() {
            if (!this.matchedBook || this.matchedBook.库存 <= 0 || this.borrowing || !currentUser.value) return;
            this.borrowing = true; this.scanError = '';
            let operation;
            try {
                const book = this.matchedBook;
                operation = pendingBorrowKey(currentUser.value.id, book.id, book.barcode);
                const { data } = await api.post('/borrowBook', { bookId: book.id, barcode: operation.barcode, requestId: operation.requestId });
                operation.clear(); this.showingCamera = false;
                this.$message.success(data.message);
                await this.queryBooks();
            } catch (err) {
                if (err.response?.status >= 400 && err.response?.status < 500) {
                    operation?.clear();
                    if ([404,409].includes(err.response.status)) this.matchedBook = null;
                }
                this.scanError = err.response?.data?.message || '借阅结果未确认，请再次确认借阅，不会重复扣库存。';
            } finally { this.borrowing = false; }
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
                default: return require('../assets/book13.jpg');
            }
        }
    },
    mounted() { this.queryBooks(); }
};
</script>
<style scoped>
.header {
    background-image: url('../assets/header.png');
    width: 100%;
    max-width: 480px;
    height: 55px;
    background-size: cover;
    background-position: center;
    position: sticky;
    top: 0;
    z-index: 1000;
    margin: 0 auto;
}

.main-content {
    width: 100%;
    max-width: 480px;
    margin: 12px auto 72px;
    padding: 10px 12px 0;
}

.nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    background-image: url('../assets/nav.jpg');
    background-size: cover;
    background-position: center;
    height: 55px;
    display: flex;
    justify-content: space-around;
    padding: 10px;
    z-index: 1000;
}

.book-item {
    display: flex;
    margin-bottom: 10px;
    padding: 10px;
    background-color: #f9f9f9;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.book-cover {
    width: 100px;
    height: 140px;
    margin: 15px 10px 0 5px;
    background-size: cover;
    background-position: center;
    border-radius: 6px;
}

.book-info {
    flex: 1;
    border: 1px solid #ddd;
    padding: 10px;
    border-radius: 8px;
    background-color: #fff;
}

.book-info p {
    margin: 10px 0;
}

.nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex: 1;
}

.nav-icon {
    width: 30px;
    height: 30px;
}

.search-bar {
    width: 100%;
    max-width: 480px;
    margin: 14px auto 0;
    display: flex;
    gap: 8px;
    padding: 0 12px;
}

.search-bar input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid #ccc;
}

.search-bar button {
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #a1bcd9;
    color: #fff;
}


.scan-tools { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.camera-view { height: 260px; width: 100%; overflow: hidden; border-radius: 8px; }
.scan-error { color: #b42318; }
.manual-lookup { display: grid; gap: 8px; margin: 18px 0; }
.scan-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.matched-book { padding: 12px; background: #f0f7ff; border-radius: 8px; }
</style>
