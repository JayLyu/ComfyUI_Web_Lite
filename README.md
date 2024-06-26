# ComfyUI-WebLite
 简约 html 版的 ComfyUI 前端应用

`index.html`：加载 `Workflow API.json` 并生成表单，提交后可返回图像
`index2.html`：默认加载同名文件夹下的 `Workflow API.json`，提交后可返回图像

> ComfyUI 启动的命令建议使用 `python main.py --enable-cors-header`

TODO

[x] 单 html 应用
[ ] 图片存储在 LocalStorage
[ ] 样式优化
[ ] 隐藏特定字段的配置
[ ] 针对 ckpt 等可遍历本地另外的 json 生成 Select