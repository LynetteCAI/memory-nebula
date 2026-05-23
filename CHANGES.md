# Changes from Upstream / 相比上游的主要变化

---

## English

This repository is a **heavily modified fork** of:

https://github.com/blackboxo/christmas-tree

The upstream repository did not include an explicit open-source license at the time this fork was created.

### Major changes in this fork

| # | Change | Details |
|---|--------|---------|
| 1 | **Project purpose redesigned** | Upstream: Christmas tree decorative display. This fork: interactive 3D memory nebula for personal photos and memories. |
| 2 | **Build system migrated** | Upstream: simple static HTML + vanilla JS. This fork: Vite + React 19 + TypeScript build pipeline. |
| 3 | **3D scene converted to React** | Using `@react-three/fiber` and `@react-three/drei` for declarative 3D scene management instead of imperative Three.js. |
| 4 | **New photo management system** | Added IndexedDB-based CRUD for photos and memories (`storage/memoryLibraryStore.ts`, `components/MemoryManager.tsx`). |
| 5 | **MediaPipe gesture recognition** | Added full camera-based hand gesture recognition (`components/GestureController.tsx`, ~2070 lines). Supports fist, open palm, pinch, swipe, two-hand detection. |
| 6 | **Gesture onboarding tutorial** | First-time user gesture tutorial with step-by-step guidance (`components/GestureOnboarding.tsx`, `components/GestureDemo.tsx`). |
| 7 | **Chrono Stream (time river) mode** | Memories rearranged by date into a linear time stream (`components/ChronoStreamRibbon.tsx`, `utils/chronoStreamLayout.ts`). |
| 8 | **Nebula layout algorithms** | Custom 3D layout algorithms for nebula aggregated state and constellation expanded state (`utils/nebulaLayout.ts`, `utils/constellationLayout.ts`). |
| 9 | **Memory detail modal** | Click/pinch any photo to view, edit, or delete its details (`components/MemoryModal.tsx`). |
| 10 | **UI completely redesigned** | Deep space nebula visual theme with gold/amber accents, custom typography (Cinzel, Playfair Display). Replaced Christmas-themed UI with memory nebula interface. |
| 11 | **Three distinct scene states** | `TreeMode.FORMED` (collapsed core), `TreeMode.CHAOS` (expanded constellation), `TreeMode.CHRONO_STREAM` (time river). |
| 12 | **Optional cloud sharing** | Vercel Serverless Functions for Cloudflare R2 photo upload and KV share link generation (`api/` directory). |
| 13 | **Sample memory data** | Added sample/default memory data for demo purposes (`data/memories.ts`). |
| 14 | **Documentation expanded** | Added architecture, gesture system, storage, deployment, and cloud sharing docs (`docs/` directory). |
| 15 | **Deployment configuration** | Added Vercel deployment configuration (`vercel.json`), Vite config, and environment variable template (`env.example`). |
| 16 | **TypeScript migration** | Upstream used plain JavaScript. This fork is fully TypeScript with shared type definitions (`types.ts`). |
| 17 | **Removed Christmas theme assets** | Stripped Christmas-specific decorations, tree model, snow, and festive styling. Replaced with nebula dust, star orbs, and space-themed particles. |
| 18 | **Code structure reorganized** | Flat files restructured into `components/`, `utils/`, `storage/`, `api/`, `docs/`, `scripts/`, and `data/` directories. |

For exact implementation details, please review the Git history and source code.

---

## 中文

本仓库是基于以下项目的**大规模改造版本**：

https://github.com/blackboxo/christmas-tree

在创建本 fork 时，原上游仓库没有包含明确的开源许可证文件。

### 本 fork 的主要变化

| # | 变化 | 说明 |
|---|------|------|
| 1 | **项目用途重设计** | 上游：圣诞树装饰展示页。本 fork：交互式 3D 记忆星云，用于个人照片和回忆展示。 |
| 2 | **构建系统迁移** | 上游：简单静态 HTML + 原生 JS。本 fork：Vite + React 19 + TypeScript 构建管线。 |
| 3 | **3D 场景转为 React** | 使用 `@react-three/fiber` 和 `@react-three/drei` 进行声明式 3D 场景管理。 |
| 4 | **新增照片管理系统** | 基于 IndexedDB 的照片和回忆 CRUD（`storage/memoryLibraryStore.ts`、`components/MemoryManager.tsx`）。 |
| 5 | **MediaPipe 手势识别** | 完整的摄像头手势识别系统（`components/GestureController.tsx`，约 2070 行）。支持握拳、张手、捏合、挥手、双手检测。 |
| 6 | **手势教学引导** | 首次使用的用户手势教程，逐步引导（`components/GestureOnboarding.tsx`、`components/GestureDemo.tsx`）。 |
| 7 | **时间流模式** | 按日期将记忆重排为线性时间流（`components/ChronoStreamRibbon.tsx`、`utils/chronoStreamLayout.ts`）。 |
| 8 | **星云布局算法** | 自定义 3D 布局算法，支持星云聚合态和展开态（`utils/nebulaLayout.ts`、`utils/constellationLayout.ts`）。 |
| 9 | **回忆详情弹窗** | 点击或捏合照片可查看、编辑、删除详情（`components/MemoryModal.tsx`）。 |
| 10 | **UI 完全重设计** | 深空星云视觉主题，金色/琥珀色强调色，自定义字体（Cinzel、Playfair Display）。替换圣诞主题为记忆星云界面。 |
| 11 | **三种场景状态** | `TreeMode.FORMED`（聚合核心）、`TreeMode.CHAOS`（展开星云）、`TreeMode.CHRONO_STREAM`（时间流）。 |
| 12 | **可选云共享** | Vercel Serverless Functions 支持 Cloudflare R2 照片上传和 KV 分享链接生成（`api/` 目录）。 |
| 13 | **示例回忆数据** | 新增示例/默认回忆数据用于演示（`data/memories.ts`）。 |
| 14 | **文档大幅扩展** | 新增架构、手势系统、存储、部署、云共享文档（`docs/` 目录）。 |
| 15 | **部署配置** | 新增 Vercel 部署配置（`vercel.json`）、Vite 配置和环境变量模板（`env.example`）。 |
| 16 | **TypeScript 迁移** | 上游使用原生 JavaScript。本 fork 使用完整 TypeScript 和共享类型定义（`types.ts`）。 |
| 17 | **移除圣诞主题资源** | 移除圣诞装饰、树模型、雪花和节日样式。替换为星云尘埃、星体和太空主题粒子。 |
| 18 | **代码结构重组** | 扁平文件重组为 `components/`、`utils/`、`storage/`、`api/`、`docs/`、`scripts/`、`data/` 目录。 |

具体实现细节请参考 Git 历史和源码。
