const $ = new Env("sora");

// --- 配置常量 ---
// 缓存中最多保留多少条视频链接记录
const MAX_CACHE_RECORDS = 20;
// 用于存储视频链接映射的持久化数据键名
const KEY_VIDEO_URL_MAP = "sora_video_url_map";
// 用于存储每日首次运行日期的持久化数据键名
const KEY_DAILY_CHECK_DATE = "sora_daily_check_date";
// 识别视频主链接的独特标识符
const MASTER_URL_IDENTIFIER = "00000/src.mp4";


// --- 主逻辑入口 ---
// 使用 async/await 结构，让异步代码更清晰
(async () => {
    // 1. 执行每日首次运行的检查和通知
    await handleDailyFirstRun();

    // 2. 获取当前请求的URL
    const requestURL = $request.url;
    if (!requestURL) {
        $.log("⚠️ 请求URL为空，脚本提前终止。");
        return $done();
    }
    // 3. 根据URL内容，执行不同的逻辑分支
    if (requestURL.includes(MASTER_URL_IDENTIFIER)) {
        // 如果是视频主链接，执行缓存逻辑
        await handleCacheVideoUrl(requestURL);
    } else {
        // 否则，执行查询并返回缓存链接的逻辑
        await handleQueryVideoUrl(requestURL);
    }
})()
.catch((err) => {
    // 捕获任何在主逻辑中可能发生的错误
    $.logErr(err);
})
.finally(() => {
    // 无论成功或失败，最后都调用 $done() 结束脚本
    $done();
});


// --- 核心功能函数 ---

/**
 * 处理缓存视频主链接的逻辑
 * @param {string} url 捕获到的视频主链接
 */
async function handleCacheVideoUrl(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        $.log(`ℹ️ 在主链接中未找到可用的 Video ID: ${url}`);
        return;
    }

    $.log(`🔍 捕获到视频主链接，ID: ${videoId}`);
    let videoUrlMap = $.getjson(KEY_VIDEO_URL_MAP, {});

    if (videoUrlMap.hasOwnProperty(videoId)) {
        $.log(`✅ ID [${videoId}] 的链接已存在，无需更新。`);
        return;
    }

    // 缓存池管理：如果超过上限，则删除最旧的一个
    const cachedIds = Object.keys(videoUrlMap);
    if (cachedIds.length >= MAX_CACHE_RECORDS) {
        const oldestId = cachedIds[0];
        delete videoUrlMap[oldestId];
        $.log(`🗑️ 缓存已满 (${MAX_CACHE_RECORDS}条)，已删除最旧的记录: ${oldestId}`);
    }

    // 存入新的视频链接
    videoUrlMap[videoId] = url;
    const success = $.setjson(videoUrlMap, KEY_VIDEO_URL_MAP);

    if (success) {
        $.log(`👍 成功缓存新的视频链接！ID: ${videoId}`);
        $.msg("Sora 缓存成功", `视频 ID: ${videoId}`, "主链接已成功保存，后续请求将使用此链接。");
    } else {
        $.log(`❌ 缓存视频链接失败！ID: ${videoId}`);
    }
}

/**
 * 处理查询并返回已缓存视频链接的逻辑
 * @param {string} url 当前捕获到的请求URL
 */
async function handleQueryVideoUrl(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        $.log(`ℹ️ 在普通请求中未找到可用的 Video ID: ${url}`);
        // 对于无法提取ID的请求，直接放行
        return;
    }

    $.log(`▶️ 接收到视频相关请求，ID: ${videoId}，正在查找缓存...`);
    const videoUrlMap = $.getjson(KEY_VIDEO_URL_MAP, {});
    const cachedUrl = videoUrlMap[videoId];

    if (cachedUrl) {
        $.log(`🎯 命中缓存！将为 ID [${videoId}] 返回主链接。`);
        // 使用 $done 直接返回一个302重定向响应，让播放器去请求主链接
        // 这是比返回 body 更高效的方式
        $done({
            response: {
                status: 302,
                headers: {
                    Location: cachedUrl
                }
            }
        });
    } else {
        $.log(`❓ 未找到 ID [${videoId}] 的缓存链接，直接放行此请求。`);
    }
}


/**
 * 处理每日首次运行的逻辑，例如发送通知
 */
async function handleDailyFirstRun() {
    const todayStr = new Date().toLocaleDateString();
    const lastRunDate = $.getdata(KEY_DAILY_CHECK_DATE);

    if (lastRunDate !== todayStr) {
        $.setdata(todayStr, KEY_DAILY_CHECK_DATE);
        $.log(`☀️ 每日首次运行，发送通知...`);
        $.msg(
            "Sora 视频脚本",
            `日期: ${todayStr}`,
            "脚本已开始运行，准备为您缓存视频链接。"
        );
    }
}

/**
 * 从 URL 中提取唯一的视频 ID。
 * 注意：此处的正则表达式需要根据实际目标网站的URL结构进行调整。
 * 原脚本使用的是 `(?<=id=)[^&]+`，这里我们采用一个更通用的模式作为示例。
 * @param {string} url - 任意请求的URL
 * @returns {string|null} - 提取到的 Video ID，如果没找到则返回 null
 */
function extractVideoId(url) {
    // 假设视频ID在路径中，格式如 /videos/abcdef12345/
    const match = url.match(/\/videos\/([a-zA-Z0-9]+)\//);
    if (match && match[1]) {
        return match[1];
    }
    
    // 或者尝试从查询参数中获取，兼容原脚本的逻辑
    const urlParams = new URLSearchParams(url.split('?')[1]);
    if (urlParams.has('id')) {
        return urlParams.get('id');
    }

    return null; // 如果两种模式都匹配不到，则返回 null
}

function Env(t, e) { "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0); class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e)} isNode() { return "undefined" != typeof module && !!module.exports } isQuanX() { return "undefined" != typeof $task } isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon } isLoon() { return "undefined" != typeof $loon } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) })) } post(t, e = (() => { })) { if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl; return { "open-url": e, "media-url": s } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = [""]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) } }(t, e) }
