<template>
    <div class="header">
        <div class="search-bar">
            <input type="text" v-model="searchQuery" placeholder="请输入要查询的人员姓名" />
            <button @click="queryBooks">查询</button>
        </div>
    </div>

    <div class="main-content people-content">
        <div class="tab-buttons">
            <button @click="selectedTab = 'admin'" :class="{ active: selectedTab === 'admin' }">管理人员信息</button>
            <button @click="selectedTab = 'user'" :class="{ active: selectedTab === 'user' }">借阅人员信息</button>
        </div>
        <div v-if="selectedTab === 'admin'" class="people-grid">
            <div class="person-item" v-for="person in filteredAdminPeople" :key="person.id">
                <div class="person-info">
                    <img src="../assets/panda.png" class="person-photo" alt="管理员熊猫头像">
                    <div class="person-details">
                        <p>姓名: <span v-if="!person.editing">{{ person.真实姓名 }}</span>
                            <input v-if="person.editing" v-model="person.真实姓名" placeholder="请输入姓名" />
                        </p>
                        <p>用户名: <span v-if="!person.editing">{{ person.用户名 }}</span>
                            <input v-if="person.editing" v-model="person.用户名" placeholder="请输入用户名" />
                        </p>
                        <p>联系方式: <span v-if="!person.editing">{{ person.电话 }}</span>
                            <input v-if="person.editing" v-model="person.电话" placeholder="请输入联系方式" />
                        </p>
                        <p>角色: <span>{{ person.角色 }}</span></p>
                    </div>
                </div>
                <div class="action-buttons">
                    <button v-if="!person.editing" @click="modifyPerson(person)">修改</button>
                    <button v-if="person.editing" @click="savePerson(person)">保存</button>
                </div>
            </div>
        </div>
        <div v-else class="people-grid">
            <div class="person-item" v-for="person in filteredUserPeople" :key="person.id">
                <div class="person-info">
                    <img src="../assets/cat.png" class="person-photo" alt="借阅者小猫头像">
                    <div class="person-details">
                        <p>姓名: <span v-if="!person.editing">{{ person.真实姓名 }}</span>
                            <input v-if="person.editing" v-model="person.真实姓名" placeholder="请输入姓名" />
                        </p>
                        <p>用户名: <span v-if="!person.editing">{{ person.用户名 }}</span>
                            <input v-if="person.editing" v-model="person.用户名" placeholder="请输入用户名" />
                        </p>
                        <p>联系方式: <span v-if="!person.editing">{{ person.电话 }}</span>
                            <input v-if="person.editing" v-model="person.电话" placeholder="请输入联系方式" />
                        </p>
                        <p>角色: <span>{{ person.角色 }}</span></p>
                    </div>
                </div>
                <div class="action-buttons">
                    <button v-if="!person.editing" @click="modifyPerson(person)">修改</button>
                    <button v-if="person.editing" @click="savePerson(person)">保存</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { api as axios } from '../auth';
export default {
    name: 'adminpeople',
    props: {
        msg: String
    },
    data() {
        return {
            searchQuery: '',
            selectedTab: 'admin',
            navItems: [
                { label: '图书', icon: require('../assets/nav1.png'), route: '/adminbooks' },
                { label: '人员', icon: require('../assets/nav2.png'), route: '/adminpeople' },
                { label: '记录', icon: require('../assets/nav3.png'), route: '/adminrecords2' },
                { label: '我的', icon: require('../assets/nav4.png'), route: '/admin' }
            ],
            adminPeople: [],
            userPeople: []
        };
    },
    computed: {
        filteredAdminPeople() {
            const query = this.searchQuery.toLowerCase();
            if (!query) return this.adminPeople;
            return this.adminPeople.filter(person => {
                const name = String(person.真实姓名 || '').toLowerCase();
                const username = String(person.用户名 || '').toLowerCase();
                return name.includes(query) || username.includes(query);
            });
        },
        filteredUserPeople() {
            const query = this.searchQuery.toLowerCase();
            if (!query) return this.userPeople;
            return this.userPeople.filter(person => {
                const name = String(person.真实姓名 || '').toLowerCase();
                const username = String(person.用户名 || '').toLowerCase();
                return name.includes(query) || username.includes(query);
            });
        }
    },
    methods: {
        navigate(route) {
            this.$router.push(route);
        },
        async fetchPeople() {
            try {
                const adminResponse = await axios.get('/getAdminPeople');
                this.adminPeople = adminResponse.data;
                const userResponse = await axios.get('/getUserPeople');
                this.userPeople = userResponse.data;
            } catch (error) {
                console.error('获取人员信息失败:', error);
            }
        },
        modifyPerson(person) {
            person.editing = true;
        },
        async savePerson(person) {
            person.editing = false;
            person.photo = person.newPhoto;
            const updateData = {
                id: person.id,
                真实姓名: person.真实姓名,
                用户名: person.用户名,
                电话: person.电话,
                角色: person.角色
            };
            try {
                const response = await axios.put('/updatePerson', updateData);
                console.log('用户信息更新成功，响应数据:', response.data);
                if (this.selectedTab === 'admin') {
                    const index = this.adminPeople.findIndex(p => p.id === person.id);
                    if (index!== -1) {
                        this.adminPeople[index] = {...this.adminPeople[index],...updateData };
                    }
                } else {
                    const index = this.userPeople.findIndex(p => p.id === person.id);
                    if (index!== -1) {
                        this.userPeople[index] = {...this.userPeople[index],...updateData };
                    }
                }
            } catch (error) {
                console.error('保存人员信息失败:', error);
            }
        },

        queryBooks() {
            // 这里如果 queryBooks 有实际功能，可以在这里实现
            console.log('执行查询操作');
        }
    },
    mounted() {
        this.fetchPeople();
    }
};
</script>

<style scoped>
.header {
    background-image: url('../assets/header.png');
    width: 100%;
    height: 55px;
    background-size: contain;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
}
.nav {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 380px;
    background-image: url('../assets/nav.jpg');
    height: 55px;
    background-size: contain;
    display: flex;
    justify-content: space-around;
    padding: 10px;
    z-index: 1000;
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
.main-content {
    margin-top: 65px;
    padding: 10px;
}
.tab-buttons {
    display: flex;
    justify-content: space-around;
    margin-bottom: 10px;
}
.tab-buttons button {
    padding: 5px 10px;
    border: none;
    cursor: pointer;
}
.tab-buttons button.active {
    background-color: #ccc;
}
.person-item {
    margin-bottom: 10px;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 8px;
    background-color: #f9f9f9;
}
.person-info {
    display: flex;
    flex-direction: row; /* 使头像和信息在同一行 */
    justify-content: space-between; /* 使头像和信息分别靠两端 */
    align-items: center;
    margin-bottom: 10px;
    margin-left: 20px;
    margin-right: 20px;
}
.person-photo {
    width: 80px;
    height: 80px;

    margin-right: 10px; /* 头像右侧留出间距 */
}
.person-details {
    text-align: right; /* 使文本内容靠右对齐 */
}
.person-details p {
    margin: 5px 0;
}
.action-buttons {
    display: flex;
    justify-content: flex-end; /* 使按钮靠右对齐 */
    gap: 10px;
}
.action-buttons button {
    padding: 5px 10px;
    border: none;
    cursor: pointer;
}

.search-bar{margin-top: 15px;
}
</style>
