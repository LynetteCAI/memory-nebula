# 🌌 Memory Nebula

一个通过手势唤醒回忆的 3D 记忆星云。握拳时，照片、光点与记忆尘埃坍缩成一个发光星云球；张开手掌时，它们散开成可以环绕探索的记忆空间。

## 📝 版本

**v0.3.4**：Memory Library Manager — 网页端回忆管理器，支持上传、编辑、删除、批量操作、IndexedDB 持久化（当前）。

## 🛠️ 快速开始

1. **克隆仓库:**
   ```bash
   git clone <repository-url>
   cd christmas-tree
   ```

2. **安装依赖:**
   ```bash
   npm install
   ```

3. **启动开发服务器:**
   ```bash
   npm run dev
   ```
   
4. **打开浏览器:**
   - 访问 `http://localhost:3010`
   - 允许摄像头权限以启用手势控制
   - 点击"上传回忆照片"上传你的照片

## 🎯 使用指南

### 手势控制

1. **张开手掌（五指伸展）**：释放记忆，展开为记忆星云
2. **握拳**：收拢记忆，坍缩成星云球
3. **移动手掌**：控制相机视角，环绕探索星云
   - 左右：水平旋转
   - 上下：垂直倾斜

### 鼠标控制

- **拖拽**：旋转视角
- **滚轮**：缩放
- 手势未检测到时，鼠标控制完全可用

### 照片上传与分享

1. **上传回忆照片**：点击按钮选择图片（最多 22 张）
2. **生成记忆分享链接**：上传后点击生成，等待 2-3 秒
3. **分享**：复制链接发送给朋友
4. **查看分享**：朋友打开链接即可看到你的记忆星云

### 拍立得回忆详情（v0.3 新增）

1. **点击任意拍立得照片**：打开 MemoryModal，查看照片、标题、日期、地点、描述和故事
2. **关闭弹窗**：点击 X 按钮、点击背景、或按 Esc 键
3. **弹窗打开时**：手势导航暂停，避免阅读时视角乱动
4. **双手检测聚焦**：双手进入画面时会高亮最近的照片，但不自动打开详情

### 手势照片选择（v0.3.1-lite 新增）

v0.3.1-lite：**中心候选 + 捏合打开**（不需要双手锁定）。

1. **移动视角**：通过手势或鼠标旋转相机，让照片靠近屏幕中心准星。系统自动识别屏幕中心附近的照片作为候选，并显示弱金色高亮。
2. **捏合手指打开**：有候选照片时，单手捏合拇指和食指并保持约 0.3 秒，即可直接打开该照片的 MemoryModal 查看详情。没有候选照片时捏合不做任何事。
3. **Debug HUD**：摄像头预览下方显示 pinch 调试信息（candidate yes/no、pinchRatio、pinchDetected、hold time、cooldown、block reason）。后续可设置 `DEBUG_GESTURES = false` 隐藏。
4. **鼠标点击仍然可用**：hover 发光，点击打开详情。
5. **详情打开时**：手势导航和 pinch 选择都暂停。

### 手势关闭照片详情（v0.3.2 新增）

1. **握拳关闭**：MemoryModal 打开时，系统进入 Modal Gesture Mode。此时只检测一个手势：握拳。握拳保持约 600ms 即可关闭弹窗。
2. **保护期**：弹窗刚打开后有 800ms 保护时间，避免 hand 残留造成误关。
3. **弹窗打开期间不触发其他手势**：张手不会切换星云状态，pinch 不会重复打开，手掌移动不会旋转视角。
4. **关闭后恢复正常**：弹窗关闭后，张手/握拳/pinch/鼠标功能即刻恢复。
5. **Debug HUD**：弹窗打开时 HUD 显示 modal:YES、fist 状态、hold 进度、grace 剩余、cooldown 剩余、block reason。

## 🏗️ 技术栈

- React 19 + TypeScript
- React Three Fiber (R3F) 3D 渲染
- Three.js WebGL 图形
- @react-three/drei 辅助工具
- @react-three/postprocessing 视觉特效
- MediaPipe 手势检测
- Tailwind CSS 样式
- Vercel Serverless + Cloudflare R2/KV（分享）

## 🗺️ 路线图

