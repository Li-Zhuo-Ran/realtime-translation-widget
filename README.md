# realtime-translation-widget
实时翻译小浮窗
# 实时语音翻译浮窗系统

![Project Status](https://img.shields.io/badge/status-active-brightgreen.svg)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
<!-- 如果有CI/CD或部署状态，可以在这里添加徽章 -->

## 📚 项目简介

本项目旨在为学院官方网站提供一个实时语音翻译浮窗功能。通过集成科大讯飞的语音识别和翻译API，用户可以在浏览学院网站时，通过麦克风进行语音输入，系统将实时转写为文字并翻译成指定语言，以浮窗形式展示。这极大地提升了网站的可访问性和用户体验，尤其对于非中文母语的用户。

## ✨ 主要功能

*   **实时语音输入：** 浏览器内直接通过麦克风采集语音。
*   **实时转写：** 将语音内容即时转换为文本。
*   **实时翻译：** 将转写后的文本实时翻译为目标语言（例如：中文译英文）。
*   **浮窗展示：** 以可拖动、可隐藏的浮窗形式在网站页面上展示转写和翻译结果。
*   **后端签名服务：** 提供安全的鉴权签名，保护科大讯飞API密钥。

## ⚙️ 技术栈

*   **前端:**
    *   HTML, CSS, JavaScript
    *   科大讯飞 JavaScript SDK
*   **后端:**
    *   Node.js (用于签名服务)
    *   Express.js (Web框架)
    *   CORS (跨域资源共享)
*   **外部服务:**
    *   科大讯飞开放平台 实时语音转写 API
    *   科大讯飞开放平台 机器翻译 API

## 🚀 部署指南

本项目包含前端和后端两部分，需要分别部署。

### 1. 前期准备

在部署之前，请确保您已完成以下准备工作：

*   **获取科大讯飞API凭证：**
    *   前往 [科大讯飞开放平台](https://www.xfyun.cn/) 注册账号。
    *   创建一个新的应用，并开通**实时语音转写**和**机器翻译**服务。
    *   获取您的 **AppID**, **APIKey**, **APISecret**。
*   **服务器环境：**
    *   一台运行 **Node.js** (版本 14+) 的服务器用于后端服务。
    *   一台可提供静态文件访问的 **Web 服务器** (如 Nginx, Apache) 用于前端文件，通常就是学院官网的服务器。
*   **Git：** 确保您的部署环境已安装 Git。

### 2. 后端服务部署 (`signa-server.js`)

后端服务负责生成科大讯飞 API 的签名，部署步骤如下：

1.  **克隆仓库：**
    ```bash
    git clone https://github.com/你的GitHub用户名/你的仓库名称.git
    cd 你的仓库名称
    ```
2.  **进入后端目录并安装依赖：**
    ```bash
    cd backend/ # 假设你的signa-server.js在backend目录下
    npm install
    ```
    （如果你的`signa-server.js`直接在项目根目录，则跳过`cd backend`）
3.  **配置API凭证：**
    *   打开 `signa-server.js` 文件。
    *   找到以下行，并替换为您的实际凭证：
        ```javascript
        // const APPID = 'YOUR_APPID';
        // const APISecret = 'YOUR_APISECRET';
        // const APIKey = 'YOUR_APIKEY';

        // 示例：
        const APPID = 'xxxxxxxx-xxxxxxxx-xxxxxxxx'; // 替换为你的AppID
        const APISecret = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 替换为你的APISecret
        const APIKey = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 替换为你的APIKey
        ```
    *   **配置服务器监听地址和端口：**
        ```javascript
        const port = 3000; // 你希望后端监听的端口
        // app.listen(port, 'localhost', () => { // 原始代码可能如此
        app.listen(port, '0.0.0.0', () => { // 更改为0.0.0.0允许外部访问
            console.log(`Server running on port ${port}`);
        });
        ```
    *   **配置CORS (跨域资源共享)：**
        在 `signa-server.js` 中添加或修改 CORS 配置，允许你的学院官网域名访问：
        ```javascript
        const cors = require('cors');
        app.use(cors({
            origin: 'https://www.your-academy-domain.edu', // 替换为你的学院官网域名
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        // 如果有多个域名，可以设置为数组：
        // origin: ['https://www.your-academy-domain.edu', 'https://another-domain.com'],
        ```
4.  **启动后端服务：**
    推荐使用 `pm2` 等进程管理工具来启动服务，确保其在后台运行且在服务器重启后自动恢复。
    ```bash
    # 安装pm2 (如果未安装)
    npm install -g pm2
    # 启动服务
    pm2 start signa-server.js --name translation-backend
    # 查看服务状态
    pm2 list
    # 设置开机自启
    pm2 save
    pm2 startup
    ```
5.  **防火墙配置：**
    确保服务器防火墙开放了你后端服务监听的端口（例如 `3000`）。

### 3. 前端文件部署 (`app.js` 等)

前端文件需要部署到学院官网的 Web 服务器上，并嵌入到官网主页。

1.  **将前端文件上传至Web服务器：**
    将 `app.js`, `index.umd.js`, `processor.worker.js`, `processor.worklet.js` 以及所有相关的 CSS 文件（例如 `floating-window.css`）上传到学院 Web 服务器的某个公开可访问的目录，例如：
    `/var/www/html/your-academy-website/translation-widget/`
    或者你的项目结构可能直接就是：
    `./dist/` 或 `./frontend/` 目录下的所有内容。

2.  **修改前端 `app.js` 配置：**
    打开你上传到服务器的 `app.js` 文件，找到请求后端签名的 URL，并替换为你的后端服务实际地址。
    ```javascript
    // 在 app.js 中找到类似以下的代码：
    // const backend_url = 'http://localhost:3000';
    const backend_url = 'https://your-backend-server-ip-or-domain:3000'; // 替换为你的后端服务实际地址
    ```
    请注意，如果你的后端服务使用了 HTTPS，这里也要改成 `https://`。

3.  **在学院官网主页嵌入浮窗代码：**
    打开学院官网的 HTML 主页文件 (例如 `index.html` 或 `.php` 文件)，在 `<body>` 标签的**末尾**（`</body>` 之前）插入浮窗的 HTML 结构和 JavaScript/CSS 引用。

    **示例 HTML 结构 (根据你的实际浮窗HTML):**
    ```html
    <!-- 实时翻译浮窗容器 -->
    <div id="xf-translation-floating-window" class="xf-floating-window">
        <!-- 浮窗标题栏，用于拖动 -->
        <div class="xf-window-header">
            <span>实时翻译</span>
            <button id="xf-close-button">X</button>
        </div>
        <!-- 控制按钮区域 -->
        <div class="xf-window-controls">
            <button id="xf-start-button">开始翻译</button>
            <button id="xf-stop-button" disabled>停止翻译</button>
            <!-- 更多按钮如切换语言等 -->
        </div>
        <!-- 翻译结果显示区域 -->
        <div class="xf-window-content">
            <p>**原文:** <span id="xf-original-text">等待语音输入...</span></p>
            <p>**译文:** <span id="xf-translated-text">等待翻译结果...</span></p>
        </div>
    </div>
    ```

    **示例 JavaScript/CSS 引用 (根据你的实际文件路径):**
    将这些 `<link>` 和 `<script>` 标签放在你的 HTML 文件的 `<head>` 或 `<body>` 末尾。
    ```html
    <!-- 样式文件 -->
    <link rel="stylesheet" href="/path/to/translation-widget/floating-window.css">

    <!-- 讯飞SDK文件 -->
    <script src="/path/to/translation-widget/index.umd.js"></script>
    <script src="/path/to/translation-widget/processor.worker.js"></script>
    <script src="/path/to/translation-widget/processor.worklet.js"></script>

    <!-- 你的主要应用逻辑 -->
    <script src="/path/to/translation-widget/app.js"></script>
    ```
    **请确保 `/path/to/translation-widget/` 是你实际上传文件到 Web 服务器后的正确相对路径或绝对路径。**

## 🔧 开发与维护

### 本地开发

1.  克隆仓库：`git clone https://github.com/你的GitHub用户名/你的仓库名称.git`
2.  进入项目根目录：`cd 你的仓库名称`
3.  **后端开发：**
    *   进入后端目录：`cd backend/` (或直接在项目根目录)
    *   安装依赖：`npm install`
    *   启动开发服务器：`node signa-server.js` (或者 `nodemon signa-server.js` 如果你安装了 nodemon)
    *   确保你的 `APPID`, `APISecret`, `APIKey` 在 `signa-server.js` 中配置正确。
4.  **前端开发：**
    *   在 `app.js` 中将 `backend_url` 设置为 `http://localhost:3000` (如果后端在本地3000端口运行)。
    *   直接在浏览器中打开 `index.html` (或通过一个简单的本地Web服务器如 `http-server` 启动)。

### 贡献

欢迎通过 Pull Request 提交代码贡献！在提交 PR 之前，请：

1.  Fork 本仓库。
2.  创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4.  推送到远程分支 (`git push origin feature/AmazingFeature`)。
5.  打开一个 Pull Request。

## 📞 联系方式

*   你的姓名/项目维护者
*   你的邮箱/GitHub Profile: [你的GitHub用户名](https://github.com/你的GitHub用户名)

## 📄 许可证

本项目采用 MIT 许可证，详情请见 `LICENSE` 文件。

---
