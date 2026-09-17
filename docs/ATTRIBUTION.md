# 来源与第三方组件

## 原项目

当前作品基于以下原项目迭代，保留原有图书管理主题、水墨背景、书法标题及熊猫/小猫等插画素材：

https://gitee.com/liu-xinyue27/Face-Recognition-Based-Self-Service-Library-Management-System_1

本发布目录以当前可运行版本为基础建立独立历史，不包含原仓库历史中的依赖、数据库或旧课程工程。

迭代内容包括：密码与服务端会话、权限隔离、本人信息编辑、基于固定外键和事务的库存管理、真实扫码查书与借阅、人脸特征提取与加密、本人录入与删除、古典主题的响应式布局，以及隔离环境回归验证。

原项目与素材未在本目录额外指定新的整体开源许可证；第三方许可保留各自声明。

## 人脸模型与运行库

- face-api.js： https://github.com/justadudewhohacks/face-api.js
- 运行库的 MIT 许可见 `licenses/face-api.js-MIT.txt`。
- 保留 Tiny Face Detector、68 点轻量关键点模型与 FaceRecognitionNet 的 manifest 和全部分片；模型来源为原项目所附 face-api.js 权重。
- 公开测试人脸样本的路径与来源记录在 `backend/test/fixtures/faces/README.md`，对应许可文件一并保留；样本只用于临时测试，不会录入实际用户数据库。

## 条码与二维码

- vue-qrcode-reader： https://github.com/gruhn/vue-qrcode-reader
- ZXing WASM： https://github.com/Sec-ant/zxing-wasm
- 本地 WASM 的版本、来源与许可见 `frontend/public/wasm/README.txt` 和 `LICENSE`。
- qrcode： https://github.com/soldair/node-qrcode

其余 npm 组件的版本与依赖关系由前后端 `package-lock.json` 记录。