- **v0.1** ✅ 星云球替换圣诞树
- **v0.1.1** ✅ 去除残留圣诞装饰，将 ornaments 改成小星球、水晶碎片和星尘光点
- **v0.2** ✅ Memory Constellation 记忆星云展开态
- **v0.2.1** ✅ 手势稳定化：张手/握拳触发并锁定状态
- **v0.2.2** ✅ Nebula Bodies Polish：天体化重构装饰物
- **v0.2.3** ✅ Stellar Systems Polish：多恒星行星系统
- **v0.2.4** ✅ Lighting Hierarchy Polish：光照层级优化
- **v0.2.5** ✅ Photo Volume Distribution：照片体积分布优化
- **v0.3** ✅ 拍立得照片可点击，展示时间和文字
- **v0.3.1** ✅ 中心候选 + 捏合打开照片
- **v0.3.2** ✅ 握拳保持关闭照片详情
- **v0.3.3** ✅ 展开态照片朝向相机
- **v0.3.4** ✅ Memory Library Manager（当前）
- **v0.4** 新增时间隧道模式，先用按钮进入
- **v0.5** 增加推手势进入时间隧道
- **v0.6** 加纪念日终章、信件、音乐、分享

## ✨ 功能

- 手部手势控制（摄像头）
- 动态状态转换（Memory Core ↔ Memory Constellation）
- 照片上传与云端分享
- 临时分享链接（30 天过期）
- InstancedMesh 性能优化
- Bloom 辉光后期处理
- 粒子系统（Memory Dust / Nebula Dust）
- 记忆核心（Memory Core）发光体
- 记忆星云（Memory Constellation）展开态
- 小星球、水晶碎片、星尘光点装饰
- 多恒星系统（Stellar Systems）
- 拍立得照片可点击查看详情（v0.3）
- 手势照片选择（v0.3.1）
- 回忆管理器：上传、编辑、删除、批量操作（v0.3.4）
- IndexedDB 本地持久化存储（v0.3.4）
- JSON 导入/导出备份（v0.3.4）

---

## 📚 v0.3.4 Memory Library Manager

v0.3.4 增加网页端回忆管理器。用户可以上传照片时填写标题、日期、地点、类型、描述和故事，并将这些回忆保存到浏览器 IndexedDB。下次打开同一浏览器时，回忆会自动加载，不需要重新上传。

### 数据持久化

- **本地持久化基于 IndexedDB**：数据保存在浏览器的 `memory-nebula-db` 数据库中。
- **数据只保存在当前浏览器**：换设备、换浏览器后不会自动同步。
- **清除浏览器数据会删除**：清除网站数据（Cookie、缓存等）会同时删除 IndexedDB 中的回忆。
- **导出 JSON 可用于备份**：在管理面板中可以导出所有回忆为 JSON 文件，也可以导入之前导出的备份。
- **未来可扩展到云端同步和分享**：IndexedDB 是本地的第一步，后续版本可以在此之上增加云端同步。

### 回忆管理功能

1. **上传回忆照片**：在管理面板中选择一张或多张图片。
2. **填写回忆信息**：上传后进入批量录入表单，可为每张照片填写标题、日期、地点、类型、描述和故事。支持批量设置日期、地点和类型。
3. **保存**：保存后照片立即出现在记忆星云中，同时写入 IndexedDB。
4. **编辑**：在管理面板中点击任意回忆的"编辑"按钮，修改信息后保存。
5. **删除**：可选择单条删除或勾选多条后批量删除。删除前有确认提示。
6. **导入/导出**：管理面板底部提供"导出备份"和"导入备份"功能，用于数据迁移和备份。

### 图片压缩

上传的图片会自动压缩（Canvas 缩放至 1600px 以内，JPEG quality 0.82），以减少 IndexedDB 存储压力。小图片（< 50KB JPEG）会跳过压缩直接保存。

### 技术实现

- **存储层**：`storage/memoryLibraryStore.ts`，使用 `idb` 库封装 IndexedDB CRUD 操作。
- **图片压缩**：`utils/imageUtils.ts`，Canvas 缩放 + JPEG 导出。
- **管理面板**：`components/MemoryManager.tsx`，深色玻璃拟态风格 UI。
- **数据流**：App.tsx 在页面加载时从 IndexedDB 读取所有回忆，每次 CRUD 操作先写 IndexedDB 再更新 React state。

---

---

## 🌠 v0.2 Memory Constellation

v0.2 将原本随机的 CHAOS 散开态改造成 **Memory Constellation（记忆星云）**。

张开手掌后，记忆核心不再随机炸开，而是优雅地展开为有层次、可探索的星云场：

