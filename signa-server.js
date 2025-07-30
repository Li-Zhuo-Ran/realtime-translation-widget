// signa-server.js

const express = require('express');
const crypto = require('crypto'); // Node.js 内置的加密模块
const cors = require('cors'); // 导入 cors 模块
const app = express();
const port = 3000;

// --- 配置你的 AppID 和 APIKey ---
// **重要：请替换成你在科大讯飞控制台获取的真实 AppID 和 APIKey！**
// **务必保护好你的 APIKey，不要泄露！**
const YOUR_APPID = 'b93d1928'; // 从科大讯飞控制台获取
const YOUR_APIKEY = '375ca086c99776d92cd32a9fecba7041'; // 从科大讯飞控制台获取，务必保密！

// 使用 cors 中间件来处理跨域请求
app.use(cors());

/**
 * 生成科大讯飞实时转写服务的 signa 参数
 * 公式：HmacSHA1(MD5(appid + ts), api_key)，具体的生成方法详见【调用示例】；
 */
function generateSigna(appid, ts, apiKey) {
    const baseString = appid + ts;
    const md5Hash = crypto.createHash('md5').update(baseString).digest('hex');
    const hmac = crypto.createHmac('sha1', apiKey);
    hmac.update(md5Hash);
    const signa = hmac.digest('base64');
    return signa;
}

// 定义后端接口：响应前端的 GET 请求，提供签名和翻译参数
// 路径：http://localhost:3000/generate-signa
app.get('/generate-signa', (req, res) => {
    const ts = Math.floor(Date.now() / 1000).toString(); // 获取当前时间戳（秒）
    const signa = generateSigna(YOUR_APPID, ts, YOUR_APIKEY);

    // 返回前端期望的所有参数，包括翻译参数
    // 这些翻译参数通常是固定的，或根据业务需求可配置
    const lang = 'en';           // 原始语言：cn-中文，en-英文 (你的场景是英译中，所以源语言是en)
    const transType = 'normal';  // 翻译类型：normal-普通翻译
    const transStrategy = '2';   // 翻译策略：2-返回中间过程中的结果（这个是你之前选择的）
    const targetLang = 'cn';     // 目标语言：en-英文，cn-中文 (你的场景是英译中，所以目标语言是cn)
    const pd = 'edu';            // 垂直领域：edu-教育 (根据你的文档，这个参数是必须的)

    res.json({
        appid: YOUR_APPID,
        ts: ts,
        signa: signa,
        lang: lang,
        transType: transType,
        transStrategy: transStrategy,
        targetLang: targetLang,
        pd: pd // 添加 pd 参数
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Signa server listening at http://localhost:${port}`);
    console.log(`Frontend will request: http://localhost:${port}/generate-signa`);
    console.log(`Remember to replace YOUR_APPID and YOUR_APIKEY in signa-server.js!`);
});

