# ComfyUI-WebLite

![preview](./preview.jpeg)

极简 ComfyUI 前端应用，可以读取 `workflow_api.json` 文件并生成对应的表单，点击 `Queue` 可发起图像生成请求。

## 如何使用

1. 使用命令 `python main.py --enable-cors-header` 启动 ComfyUI
2. 使用 VsCode 的 `Open with Live Serve` 功能打开 `index.html`，然后访问 `http://127.0.0.1:5500/index.html` 即可。

TODO

[x] 单 html 应用
[x] 图片存储在 LocalStorage
[x] 样式优化
[x] 隐藏特定字段的配置
[ ] 针对 ckpt 等可遍历本地另外的 json 生成 Select