- **粒子形成星云体**：12000 颗 Memory Dust 粒子不再随机散射，而是构成三层结构——核心残光（r 1.5–4.5）、星环带（r 4.5–8.5，含两条螺旋臂）、外层记忆云（r 7–12）
- **小星球与水晶碎片分布**：MiniPlanets 主要漂浮在星环带（r 5–9），CrystalShards 散落在中层（r 4–10），StardustLights 形成广域稀疏光尘
- **拍立得照片分为 2-3 条星座弧链**：照片按索引分为多个弧链，分别位于不同半径和高度，间距充裕，面向外侧便于环绕查看
- **所有位置均为确定性算法生成**：基于 index 的伪随机，确保每次渲染效果稳定

握拳后，整个记忆星云优雅收拢回紧致发光的星云球（v0.1 Memory Core）。

---

## 🤖 v0.2.1 Gesture Interaction Stabilization

v0.2.1 将张手和握拳从「持续姿态绑定」改为「稳定保持后触发一次」的命令式手势：

- **张手保持 0.5 秒** → 释放记忆星云。触发后即使手离开画面，星云也保持展开。
- **握拳保持 0.5 秒** → 收拢为记忆核心。触发后即使手离开画面，核心也保持聚合。
- **1.0 秒冷却期**：触发后短时间内再次张手/握拳不会切换状态，防止误触。
- **导航死区**：手掌中心附近 ±8% 区域不触发视角移动，减少轻微抖动。
- **手离开画面**：不改变当前世界状态，只暂停手势导航。
- **预留 `gestureNavigationEnabled` 接口**：v0.3 打开照片详情时可直接暂停手势导航。

---

## 🪐 v0.2.2 Nebula Bodies Polish

v0.2.2 将装饰物从大量平均分布的彩球/水晶重构为有层级的天体系统：

- **移除多边体水晶**：不再有 octahedron 几何体和玻璃碎片感装饰。
- **次级发光天体（Stellar Bodies）**：10 个较大发光球体（scale 0.24–0.42），分布在核心附近（r 1.8–3.2）。带 emissive 和细微呼吸脉动，作为星云中的亮节点。
- **行星系统（Mini Planets）**：120 个半透明球体，分为大行星（25 个，scale 0.10–0.16）和卫星（95 个，scale 0.05–0.10），分布在外层（r 2.8–5.2）。颜色为深蓝/青灰/冰蓝/雾白/淡紫，点缀少量火星红和沙色（≤15%）。
- **总数从 ~600 降至 130**：视觉更克制，Foliage 粒子负责氛围，天体负责结构。
- **展开态形成亮节点+行星群**：Stellar Bodies 在展开态（r 5.5–8.5）作为锚点，行星围绕节点分布。

---

## 🌠 v0.2.3 Stellar Systems Polish

v0.2.3 将零散天体升级为多个小型恒星系统：

- **Stellar Bodies 均匀分布**：10 个发光锚点使用 Fibonacci 球面分布，不再沉在底部或集中在同一环带。FORMED 半径 1.6–3.1，CHAOS 半径 5.0–8.8。
- **行星绑定到所属恒星**：每个 Planet（25 major + 95 minor）通过 `systemId` 绑定到一个 Stellar Body。行星位置 = 恒星位置 + 局部轨道偏移。每个系统有独立的倾斜轨道平面。
- **聚合/展开保持环绕关系**：FORMED ↔ CHAOS 转换时，行星跟随所属恒星一起移动，局部轨道关系维持。
- **行星可见性提升**：行星材质 opacity 从 0.38 提升至 0.72，roughness 微调，使其在 Bloom 和星尘中更清晰可见。
- **移除 ContactShadows**：消除地面错觉，让星云悬浮于深空。

---

## 🖐️ v0.3.1-lite Gesture Photo Selection

v0.3.1-lite 简化了手势照片选择流程：去除了双手锁定步骤，改为"中心候选 + Pinch 直接打开"。用户移动视角让照片靠近中心准星，系统自动弱高亮候选照片。随后单手捏合拇指食指并保持约 300ms，即可直接打开 MemoryModal。

**状态机：**

```
视角移动 → candidatePhoto（弱高亮）
  ↓ 捏合保持 300ms
selectedMemory（MemoryModal 打开，导航暂停）
  ↓ Esc / X / 背景 / 握拳
回到探索
```

**Pinch 优先级：** pinch 检测在 open/fist 之前运行，不受模式切换 cooldown 影响。只有 pinch 自身的 1000ms cooldown。pinch 进行中时会抑制 open/fist 的 rawGesture 分类，防止误触发模式切换。

**中心候选算法：** 使用相机投影矩阵将 3D 世界坐标投影到屏幕归一化坐标，计算距中心距离 + 深度惩罚。阈值 CENTER_PICK_THRESHOLD = 0.4。

**Pinch 检测：** `distance(thumb[4], index[8]) / distance(wrist[0], middleMCP[9]) < 0.5`；保持 300ms 触发；1000ms 冷却。

