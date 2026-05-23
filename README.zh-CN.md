# 🌌 Memory Nebula

> 基于 [blackboxo/christmas-tree](https://github.com/blackboxo/christmas-tree) 的大规模改造参考版本

**Language:** [English](./README.en.md) | [中文](./README.zh-CN.md)

---

## 目录

- [项目简介](#项目简介)
- [来源声明 / 授权状态](#来源声明--授权状态)
- [功能特性](#功能特性)
- [相比上游的主要变化](#相比上游的主要变化)
- [快速开始](#快速开始)
- [构建部署](#构建部署)
- [使用方式](#使用方式)
- [手势说明](#手势说明)
- [鼠标与键盘操作](#鼠标与键盘操作)
- [时间流模式](#时间流模式)
- [数据保存说明](#数据保存说明)
- [目录结构](#目录结构)
- [文档](#文档)
- [常用命令](#常用命令)
- [常见问题](#常见问题)
- [隐私说明](#隐私说明)
- [致谢](#致谢)
- [授权与版权说明](#授权与版权说明)

---

## 项目简介

Memory Nebula 是一个基于 **React + Three.js + MediaPipe** 的 3D 互动回忆空间。用户可以上传照片与回忆文字，将它们组织成可探索的记忆星云；通过手势可以展开星云、选中照片、进入时间流，并按时间顺序浏览回忆。

项目适合作为纪念日、情侣回忆、旅行记录、家庭相册等互动展示页面。

---

## 来源声明 / 授权状态

本仓库是基于以下项目的**大规模改造版本**：

https://github.com/blackboxo/christmas-tree

**在创建本 fork 时，原上游仓库没有包含明确的开源许可证文件。**

- 本仓库公开的目的主要是**保留开发历史、记录本人修改内容，并提供部署和参考材料**。
- 原项目相关代码版权归原作者所有。
- **本仓库不代表对原项目进行重新授权。**
- 本仓库不声称采用 MIT、Apache、GPL 或其他开源许可证。

---

## 功能特性

- 🌌 **记忆星云**：照片、星尘、恒星系统组成可探索的 3D 星云空间
- 🖐️ **手势交互**：支持握拳、张手、移动手掌、捏合、左右挥手、双手展开/合拢
- 📸 **拍立得照片**：照片以拍立得卡片形式漂浮在星云中
- 📝 **回忆详情**：每张照片可保存标题、日期、地点、描述和故事
- 🌊 **时间流模式**：按日期将回忆重排为时间长河
- 🧭 **首次手势教学**：首次打开会引导用户练习主要手势
- 💾 **本地持久化**：照片和回忆信息保存在浏览器 IndexedDB 中
- 📤 **导入/导出**：支持 JSON 备份与恢复本地回忆数据

---

## 相比上游的主要变化

详细变化请见 [CHANGES.md](./CHANGES.md)。

主要变化包括：

- **项目重构**：从圣诞树展示页重构为记忆星云互动空间
- **UI 完全重设计**：全新的视觉主题（深空星云风格）和 UI 界面
- **交互逻辑重写**：从简单 3D 展示变为完整的手势驱动交互体验
- **新增照片管理**：支持上传、编辑、删除、导入/导出照片和回忆
- **新增 MediaPipe 手势识别**：集成摄像头手势控制
- **新增时间流模式**：按时间顺序浏览回忆
- **新增数据持久化**：使用 IndexedDB 存储照片和回忆
- **新增云共享选项**：可选 Cloudflare R2/KV 分享功能
- **构建方式调整**：从简单 HTML 转为 Vite + React + TypeScript 构建
- **部署方式变化**：支持 Vercel 部署和 Serverless Functions
- **文档补充**：新增架构、手势、存储、部署、云共享等文档

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. 安装依赖

建议使用 Node.js 20+。

```bash
npm install
```

### 3. 启动开发环境

```bash
npm run dev
```

默认访问：

```bash
http://localhost:3010
```

打开网页后，请允许浏览器访问摄像头，以启用手势识别。

首次运行时，`npm install` 会自动通过 `postinstall` 脚本下载 MediaPipe 手势模型（`hand_landmarker.task`）。如果自动下载失败，可以手动运行：

```bash
npm run download-model
```

---

## 构建部署

### 构建生产版本

```bash
npm run build
```

构建产物会生成在：

```bash
dist/
```

### 本地预览构建结果

```bash
npm run preview
```

### 部署

可以将 `dist/` 部署到任意静态网站服务，例如：

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Nginx 静态站点

---

## 使用方式

### 1. 首次进入

首次打开网站会出现手势教学，引导用户练习：

1. 伸出一只手
2. 握拳
3. 张开手掌
4. 张开手掌画圈
5. 捏合拇指和食指
6. 双手展开
7. 左右挥手
8. 双手合拢

可以勾选 **不再提醒**，之后再次打开不会自动显示教学。
也可以在页面中点击 **手势教学** 重新打开。

---

### 2. 管理回忆

点击 **管理回忆**，可以：

- 上传照片
- 填写标题、日期、地点、描述和故事
- 编辑已有回忆
- 删除单条回忆
- 批量删除
- 导出 JSON 备份
- 导入 JSON 恢复数据

照片和信息会保存在当前浏览器的 IndexedDB 中。

> 注意：数据只保存在当前浏览器。清除浏览器数据、更换浏览器或更换设备后，数据不会自动同步。建议定期导出 JSON 备份。

---

## 手势说明

### 星云模式

| 手势 | 作用 |
|------|------|
| 握拳 | 收拢星云核心；打开照片详情时用于关闭详情 |
| 张开手掌 | 展开记忆星云 |
| 张开手掌移动 / 画圈 | 环绕探索星云视角 |
| 捏合拇指和食指 | 打开当前选中的照片 |
| 双手向两侧展开 | 进入时间流模式 |

### 时间流模式

| 手势 | 作用 |
|------|------|
| 左扫 / 右扫 | 切换上一段 / 下一段回忆 |
| 捏合拇指和食指 | 打开当前焦点照片 |
| 握拳 | 打开照片详情时关闭详情 |
| 双手向中间合拢 | 退出时间流，回到星云 |

---

## 鼠标与键盘操作

即使不使用手势，也可以用鼠标和键盘操作：

| 操作 | 作用 |
|------|------|
| 鼠标拖拽 | 旋转视角 |
| 鼠标滚轮 | 缩放 / 时间流中切换照片 |
| 点击照片 | 打开回忆详情 |
| Esc | 关闭弹窗 / 退出时间流 |
| ← / → 或 A / D | 时间流中切换照片 |

---

## 时间流模式

在星云展开后，可以点击 **进入时间流**，或使用双手展开手势。

时间流会将所有回忆按照日期排序：

- 当前照片位于中央
- 前后照片沿时间流排列
- 可用左右键、滚轮、按钮或左右挥手切换
- 可点击或捏合打开当前照片详情
- 可点击 **回到星云** 或双手合拢返回星云模式

---

## 数据保存说明

本项目默认使用浏览器本地存储：

| 数据 | 保存位置 |
|------|----------|
| 照片与回忆信息 | IndexedDB |
| 是否隐藏手势教学 | localStorage |

本地数据不会上传服务器。
如需迁移数据，请使用 **导出 JSON** 和 **导入 JSON** 功能。

---

## 目录结构

```
├── App.tsx                  # 应用状态和编排
├── index.html               # Vite HTML 入口
├── index.tsx                # React 入口
├── types.ts                 # 共享类型定义
├── vite.config.ts           # Vite 构建配置
├── vercel.json              # Vercel 部署配置
├── tsconfig.json            # TypeScript 配置
├── components/
│   ├── Experience.tsx       # 3D 场景入口
│   ├── Polaroids.tsx        # 拍立得照片卡片
│   ├── Foliage.tsx          # 星云尘埃粒子系统（历史命名）
│   ├── Ornaments.tsx        # 星体粒子系统（历史命名）
│   ├── ChronoStreamRibbon.tsx  # 时间流丝带装饰
│   ├── GestureController.tsx   # 手势识别控制
│   ├── GestureOnboarding.tsx   # 手势教学引导
│   ├── GestureDemo.tsx      # 手势演示动画
│   ├── MemoryManager.tsx    # 回忆管理面板
│   ├── MemoryModal.tsx      # 回忆详情弹窗
│   └── UIOverlay.tsx        # 页面 UI 覆盖层
├── utils/
│   ├── nebulaLayout.ts      # 星云聚合布局算法
│   ├── constellationLayout.ts # 星云展开布局算法
│   ├── chronoStreamLayout.ts  # 时间流布局算法
│   ├── memorySort.ts        # 回忆排序工具
│   ├── memoryShuffle.ts     # 星云模式随机排序
│   └── imageUtils.ts        # 图片压缩和转换
├── storage/
│   └── memoryLibraryStore.ts # IndexedDB CRUD
├── api/                     # Vercel Serverless Functions（可选）
├── data/
│   └── memories.ts          # 示例/默认回忆数据
├── docs/
│   ├── architecture.md
│   ├── gestures.md
│   ├── storage.md
│   ├── deployment.md
│   └── cloud-sharing.md
├── public/
│   ├── models/              # MediaPipe 手势模型
│   └── photos/              # 本地照片存储（空）
└── scripts/
    ├── download-model.js
    ├── download-model.sh
    └── download-model.bat
```

---

## 文档

- [Architecture](./docs/architecture.md) — 代码结构和组件概览
- [Gesture System](./docs/gestures.md) — 所有手势控制和检测详情
- [Storage](./docs/storage.md) — IndexedDB 和 localStorage 实现
- [Deployment](./docs/deployment.md) — 构建、预览和部署说明
- [Cloud Sharing](./docs/cloud-sharing.md) — 可选 R2/KV 共享设置

---

## 常用命令

```bash
# 启动开发环境
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

---

## 常见问题

### 摄像头没有反应

请确认：

1. 浏览器已允许摄像头权限
2. 当前页面使用 `localhost` 或 HTTPS
3. 没有其他程序占用摄像头
4. 刷新页面后重新授权

### 手势识别不稳定

建议：

1. 保持手在摄像头画面中央
2. 避免背景过暗或过亮
3. 做动作时稍微放慢
4. 先完成手势教学再进入主体验

### 刷新后照片还在吗？

同一浏览器中会保留。
如果清除网站数据、换浏览器或换设备，数据不会自动同步。请使用 JSON 导出备份。

---

## 隐私说明

本项目默认在浏览器本地运行，数据保存在 IndexedDB 和 localStorage。

---

## 致谢

- 感谢 [blackboxo](https://github.com/blackboxo) 的 [Christmas Tree](https://github.com/blackboxo/christmas-tree) 项目，为本项目提供了最初的 3D 场景基础。
- [MediaPipe](https://mediapipe.dev) — 手势识别框架
- [Three.js](https://threejs.org) — 3D 渲染引擎
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — React 3D 渲染库
- [Vite](https://vitejs.dev) — 构建工具

---

## 授权与版权说明

- 本仓库是基于 [blackboxo/christmas-tree](https://github.com/blackboxo/christmas-tree) 的大规模改造 fork。
- 在创建本 fork 时，原上游仓库没有包含明确的开源许可证文件。
- 原项目相关代码版权归原作者所有。
- 本仓库修改和新增部分的代码仅用于公开展示和参考目的。
- **本仓库不代表对原项目进行重新授权，也不声称采用任何开源许可证。**
