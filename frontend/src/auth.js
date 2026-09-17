import axios from 'axios';
import { ref } from 'vue';
export const currentUser = ref(null);
export const api = axios.create({ baseURL: process.env.VUE_APP_API_URL || '/api', timeout: 15000 });
export function clearAuth() {
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('userInfo');
  currentUser.value = null;
}
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) clearAuth();
  return Promise.reject(error);
});
export async function loadUser() {
  if (!sessionStorage.getItem('authToken')) { currentUser.value = null; return null; }
  const response = await api.get('/me');
  currentUser.value = response.data.user;
  return currentUser.value;
}
export async function login(nickname, password, adminOnly = false) {
  clearAuth();
  const { data } = await api.post('/login', { nickname, password });
  return acceptLogin(data, adminOnly);
}
export async function faceLogin(nickname, image, adminOnly = false, signal) {
  clearAuth();
  const { data } = await api.post('/face/login', { nickname, image }, { timeout: 60000, signal });
  return acceptLogin(data, adminOnly);
}
async function acceptLogin(data, adminOnly) {
  sessionStorage.setItem('authToken', data.token);
  currentUser.value = data.user;
  if (adminOnly && data.user.角色 !== '管理员') {
    await logout();
    throw new Error('此账号没有管理员权限');
  }
  return data.user;
}
export async function logout() {
  try { if (sessionStorage.getItem('authToken')) await api.post('/logout'); }
  catch (err) { if (err.response?.status !== 401) throw err; }
  clearAuth();
}
