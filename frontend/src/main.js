import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './styles/theme.css';
import './styles/classical.css';


// 创建 Vue 应用实例并使用 ElementPlus 和路由
const app = createApp(App);
app.use(router);
app.use(ElementPlus);
app.mount('#app');
