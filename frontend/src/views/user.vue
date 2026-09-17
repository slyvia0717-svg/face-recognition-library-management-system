<template>
  <section class="profile-page">
    <div class="profile-card">
      <div class="profile-top"><div class="profile-avatar"><img src="../assets/cat.png" alt="小猫头像"></div><div><span class="role-badge">借阅者</span><h2>{{ user?.用户名 }}</h2><p>欢迎回来，今天也读点好书。</p></div></div>
      <div class="profile-fields">
        <div v-for="field in [{ key: 'nickname', label: '用户昵称', value: user?.用户名 }, { key: 'name', label: '真实姓名', value: user?.真实姓名 }, { key: 'contact', label: '联系电话', value: user?.电话 }]" :key="field.key" class="profile-field">
          <span>{{ field.label }}</span><strong>{{ field.value || '未填写' }}</strong><button type="button" class="edit-profile" @click="openEditor(field.key)" :aria-label="'修改' + ({ nickname: '昵称', name: '姓名', contact: '电话' }[field.key])"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6z M14 5l5 5" /></svg></button>
        </div>
      </div>
    </div>
    <div class="shortcut-grid"><router-link to="/borrow"><span>01 / 阅读</span><h3>发现与借阅 →</h3><p>找到下一本想读的好书</p></router-link><router-link to="/userrecords"><span>02 / 记录</span><h3>我的借阅记录 →</h3><p>查看你的阅读足迹</p></router-link><router-link to="/faceSettings"><span>03 / 账号</span><h3>人脸识别设置 →</h3><p>录入本人，设置便捷登录</p></router-link></div>
  </section>
    <el-dialog v-model="editing" :title="'修改' + editLabel" width="min(90vw, 420px)"
        :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
        <form @submit.prevent="saveProfile">
            <label for="profile-value">{{ editLabel }}</label>
            <el-input id="profile-value" v-model="editValue" :maxlength="editLimit" :disabled="saving"
                :type="editField === 'contact' ? 'tel' : 'text'" autofocus />
            <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
            <p v-if="editField === 'nickname'" class="edit-hint">修改后请使用新昵称登录，借阅记录会保留。</p>
            <div class="edit-actions">
                <el-button :disabled="saving" @click="editing = false">取消</el-button>
                <el-button type="primary" native-type="submit" :loading="saving">保存</el-button>
            </div>
        </form>
    </el-dialog>
</template>
<script>
import { currentUser, api } from '../auth';
export default {
    name: 'user',
    computed: {
        user() { return currentUser.value; },
        editLabel() { return { nickname: '用户昵称', name: '真实姓名', contact: '联系电话' }[this.editField] || ''; },
        editLimit() { return { nickname: 64, name: 100, contact: 32 }[this.editField] || 64; }
    },
    props: {
        msg: String
    },
    data() {
        return {
            showModal: false,
            editing: false,
            editField: '',
            editValue: '',
            editError: '',
            saving: false,
            navItems: [
                { label: '借书', icon: require('../assets/nav5.png'), route: '/borrow' },
                { label: '还书', icon: require('../assets/nav6.png'), route: '/return' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/userrecords' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/user' }
            ]
        };
    },
    methods: {
        openEditor(field) {
            this.editField = field;
            const column = { nickname: '用户名', name: '真实姓名', contact: '电话' }[field];
            this.editValue = this.user?.[column] || '';
            this.editError = '';
            this.editing = true;
        },
        async saveProfile() {
            if (this.saving) return;
            const value = this.editValue.trim();
            if (!value) { this.editError = '请填写' + this.editLabel; return; }
            if (value.length > this.editLimit) { this.editError = '内容过长'; return; }
            if (this.editField === 'contact' && !/^[+0-9 ()-]{3,32}$/.test(value)) {
                this.editError = '电话须为 3–32 位数字，可包含 +、空格、括号和短横线'; return;
            }
            this.saving = true;
            this.editError = '';
            try {
                const { data } = await api.patch('/me', { [this.editField]: value });
                currentUser.value = data.user;
                this.editing = false;
                this.$message.success('个人信息已更新');
            } catch (err) {
                this.editError = err.response?.data?.message || '保存失败，请稍后再试';
            } finally { this.saving = false; }
        },
        takePhoto() {
            console.log("执行拍照操作");
            this.closeModal();
        },
        chooseFromAlbum() {
            console.log('执行从相册选择操作');
            this.closeModal();
        },
        closeModal() {
            this.showModal = false;
        },
        navigate(route) {
            this.$router.push(route);
        }
    }
};
</script>
