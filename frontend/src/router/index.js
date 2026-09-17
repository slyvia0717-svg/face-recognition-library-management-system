import { createRouter, createWebHashHistory } from 'vue-router'
import { loadUser } from '../auth'
import FirstPage from '@/views/FirstPage.vue'

const routes = [
  { path: '/faceSettings', name: 'faceSettings', component: () => import('../views/faceSettings.vue') },
  { path: '/bookCodes', name: 'bookCodes', component: () => import('../views/bookCodes.vue') },
    {
    path: '/',
    name: 'FirstPage',
    component: FirstPage
  },

  {
    path: '/FirstPage',
    name: 'FirstPage1',
    component: FirstPage
  },
  {
    path: '/registerPage',
    name: 'registerPage',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/registerPage.vue')
  },
  {
    path: '/login',
    name: 'login',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/login.vue')
  },

  {
    path: '/admin',
    name: 'admin',
    component: () => import(/* webpackChunkName: "about" */ '../views/admin.vue')
  },
  {
    path: '/adminbooks',
    name: 'adminbooks',
    component: () => import(/* webpackChunkName: "about" */ '../views/adminbooks.vue')
  },
  {
    path: '/adminpeople',
    name: 'adminpeople',
    component: () => import(/* webpackChunkName: "about" */ '../views/adminpeople.vue')
  },
  {
    path: '/adminrecords',
    name: 'adminrecords',
    component: () => import(/* webpackChunkName: "about" */ '../views/adminrecords.vue')
  },
  {
    path: '/user',
    name: 'user',
    component: () => import(/* webpackChunkName: "about" */ '../views/user.vue')
  },
  {
    path: '/userrecords',
    name: 'userrecords',
    component: () => import(/* webpackChunkName: "about" */ '../views/userrecords.vue')
  },
  {
    path: '/return',
    name: 'return',
    component: () => import(/* webpackChunkName: "about" */ '../views/return.vue')
  },
  {
    path: '/borrow',
    name: 'borrow',
    component: () => import(/* webpackChunkName: "about" */ '../views/borrow.vue')
  },
  {
    path: '/login2',
    name: 'login2',
    component: () => import(/* webpackChunkName: "about" */ '../views/login2.vue')
  },
  {
    path: '/adminrecords2',
    name: 'adminrecords2',
    component: () => import(/* webpackChunkName: "about" */ '../views/adminrecords2.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async to => {
  if (['/', '/FirstPage', '/login', '/login2', '/registerPage'].includes(to.path)) return true;
  const adminPage = to.path.startsWith('/admin');
  try {
    const user = await loadUser();
    if (!user) return adminPage ? '/login' : '/login2';
    if (adminPage && user.角色 !== '管理员') return '/user';
    return true;
  } catch (err) {
    if (err.response?.status === 401) return adminPage ? '/login' : '/login2';
    return false;
  }
});
export default router
