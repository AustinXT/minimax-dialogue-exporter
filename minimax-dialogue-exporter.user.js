// ==UserScript==
// @name         MiniMax Dialogue Exporter
// @namespace    https://agent.minimaxi.com/
// @version      3.2.1
// @description  导出 MiniMax Agent 对话内容为 Markdown 格式，包括对话、Task 和 Thinking
// @author       AIPD01
// @match        https://agent.minimaxi.com/*
// @icon         https://agent.minimaxi.com/favicon.ico
// @grant        GM_download
// @grant        GM_setClipboard
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        containerId: 'minimax-export-container',
        exportBtnId: 'minimax-export-btn',
        copyBtnId: 'minimax-copy-btn'
    };

    // 创建按钮容器
    function createButtonContainer() {
        if (document.getElementById(CONFIG.containerId)) return;

        // 创建容器
        const container = document.createElement('div');
        container.id = CONFIG.containerId;
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        // 创建导出按钮
        const exportBtn = createButton(CONFIG.exportBtnId, '📥 导出文件', '#4F46E5', exportToFile);
        
        // 创建复制按钮
        const copyBtn = createButton(CONFIG.copyBtnId, '📋 复制内容', '#10B981', copyToClipboard);

        container.appendChild(exportBtn);
        container.appendChild(copyBtn);
        document.body.appendChild(container);
    }

    // 创建单个按钮
    function createButton(id, text, bgColor, onClick) {
        const button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        button.style.cssText = `
            padding: 12px 20px;
            background-color: ${bgColor};
            color: #ffffff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px ${bgColor}66;
            transition: all 0.3s ease;
            white-space: nowrap;
        `;

        const hoverColor = adjustColor(bgColor, -20);
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
            button.style.transform = 'translateY(-2px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = bgColor;
            button.style.transform = 'translateY(0)';
        });

        button.addEventListener('click', onClick);
        return button;
    }

    // 调整颜色亮度
    function adjustColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    }

    // 获取对话标题
    function getDialogueTitle() {
        // 从页面标题获取，格式通常是 "标题 - MiniMax Agent"
        const pageTitle = document.title;
        const titleMatch = pageTitle.match(/^(.+?)\s*-\s*MiniMax Agent$/);
        if (titleMatch) {
            return titleMatch[1].trim();
        }
        // 备用：从 URL 的 share ID 生成
        const urlMatch = window.location.pathname.match(/\/share\/(\d+)/);
        if (urlMatch) {
            return `MiniMax 对话_${urlMatch[1]}`;
        }
        return `MiniMax 对话_${new Date().toISOString().slice(0, 10)}`;
    }

    // 清理文本
    function cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim();
    }

    // 获取元素的缩进层级 (基于 padding-left)
    function getIndentLevel(element) {
        const style = element.getAttribute('style') || '';
        const paddingMatch = style.match(/padding-left:\s*(\d+)px/);
        if (paddingMatch) {
            const padding = parseInt(paddingMatch[1]);
            if (padding >= 64) return 2;  // 二级子内容
            if (padding >= 32) return 1;  // 一级子任务
        }
        return 0;  // 顶层
    }

    // 主提取函数 - 基于实际 DOM 结构，支持层级
    function extractDialogueFromDOM() {
        const items = [];
        
        // 找到主对话容器
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) {
            console.warn('未找到 .messages-container');
            return items;
        }

        // 获取所有消息块 - 直接子元素中包含 .message 的
        const allMessages = messagesContainer.querySelectorAll('.message.sent, .message.received');
        
        if (allMessages.length === 0) {
            console.warn('未找到消息元素');
            return items;
        }

        const processedTexts = new Set(); // 用于去重

        allMessages.forEach((messageEl, index) => {
            const isSent = messageEl.classList.contains('sent');
            const isReceived = messageEl.classList.contains('received');
            
            // 获取层级
            const level = getIndentLevel(messageEl);

            if (isSent) {
                // 用户消息
                const userContent = extractUserMessageContent(messageEl);
                if (userContent && !processedTexts.has(userContent)) {
                    items.push({
                        type: 'user',
                        content: userContent,
                        level: 0  // 用户消息始终是顶层
                    });
                    processedTexts.add(userContent);
                }
            } else if (isReceived) {
                // AI 响应 - 可能包含多种内容
                const receivedItems = extractReceivedContent(messageEl, processedTexts, level);
                items.push(...receivedItems);
            }
        });

        return items;
    }

    // 提取用户消息内容
    function extractUserMessageContent(messageEl) {
        // 用户消息结构：.message.sent > .message-content > .text-pretty
        const textPretty = messageEl.querySelector('.text-pretty');
        if (textPretty) {
            return cleanText(textPretty.textContent || '');
        }
        
        // 备用：直接获取 .message-content 的文本
        const messageContent = messageEl.querySelector('.message-content');
        if (messageContent) {
            return cleanText(messageContent.textContent || '');
        }
        
        return '';
    }

    // 提取 AI 响应内容（received 消息）
    function extractReceivedContent(messageEl, processedTexts, level) {
        const items = [];

        // 1. 检查是否是思考块
        const thinkContainer = messageEl.querySelector('.think-container');
        if (thinkContainer) {
            const thinkingItem = extractThinkingBlock(thinkContainer, processedTexts, level);
            if (thinkingItem) {
                items.push(thinkingItem);
            }
            
            // 思考块后面可能还有正文内容
            const matrixMarkdown = messageEl.querySelector('.matrix-markdown');
            if (matrixMarkdown) {
                const textItems = extractMarkdownContent(matrixMarkdown, processedTexts, true, level);
                items.push(...textItems);
            }
            return items;
        }

        // 2. 检查是否是工具调用
        const toolName = messageEl.querySelector('.tool-name');
        if (toolName) {
            const toolItem = extractToolBlock(messageEl, processedTexts, level);
            if (toolItem) {
                items.push(toolItem);
            }
            return items;
        }

        // 3. 普通 AI 响应 - 提取 matrix-markdown 内容
        const matrixMarkdown = messageEl.querySelector('.matrix-markdown');
        if (matrixMarkdown) {
            const textItems = extractMarkdownContent(matrixMarkdown, processedTexts, false, level);
            items.push(...textItems);
        }

        return items;
    }

    // 提取思考块内容
    function extractThinkingBlock(thinkContainer, processedTexts, level = 0) {
        // 获取思考时间
        let duration = '';
        const durationSpan = thinkContainer.querySelector('span');
        if (durationSpan) {
            const timeText = durationSpan.textContent;
            const timeMatch = timeText.match(/(\d+\.?\d*)s/);
            if (timeMatch) {
                duration = `${timeMatch[1]}s`;
            }
        }

        // 获取思考内容 - 在 .hidden 内的 .relative.pl-5 中
        let content = '';
        const hiddenDiv = thinkContainer.querySelector('.hidden');
        if (hiddenDiv) {
            const contentDiv = hiddenDiv.querySelector('.relative.pl-5, [class*="pl-5"]');
            if (contentDiv) {
                content = extractTextFromElement(contentDiv);
            } else {
                // 备用：直接获取 hidden div 的文本
                content = extractTextFromElement(hiddenDiv);
            }
        }

        const key = `thinking:${duration}:${content.slice(0, 50)}`;
        if (processedTexts.has(key)) return null;
        processedTexts.add(key);

        return {
            type: 'thinking',
            duration: duration,
            content: content || null,
            level: level
        };
    }

    // 提取工具调用块
    function extractToolBlock(messageEl, processedTexts, level = 0) {
        const toolNameEl = messageEl.querySelector('.tool-name');
        if (!toolNameEl) return null;

        const fullText = toolNameEl.textContent.trim();
        
        // 检查是否是高级任务（深度研究任务、浏览器代理等）
        const isAgentTask = toolNameEl.classList.contains('tool-agent-name');
        if (isAgentTask) {
            // 高级任务 - 作为章节标题
            const agentTaskName = fullText;
            const key = `agent:${agentTaskName}`;
            if (processedTexts.has(key)) return null;
            processedTexts.add(key);
            
            return {
                type: 'agent_task',
                name: agentTaskName,
                level: level
            };
        }
        
        // 判断状态
        const isCompleted = fullText.includes('已完成') || fullText.includes('Completed');
        const isOngoing = fullText.includes('正在进行') || fullText.includes('Ongoing');
        
        if (!isCompleted && !isOngoing) return null;

        // 提取动作名称 - 在 span 中
        let action = '';
        const actionSpans = toolNameEl.querySelectorAll('span');
        actionSpans.forEach(span => {
            const spanText = span.textContent.trim();
            if (spanText && !spanText.match(/^\d/) && spanText.length > 2) {
                if (spanText.includes('已完成') || spanText.includes('正在进行')) {
                    action = spanText;
                }
            }
        });

        if (!action) {
            // 从全文提取
            action = fullText
                .replace(/已完成|正在进行|Completed|Ongoing/g, '')
                .trim()
                .split('\n')[0]
                .trim();
        }

        // 提取详细信息（如文件路径）
        let detail = '';
        const detailDiv = toolNameEl.querySelector('[class*="text-col_text01"]');
        if (detailDiv) {
            detail = detailDiv.textContent.trim();
        } else {
            // 从全文提取路径
            const pathMatch = fullText.match(/(\/[\w\-\/\.]+)/);
            if (pathMatch) {
                detail = pathMatch[1];
            }
        }

        // 清理 action
        action = action.replace(detail, '').trim();
        if (!action || action.length < 2) {
            action = fullText.split('\n')[0].replace(/已完成|正在进行/g, '').trim();
        }

        const key = `task:${action}:${detail}`;
        if (processedTexts.has(key)) return null;
        processedTexts.add(key);

        return {
            type: 'task',
            status: isCompleted ? 'completed' : 'ongoing',
            action: action,
            detail: detail,
            level: level
        };
    }

    // 提取Markdown内容
    function extractMarkdownContent(matrixMarkdown, processedTexts, skipThinking, level = 0) {
        const items = [];
        
        // 提取纯文本内容（排除思考块）
        const text = extractTextFromElementExcluding(matrixMarkdown, skipThinking ? '.think-container' : null);
        if (text && text.length > 5) {
            const key = `assistant:${text.slice(0, 100)}`;
            if (!processedTexts.has(key)) {
                items.push({
                    type: 'assistant',
                    content: text,
                    level: level
                });
                processedTexts.add(key);
            }
        }

        return items;
    }
    
    // 从元素提取文本（可排除指定选择器）
    function extractTextFromElementExcluding(element, excludeSelector) {
        if (!element) return '';
        
        let text = '';
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 跳过 SVG 内的文本
                    if (node.parentElement?.closest('svg')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // 跳过排除选择器内的文本
                    if (excludeSelector && node.parentElement?.closest(excludeSelector)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // 跳过空文本
                    if (!node.textContent.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let currentNode;
        while (currentNode = walker.nextNode()) {
            const nodeText = currentNode.textContent.trim();
            // 跳过仅包含时间格式的节点
            if (nodeText && !nodeText.match(/^\d+\.?\d*s$/)) {
                text += nodeText + ' ';
            }
        }

        return cleanText(text);
    }

    // 从元素提取文本（处理嵌套结构）
    function extractTextFromElement(element) {
        if (!element) return '';
        
        let text = '';
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 跳过 SVG 内的文本
                    if (node.parentElement?.closest('svg')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // 跳过空文本
                    if (!node.textContent.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent.trim();
            // 跳过仅包含时间格式的节点
            if (nodeText && !nodeText.match(/^\d+\.?\d*s$/)) {
                text += nodeText + ' ';
            }
        }

        return cleanText(text);
    }

    // 去重
    function deduplicateItems(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.type + ':' + (item.content?.slice(0, 50) || item.action || '');
            if (seen.has(key)) return false;
            if (key.length < 5) return false;
            seen.add(key);
            return true;
        });
    }

    // 转换为Markdown
    function convertToMarkdown(title, items) {
        let markdown = `# ${title}\n\n`;
        markdown += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
        markdown += `> 导出条数: ${items.length} 条\n`;
        markdown += `> 来源: ${window.location.href}\n\n`;
        markdown += `---\n\n`;

        let currentRole = '';
        let currentLevel = 0;
        let assistantContentBuffer = [];

        const flushAssistantBuffer = () => {
            if (assistantContentBuffer.length > 0) {
                markdown += assistantContentBuffer.join('\n\n') + '\n\n';
                assistantContentBuffer = [];
            }
        };

        // 根据层级获取标题前缀
        const getHeadingPrefix = (baseLevel, itemLevel) => {
            // baseLevel: 2 = ##, 3 = ###, 4 = ####
            const totalLevel = baseLevel + itemLevel;
            return '#'.repeat(Math.min(totalLevel, 6)); // 最多 6 级标题
        };

        items.forEach((item, index) => {
            const level = item.level || 0;
            
            switch (item.type) {
                case 'user':
                    flushAssistantBuffer();
                    markdown += `## 👤 用户\n\n`;
                    markdown += `${item.content}\n\n`;
                    currentRole = 'user';
                    currentLevel = 0;
                    break;

                case 'agent_task':
                    // 高级任务（深度研究任务、浏览器代理等）- 作为三级标题
                    flushAssistantBuffer();
                    const agentHeading = getHeadingPrefix(3, level);
                    markdown += `${agentHeading} 🔄 ${item.name}\n\n`;
                    currentRole = 'agent';
                    currentLevel = level;
                    break;

                case 'assistant':
                    // 根据层级决定是否需要新的标题
                    if (currentRole !== 'assistant' || level !== currentLevel) {
                        flushAssistantBuffer();
                        if (level === 0) {
                            markdown += `## 🤖 AI助手\n\n`;
                        } else if (level === 1) {
                            // 一级子任务的 AI 响应
                            markdown += `#### 📌 子任务响应\n\n`;
                        }
                        // level >= 2 的内容不加标题，直接作为正文
                        currentRole = 'assistant';
                        currentLevel = level;
                    }
                    assistantContentBuffer.push(item.content);
                    break;

                case 'thinking':
                    flushAssistantBuffer();
                    markdown += `<details>\n`;
                    markdown += `<summary>💭 思考过程 ${item.duration || ''}</summary>\n\n`;
                    if (item.content) {
                        markdown += `${item.content}\n\n`;
                    } else {
                        markdown += `*(思考内容未展开)*\n\n`;
                    }
                    markdown += `</details>\n\n`;
                    currentRole = '';
                    break;

                case 'task':
                    flushAssistantBuffer();
                    const statusIcon = item.status === 'completed' ? '✅' : '🔄';
                    // 根据层级添加缩进
                    const indent = level > 0 ? '  '.repeat(level) : '';
                    markdown += `${indent}${statusIcon} **${item.action}**`;
                    if (item.detail) {
                        markdown += ` \`${item.detail}\``;
                    }
                    markdown += `\n\n`;
                    currentRole = '';
                    break;
            }
        });

        flushAssistantBuffer();
        return markdown;
    }

    // 备用提取方法 - 基于类名扫描
    function extractDialogueFromClasses() {
        const items = [];
        const processedTexts = new Set();

        // 1. 提取所有 .text-pretty 作为可能的用户消息
        document.querySelectorAll('.message.sent .text-pretty').forEach(el => {
            const text = cleanText(el.textContent || '');
            if (text && text.length > 2 && !processedTexts.has(text)) {
                items.push({ type: 'user', content: text, level: 0 });
                processedTexts.add(text);
            }
        });

        // 2. 提取高级任务（深度研究任务等）
        document.querySelectorAll('.tool-agent-name').forEach(el => {
            const text = el.textContent.trim();
            const key = `agent:${text}`;
            if (text && !processedTexts.has(key)) {
                const messageEl = el.closest('.message');
                const level = messageEl ? getIndentLevel(messageEl) : 0;
                items.push({ type: 'agent_task', name: text, level: level });
                processedTexts.add(key);
            }
        });

        // 3. 提取思考块
        document.querySelectorAll('.think-container').forEach(el => {
            const messageEl = el.closest('.message');
            const level = messageEl ? getIndentLevel(messageEl) : 0;
            const item = extractThinkingBlock(el, processedTexts, level);
            if (item) items.push(item);
        });

        // 4. 提取工具调用
        document.querySelectorAll('.tool-name:not(.tool-agent-name)').forEach(el => {
            const messageEl = el.closest('.message');
            if (messageEl) {
                const level = getIndentLevel(messageEl);
                const item = extractToolBlock(messageEl, processedTexts, level);
                if (item) items.push(item);
            }
        });

        // 5. 提取 AI 响应文本
        document.querySelectorAll('.message.received .matrix-markdown').forEach(el => {
            // 跳过思考块内的
            if (el.closest('.think-container')) return;
            
            const messageEl = el.closest('.message');
            const level = messageEl ? getIndentLevel(messageEl) : 0;
            
            const text = extractTextFromElement(el);
            if (text && text.length > 10 && !processedTexts.has(text.slice(0, 100))) {
                items.push({ type: 'assistant', content: text, level: level });
                processedTexts.add(text.slice(0, 100));
            }
        });

        return items;
    }

    // 获取提取结果
    function getExtractedContent() {
        const title = getDialogueTitle();
        
        // 首先尝试 DOM 结构提取
        let items = extractDialogueFromDOM();
        
        // 如果结果太少，使用备用方法
        if (items.length < 3) {
            console.log('DOM提取结果较少，尝试备用方法...');
            items = extractDialogueFromClasses();
        }

        // 去重
        items = deduplicateItems(items);

        return { title, items };
    }

    // 导出到文件
    function exportToFile() {
        try {
            const { title, items } = getExtractedContent();

            if (items.length === 0) {
                alert('未能提取到对话内容。\n\n⚠️ 提示：\n1. 此页面是演示动画，请等待动画播放完成后再导出\n2. 确保页面已完全加载\n3. 如果仍无法导出，请尝试刷新页面');
                return;
            }

            const markdown = convertToMarkdown(title, items);
            
            // 下载文件
            downloadMarkdown(title, markdown);

            console.log(`✅ 成功导出 ${items.length} 条对话内容到文件`);
            showToast(`已导出 ${items.length} 条内容到文件`);
            
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        }
    }

    // 复制到剪贴板
    function copyToClipboard() {
        try {
            const { title, items } = getExtractedContent();

            if (items.length === 0) {
                alert('未能提取到对话内容。\n\n⚠️ 提示：\n1. 此页面是演示动画，请等待动画播放完成后再导出\n2. 确保页面已完全加载\n3. 如果仍无法导出，请尝试刷新页面');
                return;
            }

            const markdown = convertToMarkdown(title, items);
            
            // 复制到剪贴板
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(markdown, 'text');
                console.log(`✅ 成功复制 ${items.length} 条对话内容到剪贴板`);
                showToast(`已复制 ${items.length} 条内容到剪贴板`);
            } else {
                navigator.clipboard.writeText(markdown).then(() => {
                    console.log(`✅ 成功复制 ${items.length} 条对话内容到剪贴板`);
                    showToast(`已复制 ${items.length} 条内容到剪贴板`);
                }).catch(e => {
                    console.error('复制到剪贴板失败：', e);
                    alert('复制失败，请重试');
                });
            }
            
        } catch (error) {
            console.error('复制失败：', error);
            alert('复制失败：' + error.message);
        }
    }

    // 显示提示
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #10B981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            animation: fadeInOut 2s ease forwards;
        `;
        
        // 添加动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(10px); }
                15% { opacity: 1; transform: translateY(0); }
                85% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
            style.remove();
        }, 2000);
    }

    // 下载 Markdown 文件
    function downloadMarkdown(title, content) {
        const filename = sanitizeFilename(title) + '.md';
        
        // 使用 Data URL 方式下载（兼容性最好）
        try {
            // 将内容转换为 Base64
            const base64Content = btoa(unescape(encodeURIComponent(content)));
            const dataUrl = `data:text/markdown;charset=utf-8;base64,${base64Content}`;
            
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            // 延迟移除元素
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
            
            console.log(`📥 正在下载：${filename}`);
        } catch (e) {
            console.error('Data URL 下载失败，尝试 Blob 方式：', e);
            
            // 备用方案：使用 Blob URL
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    }

    // 清理文件名
    function sanitizeFilename(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 100);
    }

    // 初始化
    function init() {
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createButtonContainer);
        } else {
            createButtonContainer();
        }

        // 监听 URL 变化（SPA 应用）
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(createButtonContainer, 1000);
            }
        }).observe(document.body, { subtree: true, childList: true });
    }

    init();
})();
