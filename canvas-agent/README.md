# CoGenesis Canvas Agent

本地 Canvas Agent 用来连接 CoGenesis 网页画布和用户电脑上的 Codex / Claude Code。它只监听 `127.0.0.1`，网页需要使用终端输出的 Local URL 和 Connect token 才能连接。

## 本地启动

```bash
cd canvas-agent
npm install
npm run build
node dist/index.js
```

启动后会输出：

```txt
CoGenesis Canvas Agent
Local URL: http://127.0.0.1:17371
Connect token: xxxxxx
```

回到画布右侧“创作控制台 -> 本地 Agent”，填入地址和 token 后连接。

配置文件默认保存在：

```txt
~/.cogenesis/canvas-agent.json
```

## Codex MCP

如果希望本机 Codex 终端直接操作当前网页画布，先注册 MCP：

```bash
codex mcp add cogenesis-canvas -- node /path/to/cogenesis/canvas-agent/dist/index.js mcp
```

可用工具包括：

- `canvas_get_state`
- `canvas_get_selection`
- `canvas_export_snapshot`
- `canvas_apply_ops`
- `canvas_create_text_node`
- `canvas_create_generation_flow`
- `canvas_generate_text`
- `canvas_generate_image`
- `canvas_generate_video`
- `canvas_generate_audio`
- `canvas_run_generation`

`canvas_apply_ops` 示例：

```json
{
  "ops": [
    {
      "type": "add_node",
      "nodeType": "text",
      "title": "标题",
      "position": { "x": 0, "y": 0 },
      "metadata": { "content": "文本内容" }
    }
  ]
}
```

## 安全边界

- 本地服务默认只监听 `127.0.0.1`。
- 网页连接必须携带 Connect token。
- 第一次连接后会记录允许的网页 Origin。
- 画布写操作会在网页侧边栏二次确认后执行。
- 图片附件会临时写入本机临时目录，发送完成后清理。

## 发布

当前仓库不启用 npm 自动发布工作流。需要公开发布 `@cogenesis/canvas-agent` 时，再单独配置 npm scope、版本号和发布凭据。
