/**
 * 这是基于科大讯飞实时语音转写 Web 端 SDK 官方 Demo 改造的浏览器端客户端。
 *
 * 实现了以下功能：
 * 1. 从后端 (signa-server.js) 获取鉴权签名及翻译相关参数。
 * 2. 使用 SDK 提供的 RecorderManager 采集麦克风音频。
 * 3. 在业务逻辑层建立与科大讯飞实时转写服务的 WebSocket 连接，包含翻译参数。
 * 4. 将 RecorderManager 采集的音频数据实时发送到 WebSocket。
 * 5. 接收并解析科大讯飞返回的实时转写结果和翻译结果。
 * 6. 在简洁的 UI 浮窗中同时显示转写和翻译内容。
 *
 * 请确保以下文件与此 app.js 处于同一目录（或可访问路径）：
 * - index.umd.js (SDK 主文件，提供 RecorderManager)
 * - processor.worker.js (由 index.umd.js 内部加载)
 * - processor.worklet.js (由 index.umd.js 内部加载)
 *
 * 并且您的 signa-server.js 正在运行在 http://localhost:3000。
 */

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const translationFloatWindow = document.getElementById('translationFloatWindow');
    
    // UI 元素 ID，现在分别指向两个不同的 div
    // 确保这些 ID 与 index.html 中的 <div id="..."> 严格匹配
    const transcriptionContentDiv = document.getElementById('transcriptionContent');     // 用于显示英文转写
    const translationResultContentDiv = document.getElementById('translationResultContent'); // 用于显示中文翻译

    let websocket = null; // WebSocket 实例
    let recorder = null;  // RecorderManager 实例

    // 直接存储最新的完整文本，不再按 segId 分片
    let currentTranscriptionText = ""; // 存储实时转写（源语言，英文）的最新完整文本
    let currentTranslationText = "";   // 存储实时翻译（目标语言，中文）的最新完整文本

    let isRecording = false; // 用于追踪录音状态

    /**
     * 更新 UI 显示
     * @param {string} transcriptionText 转写文本 (英文)
     * @param {string} translationText 翻译文本 (中文)
     */
    function updateUI(transcriptionText, translationText) {
        // 更新 UI 文本内容
        transcriptionContentDiv.textContent = transcriptionText;
        translationResultContentDiv.textContent = translationText;
    }

        /**
     * 渲染科大讯飞返回的实时结果
     * @param {string} resultData 从WebSocket收到的JSON字符串
     */
    function renderResult(resultData) {
        const res = JSON.parse(resultData);
        switch (res.action) {
            case 'error':
                console.error(`讯飞实时转写错误: ${res.code} - ${res.desc}`);
                updateUI(`错误: ${res.desc}`, `错误: ${res.desc}`);
                stopRecording(); 
                break;
            case 'started':
                console.log('讯飞实时转写服务已启动! SID:', res.sid);
                currentTranscriptionText = "讯飞服务已启动，请开始说话...";
                currentTranslationText = "讯飞服务已启动，请开始说话...";
                updateUI(currentTranscriptionText, currentTranslationText);
                break;
            case 'result':
                const innerData = JSON.parse(res.data);
                console.log("收到的原始 result 数据:", res);
                console.log("解析后的 innerData (res.data):", innerData);

                // 优先处理带有翻译结果的 biz: "trans" 消息
                if (innerData.biz === "trans") {
                    if (typeof innerData.src === 'string') {
                        currentTranscriptionText = innerData.src; // 更新源语言（英文）转写文本
                    }
                    if (typeof innerData.dst === 'string') {
                        currentTranslationText = innerData.dst; // 更新目标语言（中文）翻译文本
                    }
                    // 收到完整的转写和翻译结果，立即更新UI的两个部分
                    updateUI(currentTranscriptionText, currentTranslationText);
                } 
                // 其次，处理纯转写消息 (不带翻译，但包含 cn.st 结构)
                // 这种情况下，我们只更新转写原文部分，不影响翻译部分
                else if (innerData.cn && innerData.cn.st) {
                    let segmentText = "";
                    innerData.cn.st.rt.forEach(segment => {
                        if (segment.ws) {
                            segment.ws.forEach(word => {
                                if (word.cw) {
                                    word.cw.forEach(char => {
                                        segmentText += char.w;
                                    });
                                }
                            });
                        }
                    });
                    
                    // 仅更新 currentTranscriptionText
                    currentTranscriptionText = segmentText; 
                    // 并且只更新 UI 中的转写文本框，不触发完整的 updateUI 导致翻译框闪烁或清空
                    transcriptionContentDiv.textContent = currentTranscriptionText;

                    console.log("收到纯转写消息 (seg_id:", innerData.seg_id, ")，内容:", segmentText, "。已实时更新转写原文。");
                } else {
                    console.warn("未知的 result data 结构，请检查科大讯飞文档或 WebSocket 返回:", innerData);
                }
                break;
            default:
                console.log("未知消息类型或 action:", res);
        }
    }


    /**
     * 建立与科大讯飞的 WebSocket 连接
     */
    async function connectWebSocket() {
        try {
            console.log("正在从后端获取签名和翻译参数...");
            const response = await fetch('http://localhost:3000/generate-signa');
            if (!response.ok) {
                // 如果后端响应状态码不是 2xx，则抛出错误
                throw new Error(`后端签名服务错误: ${response.status} ${response.statusText}`);
            }
            // 从后端获取所有必要的参数，包括鉴权和翻译相关的参数（如 pd 垂直领域）
            const { appid, ts, signa, lang, transType, transStrategy, targetLang, pd } = await response.json();
            console.log("参数获取成功:", { appid, ts, signa, lang, transType, transStrategy, targetLang, pd });

            const hostUrl = "wss://rtasr.xfyun.cn/v1/ws";
            // 构建 WebSocket 连接的 URL 参数
            const params = new URLSearchParams({
                appid: appid,
                ts: ts,
                signa: signa,
                lang: lang,             // 源语言
                transType: transType,   // 翻译类型
                transStrategy: transStrategy, // 翻译策略
                targetLang: targetLang, // 目标语言
                pd: pd                  // 垂直领域，此处为 "edu"
            });
            const wssUrl = `${hostUrl}?${params.toString()}`;
            console.log("WebSocket URL:", wssUrl);

            websocket = new WebSocket(wssUrl); // 创建 WebSocket 实例

            // WebSocket 连接成功事件
            websocket.onopen = () => {
                console.log("WebSocket 连接成功!");
                // 连接成功后，更新 UI 提示，并开始录音
                currentTranscriptionText = "WebSocket 连接成功，开始识别...";
                currentTranslationText = "WebSocket 连接成功，开始翻译...";
                updateUI(currentTranscriptionText, currentTranslationText);
                startRecordingAudio(); // 连接成功后才启动录音
            };

            // 收到 WebSocket 消息事件
            websocket.onmessage = (event) => {
                renderResult(event.data); // 将收到的数据传递给渲染函数处理
            };

            // WebSocket 错误事件
            websocket.onerror = (err) => {
                console.error("WebSocket 连接错误:", err);
                // 出现错误时，更新 UI 并尝试停止所有流程
                updateUI("WebSocket 连接错误！", "WebSocket 连接错误！");
                stopRecording(); 
            };

            // WebSocket 关闭事件
            websocket.onclose = () => {
                console.log("WebSocket 连接关闭!");
                // 连接关闭时，确保所有资源被清理，并更新 UI 状态
                stopRecording(); 
            };

        } catch (error) {
            // 捕获 fetch 或 WebSocket 连接过程中的任何错误
            console.error("WebSocket 连接失败:", error);
            alert("无法连接到语音转写服务，请检查后端签名服务和网络连接: " + error.message);
            stopRecording(); // 连接失败也停止所有流程
        }
    }

    /**
     * 启动 RecorderManager 录音并传输音频数据
     */
    function startRecordingAudio() {
        // 检查 RecorderManager SDK 是否已加载
        if (typeof RecorderManager === 'undefined' || !window.RecorderManager) {
            console.error("RecorderManager 未定义。请确保 index.umd.js 已正确加载。");
            alert("SDK 未加载。请检查 index.umd.js 路径。");
            stopRecording();
            return;
        }
        // 实例化 RecorderManager。参数 "./" 指向 processor.worker.js 和 processor.worklet.js 的相对路径
        recorder = new window.RecorderManager("./"); 

        // 监听音频帧数据事件
        recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }) => {
            // 确保 WebSocket 连接处于打开状态，才能发送数据
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                // 将 ArrayBuffer 转换为 Int8Array 的 buffer 视图发送给服务器
                websocket.send(new Int8Array(frameBuffer).buffer); 
                if (isLastFrame) {
                    // 如果是最后一帧，发送结束标记
                    websocket.send(JSON.stringify({ end: true }));
                    console.log("最后一帧发送完毕，发送结束标记。");
                    isRecording = false; // 标记前端数据发送完毕
                }
            }
        };

        // 监听录音停止事件
        recorder.onStop = () => {
            console.log("RecorderManager 录音停止。");
            // 录音停止时，如果 WebSocket 仍然打开，发送结束标记并关闭 WebSocket
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({ end: true }));
            }
            if (websocket && websocket.readyState !== WebSocket.CLOSED) {
                 websocket.close(); // 关闭 WebSocket 连接，会触发 onclose 回调
            }
            websocket = null; // 清除 WebSocket 实例引用
            recorder = null;  // 清除 RecorderManager 实例引用
            stopRecording(); // 调用停止流程，确保 UI 和状态同步
        };

        // 启动 RecorderManager，开始录音
        recorder.start({
            sampleRate: 16000, // 采样率
            frameSize: 1280,   // 每帧音频数据大小
        }).then(() => {
            console.log("RecorderManager 启动成功，开始录音。");
            isRecording = true; // 标记正在录音
            startButton.disabled = true; // 禁用开始按钮
            stopButton.disabled = false; // 启用停止按钮
        }).catch(error => {
            console.error("RecorderManager 启动失败:", error);
            alert("麦克风启动失败: " + error.message + "\n请检查麦克风权限。");
            stopRecording(); // 录音启动失败也停止所有流程
        });
    }

    /**
     * 停止所有录音和WebSocket连接，并重置UI状态
     */
    function stopRecording() {
        // 如果已经停止或未开始，则直接返回，避免重复执行
        if (!isRecording && (!websocket || websocket.readyState === WebSocket.CLOSED)) {
            return;
        }

        console.log("停止录音流程开始...");
        isRecording = false; // 标记录音已停止

        // 停止 RecorderManager
        if (recorder) {
            recorder.stop(); // 调用 SDK 的停止方法，这将触发 onStop 回调
        } else if (websocket && websocket.readyState === WebSocket.OPEN) {
            // 如果 recorder 没有实例化或未启动，但 WebSocket 仍然开启，则直接发送结束标记并关闭 WebSocket
            websocket.send(JSON.stringify({ end: true }));
            websocket.close();
        }

        // 清理 WebSocket 和 RecorderManager 实例引用
        websocket = null;
        recorder = null;

        // 更新 UI 元素显示状态
        translationFloatWindow.style.display = 'none'; // 隐藏浮窗
        startButton.disabled = false; // 启用开始按钮
        stopButton.disabled = true;   // 禁用停止按钮
        
        // 清空文本内容并显示默认提示
        currentTranscriptionText = "等待语音输入...";
        currentTranslationText = "等待翻译内容...";
        updateUI(currentTranscriptionText, currentTranslationText);
        
        console.log("停止录音流程完成。");
    }

    // 绑定开始按钮点击事件
    startButton.addEventListener('click', async () => {
        if (isRecording) return; // 如果已经在录音，避免重复点击
        startButton.disabled = true; // 立即禁用开始按钮
        stopButton.disabled = true;  // 暂时禁用停止按钮，直到连接成功
        translationFloatWindow.style.display = 'block'; // 显示浮窗
        updateUI("正在请求麦克风权限和连接服务...", "正在请求翻译服务..."); // 更新 UI 提示

        // 异步连接 WebSocket，连接成功后会在其 onopen 回调中启动录音
        await connectWebSocket();
    });

    // 绑定停止按钮点击事件
    stopButton.addEventListener('click', () => {
        stopRecording(); // 调用停止录音和连接的函数
    });
});
