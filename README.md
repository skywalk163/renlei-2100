# 人类协议 2100 · 文明推演器

关键词：**程序 / 未来 / 人类**
一句话：把「技术速率、共情浓度、集体选择」三个旋钮交给程序，推演 2100 年的三种人类未来，并收到一封来自 2100 年的回信。

方法论文档见 [TRAE高效开发手册.md](TRAE高效开发手册.md)：怎么在 90 分钟内把随机关键词变成可演示 Demo、怎么并行、怎么兜底。

在线体验（静态版，无需后端）：<https://skywalk163.github.io/renlei-2100/>

## 运行

```powershell
cd g:\dswork\AI\renlei-2100
python server.py
# 打开 http://127.0.0.1:2100
```

推演逻辑全部用**光明（Light）**写：`引擎.light` 纯函数，`api.light` 是入口；`server.py` 只是传输薄壳（静态文件 + 把参数写成 JSON 再调 Light）。

为什么有薄壳：本机 Light v0.4.0 的 HTTP 服务端在 `contrib/HTTP服务端` 里只有 Python 腿，`创建HTTP服务端` 在 `light run` 下不可用，`stdlib/HTTP服务端` 的构造函数又把端口写死为 0，因此传输层用标准库，业务不进 Python。

## 文件

```
引擎.light      推演算法（纯函数、确定性）：存续指数 / 判定 / 一句话 / 三分支 / 转折点 / 回信
自测.light      三组输入，打印 JSON 供核对
生成表.light    铺满 0-100 的 11×11×11 组参数，生成静态预演表
api.light       读 _input.json，调用引擎，输出一行 JSON
server.py       127.0.0.1:2100，静态页面 + POST /api/simulate
web/            index.html / style.css / app.js（原生，无 CDN、无构建）
docs/           静态版（可直接部署）：内含 table.js 预演表，不需要后端
契约.md          三线并行时冻结的接口契约
```

## 静态版（上传/分享用）

`docs/` 是零后端版本：`table.js` 里是 Light 引擎预生成的 1331 组结果，前端按最近的 10 的倍数查表。本地双击 `docs/index.html` 也能跑。

```powershell
python -m http.server 4173 --directory docs     # 预览 http://127.0.0.1:4173
```

重新生成预演表（改了 `引擎.light` 后）：

```powershell
& 'G:\dswork\duan-light-merge\light-merge\.venv\Scripts\light.exe' run .\生成表.light
# 再把 web/推演表.json 转成 docs/table.js：window.__预演表=<json>;
```

部署三条路：
- **Netlify Drop**：把 `docs` 文件夹拖到 https://app.netlify.com/drop，拿到公网 URL（最快）
- **GitHub Pages**：推到 GitHub → Settings → Pages → Source 选 `main` / `/docs`
- **Vercel**：`npx vercel --prod`（在 `docs` 目录内执行）

截图/分享参数：`?auto=1` 自动推演一次，可加 `&技术=90&共情=40&选择=70`。


## 自测

```powershell
& 'G:\dswork\duan-light-merge\light-merge\.venv\Scripts\light.exe' check .\引擎.light
& 'G:\dswork\duan-light-merge\light-merge\.venv\Scripts\light.exe' run .\自测.light
& 'G:\dswork\duan-light-merge\light-merge\.venv\Scripts\light.exe' run .\api.light   # 需先有 _input.json
curl.exe -s -X POST http://127.0.0.1:2100/api/simulate -H "Content-Type: application/json" --data-binary "@req.json"
```

## 并行开发记录

三条线同时开工，文件所有权互斥，只依赖 `契约.md`：

| 线 | 文件 | 结果 |
|---|---|---|
| A 引擎 | `引擎.light`、`自测.light` | `check` 通过；三组自测概率合计均 100 |
| B 服务 | 原 `主.light` | 写完后发现 Light HTTP 工厂运行时不可用，改为 `server.py` 薄壳 |
| C 前端 | `web/*` | 原生页面，成功态/错误态均有无头截图验证 |

## 已知限制

- 动态版每次推演会起一个 Light 进程（约 1 秒）；静态版查表，无延迟。
- 静态版参数按 10 取整（11³ 组），滑块中间值的文案会吸附到最近的格点。
- 概率与文案由确定性规则生成，不是真模型；讲的时候说清楚「规则推演」。
- 端口 2100 被占用时先关掉旧进程。
