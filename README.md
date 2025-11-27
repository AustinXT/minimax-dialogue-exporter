# 🚀 MiniMax Dialogue Exporter

> 一个优雅的油猴脚本，用于导出 MiniMax Agent 对话内容为 Markdown 格式

[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-安装脚本-red?style=flat-square&logo=tampermonkey)](https://greasyfork.org/zh-CN/scripts/557046-minimax-dialogue-exporter)
[![GitHub](https://img.shields.io/badge/GitHub-源代码-blue?style=flat-square&logo=github)](https://github.com/AustinXT/minimax-dialogue-exporter)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

## ✨ 功能特性

- 📥 **导出文件**：一键导出为 Markdown 文件，文件名自动匹配对话标题
- 📋 **复制内容**：一键复制 Markdown 内容到剪贴板
- 📝 **Markdown 格式**：导出为结构清晰的 Markdown 文件
- 💭 **完整内容**：提取对话、思考 (Thinking)、任务 (Task) 等全部内容
- 🎯 **精准提取**：只提取左侧对话区域，忽略右侧进程/文件面板

## 📦 安装方法

### 前置要求

安装浏览器扩展（任选其一）：
- [Tampermonkey](https://www.tampermonkey.net/) (推荐)
- [Violentmonkey](https://violentmonkey.github.io/)
- [Greasemonkey](https://www.greasespot.net/)

### 从 Greasy Fork 安装（推荐）

👉 **[点击这里一键安装](https://greasyfork.org/zh-CN/scripts/557046-minimax-dialogue-exporter)**

## 🎮 使用方法

1. 打开 MiniMax Agent 对话页面
2. ⚠️ **重要**：分享页面是演示动画，请**等待动画播放开始前或完成后**操作
3. 页面右下角有两个按钮：
   - **📥 导出文件**：将对话导出为 Markdown 文件（文件名与对话标题一致）
   - **📋 复制内容**：将对话内容复制到剪贴板

> 💡 **提示**：如果提示"未能提取到对话内容"，说明动画还未播放完，请耐心等待页面内容全部加载后再试。

### 示例页面

你可以用以下示例页面测试脚本功能：

🔗 [https://agent.minimaxi.com/share/338376883007833](https://agent.minimaxi.com/share/338376883007833?chat_type=0)

## 📄 导出内容

脚本会提取以下内容类型：

| 类型 | 说明 | Markdown 显示 |
|------|------|-------------|
| 👤 用户消息 | 用户输入的问题或指令 | `## 👤 用户` |
| 🤖 AI 回复 | AI 助手的回答内容 | `## 🤖 AI助手` |
| 💭 思考 | AI 的思考过程 | `<details>` 折叠块 |
| ✅ 已完成任务 | Completed 状态的任务 | `✅ **任务名称**` |
| 🔄 进行中任务 | Ongoing 状态的任务 | `🔄 **任务名称**` |

### 导出示例

```markdown
# 中文学习路线图

> 导出时间：2024/11/27 15:30:00

---

## 👤 用户

帮我生成一个网站，向外国人介绍学习中文的路径...

## 🤖 AI 助手

我已收到您的需求。您希望创建一个类似 roadmap.sh 的中文学习路径网站...

<details>
<summary>💭 思考 2.57s</summary>

我理解您的需求。您想要创建一个类似 roadmap.sh 的网站...

</details>

✅ **Write Todo**

✅ **File Writing** - `/workspace/docs/research_plan.md`
```

## ⚙️ 技术说明

### 支持的页面

- `https://agent.minimaxi.com/share/*` - 分享页面
- `https://agent.minimaxi.com/*` - 所有 MiniMax Agent 页面

### DOM 解析策略

脚本通过以下策略识别和提取内容：

1. **对话区域定位**：通过 `.messages-container` 定位主对话容器
2. **元素类型识别**：
   - 用户消息：`.message.sent` 类 + `.text-pretty` 内容
   - AI 回复：`.message.received` 类 + `.matrix-markdown` 内容
   - 思考块：`.think-container` 容器 + 时间格式
   - 任务块：`.tool-name` 容器 + "已完成"/"正在进行" 状态标记
3. **去重处理**：基于内容摘要去重，避免重复

### 权限说明

```javascript
// @grant GM_download     // 用于下载文件
// @grant GM_setClipboard // 用于复制到剪贴板
```

## 🔧 自定义配置

如需修改按钮样式或行为，可编辑脚本中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    buttonId: 'minimax-export-btn',
    buttonStyle: {
        position: 'fixed',
        bottom: '20px',      // 按钮距底部距离
        right: '20px',       // 按钮距右侧距离
        backgroundColor: '#4F46E5', // 按钮颜色
        // ... 其他样式
    }
};
```

## 📋 更新日志

### v3.2.0 (2024-11-27)

- 🏗️ **层级结构支持**：根据 DOM 结构识别对话层级
- 📊 **高级任务识别**：深度研究任务、浏览器代理等作为独立章节（### 三级标题）
- 🔗 **子任务层级**：一级子任务（padding-left: 32px）、二级内容（padding-left: 64px）
- 📝 **优化 Markdown 输出**：根据层级生成对应级别的标题

### v3.1.0 (2024-11-27)

- ✨ **双按钮功能**：新增独立的"导出文件"和"复制内容"按钮
- 📥 **导出文件**：文件名自动匹配对话标题
- 📋 **复制内容**：一键复制 Markdown 到剪贴板
- 🎨 **优化按钮样式**：两个按钮使用不同颜色区分功能

### v3.0.0 (2024-11-27)

- 🔧 **完全重写 DOM 解析逻辑**：基于实际 HTML 结构精确定位元素
- ✨ **支持演示动画页面**：正确处理分享页面的动态加载内容
- 🎯 **精准选择器**：使用 `.messages-container`、`.message.sent/received`、`.think-container`、`.tool-name` 等精确选择器
- 📝 **改进思考块提取**：从 `.hidden` 容器中提取完整思考内容
- 🔔 **友好错误提示**：当内容未加载完成时给出明确提示
- 🐛 **增强去重逻辑**：基于内容摘要去重，避免重复

### v2.0.0 (2024-11-27)

- 🔧 **重构 DOM 解析逻辑**：基于实际页面结构重写提取算法
- ✨ **改进用户消息识别**：通过编辑按钮特征准确识别用户输入
- 🎯 **优化思考块提取**：正确解析 "已思考 X.XXs" 格式
- 📝 **增强任务提取**：支持 "已完成"/"正在进行" 中文状态
- 🔔 **添加导出提示**：成功导出时显示 Toast 提示
- 🐛 **修复重复内容**：改进去重逻辑，避免内容重复

### v1.0.0 (2024-11-27)

- 🎉 首次发布
- ✅ 支持导出对话、思考、任务内容
- ✅ 自动识别对话标题作为文件名
- ✅ Markdown 格式导出
- ✅ 复制到剪贴板功能

## 🔗 相关链接

- **Greasy Fork**: [https://greasyfork.org/zh-CN/scripts/557046-minimax-dialogue-exporter](https://greasyfork.org/zh-CN/scripts/557046-minimax-dialogue-exporter)
- **GitHub**: [https://github.com/AustinXT/minimax-dialogue-exporter](https://github.com/AustinXT/minimax-dialogue-exporter)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

- 🐛 [报告 Bug](https://github.com/AustinXT/minimax-dialogue-exporter/issues)
- 💡 [功能建议](https://github.com/AustinXT/minimax-dialogue-exporter/issues)
- 📝 [Greasy Fork 反馈](https://greasyfork.org/zh-CN/scripts/557046-minimax-dialogue-exporter/feedback)

## 📄 许可证

MIT License

---

Made with ❤️ for MiniMax Agent users
