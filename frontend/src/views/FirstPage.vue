<template>
  <main class="welcome-page">
    <div class="welcome-brand"><span class="brand-mark">阅</span><img src="../assets/logo1.png" class="original-wordmark" alt="图书管理系统"></div>
    <div class="welcome-grid">
      <section class="welcome-story">
        <p class="eyebrow">卷首 · 书香入境</p>
        <h1>一卷在手，<br>阅见<span>山河。</span></h1>
        <p class="welcome-description">在书页间寻一方天地，于墨香里遇万千世界。<br>扫码借还、人脸登录，让每一次阅读从容开启。</p>
        <div class="classical-illustration" aria-hidden="true"><img src="../assets/panda2.png" alt=""><p>书卷多情似故人<br>晨昏忧乐每相亲</p><span class="classical-seal">书香</span></div>
      </section>
      <section class="welcome-entry">
        <span class="entry-badge">自助借阅 · 从这里开始</span>
        <h2>欢迎来到图书馆</h2><p>选择你的身份，进入图书馆。</p>
        <router-link to="/login2" class="entry-choice reader-choice"><span class="choice-symbol">↗</span><span><strong>借阅者登录</strong><small>发现好书，管理你的借阅</small></span><span class="choice-arrow">→</span></router-link>
        <router-link to="/login" class="entry-choice"><span class="choice-symbol">▦</span><span><strong>管理员登录</strong><small>管理馆藏、人员与借阅记录</small></span><span class="choice-arrow">→</span></router-link>
        <div class="entry-register">第一次来？<router-link to="/registerPage">创建借阅账号 →</router-link></div>
        <div class="entry-footer"><span>扫码借还</span><span>人脸登录</span><span>阅读记录</span></div>
      </section>
    </div>
    <footer class="welcome-footer">以书会友 · 以读养心</footer>
  </main>
</template>