**Debug HUD：** 摄像头预览下方显示 candidate yes/no、pinchRatio、pinchDetected、hold time、cooldown remaining、block reason。设置 `DEBUG_GESTURES = false` 可隐藏。

---

## 🧭 v0.3.3 Constellation Photo Facing Polish

v0.3.3 优化了 Memory Constellation 展开态中的照片朝向。

**问题：** 旧逻辑中 CHAOS 展开态的照片仍然使用 `lookAt(0, 0, 0)` 朝向星云中心，导致用户从侧面或后方观察时，大量照片背板朝向用户，无法看到预览图。

**解决：** CHAOS 展开态下，每张照片使用 `lookAt(camera.position)` 柔和地朝向当前 3D 相机位置。FORMED 聚合态保持原有朝向逻辑不变。

**实现细节：**

```
CHAOS:
  dummy.lookAt(state.camera.position)
  dummy.rotateY(Math.PI)  // 翻转以匹配拍立得正面方向
  quaternion.slerp(target, 1 - exp(-delta * 4.0))  // 平滑过渡

FORMED:
  dummy.lookAt(0, 0, 0)   // 保持原逻辑，环绕星云核心
  dummy.rotateY(Math.PI)
```

- Wobble 幅度从 0.03 降至 0.02，避免相机跟随模式下摇摆过大
- 使用指数衰减 slerp（`1 - exp(-delta * 4.0)`）替代线性插值（`delta * 3`），过渡更自然
- 不影响照片位置、scale、候选选择、pinch 或鼠标点击

---

## 👊 v0.3.2 Gesture Close Memory Modal

v0.3.2 为 MemoryModal 增加了手势关闭能力。当照片详情打开时，系统进入 **Modal Gesture Mode**，暂停所有空间导航、pinch 选择和星云状态切换，只检测一个关闭手势：**握拳保持**。握拳代表"收起这段回忆"。

**Modal Gesture Mode 规则：**
- ❌ 张手 → 不切换星云状态
- ❌ 握拳 → 不收拢核心（仅关闭 modal）
- ❌ Pinch → 不打开其他照片
- ❌ 手掌移动 → 不旋转视角
- ✅ 握拳保持 600ms → 关闭 MemoryModal

**保护机制：**
- **Grace period（800ms）**：弹窗刚打开后的保护时间，避免 pinch 打开照片时的手型残留造成误关
- **Cooldown（1000ms）**：关闭后短时间内再次握拳不会重复触发
- **Fist 不受模式切换 cooldown 影响**：Modal 模式下的关闭 fist 有独立状态和 cooldown

**关闭后恢复：** Modal 关闭后，所有普通手势（张手/握拳/pinch/导航）立即恢复正常。

**状态机（完整流程）：**

```
探索 ←────────────────────────┐
  ↓                           │
视角移动 → candidate（弱高亮）    │
  ↓ pinch 300ms               │
MemoryModal 打开               │
  │ (导航暂停，pinch 暂停)      │
  │                           │
  ├── 握拳 600ms ─────────────┘
  ├── Esc / X / 背景点击 ───────┘
  └── 握拳收拢核心时自动关闭 ────┘
```

**常量：**
| 参数 | 值 |
|---|---|
| `MODAL_CLOSE_FIST_HOLD_MS` | 600ms |
| `MODAL_CLOSE_COOLDOWN_MS` | 1000ms |
| `MODAL_OPEN_GRACE_MS` | 800ms |

---

## 📸 v0.2.5 Photo Volume Distribution

v0.2.5 优化了拍立得照片在 Memory Nebula 中的空间分布：

**FORMED（聚合态）**：照片不再只环绕在最外层球壳（单层 r 3.2–5.4），改为 3 层体积分布：
- **Inner（20%）**：r 1.8–2.8，嵌入星云体积内部
- **Middle（45%）**：r 2.7–4.2，主要分布层
- **Outer（35%）**：r 4.0–5.8，保留外层环绕感

**CHAOS / Constellation（展开态）**：照片不再只沿 2–3 条星座弧链排列，改为 3 层体积分布：
- **Inner（20%）**：r 3.5–5.8，核心残光附近
- **Middle（50%）**：r 5.5–8.8，主要可浏览区域
- **Outer（30%）**：r 8.0–11.5，保留弧链结构的远景层

**动态 scale**：照片缩放根据数量和层级自动调整。≤12 张时保持较大尺寸，25–40 张时缩小至约 0.48，inner 层再额外缩小。展开态比聚合态略大，方便浏览。
