<template>
  <section class="profile-page">
    <div class="profile-card"><div class="profile-top"><div class="profile-avatar"><img src="../assets/panda2.png" alt="熊猫头像"></div><div><span class="role-badge">管理员</span><h2>{{ user?.用户名 }}</h2><p>让图书馆的每一天有序运行。</p></div></div><div class="profile-fields"><div class="profile-field"><span>真实姓名</span><strong>{{ user?.真实姓名 || '未填写' }}</strong></div><div class="profile-field"><span>联系电话</span><strong>{{ user?.电话 || '未填写' }}</strong></div></div></div>
    <div class="shortcut-grid"><router-link to="/adminbooks"><span>01 / 馆藏</span><h3>管理图书 →</h3><p>维护书目与库存</p></router-link><router-link to="/adminpeople"><span>02 / 账号</span><h3>管理人员 →</h3><p>维护人员信息与角色</p></router-link><router-link to="/adminrecords2"><span>03 / 借阅</span><h3>借阅记录 →</h3><p>查看与核对借还记录</p></router-link><router-link to="/faceSettings"><span>04 / 安全</span><h3>人脸识别设置 →</h3><p>录入本人，设置便捷登录</p></router-link></div>
  </section>
</template>
<script setup>
import { currentUser as user } from '../auth';
</script>
