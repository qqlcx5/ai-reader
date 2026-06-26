import type { Article } from './types'

export const currentPage: Article = {
  id: 'current-vercel-ai-native',
  title: 'The architecture behind modern AI-native web applications',
  siteName: 'Vercel Blog',
  siteLetter: 'V',
  url: 'https://vercel.com/blog/ai-native-web-apps',
  author: 'Lee Robinson',
  publishedAt: '2025-02-18',
  createdAt: '刚刚',
  excerpt: '现代 AI 应用不再只是包裹模型 API 的表单，而是由网页提取、上下文整理、模型调用、本地存储和阅读界面组成的连续工作流。',
  markdown: `## Overview

Modern AI-native applications are no longer simple forms wrapped around a model API. They are multi-layer systems where extraction, memory, reasoning and user interface are connected as one continuous workflow.

## Browser Extension Boundary

好的插件不应该把所有能力都塞进 Popup。Popup 适合做高频动作：识别当前网页、提取正文、保存、复制和跳转。

## Core Pipeline

- 使用 defuddle 提取正文
- 读取标题、URL、站点名、发布时间和作者
- 调用 createMarkdownContent() 生成 Markdown
- 保存到 IndexedDB
- 在阅读器中展示 Markdown 内容`,
}

export const demoArticles: Article[] = [
  {
    id: 'local-first-tools',
    title: 'Designing better local-first tools',
    siteName: 'Notion Blog',
    siteLetter: 'N',
    url: 'https://notion.so/blog/local-first-tools',
    author: 'Notion Design',
    publishedAt: '2025-01-28',
    createdAt: '今天 09:18',
    excerpt: 'Local-first 产品应该让用户感到数据可控、交互即时，并且在离线状态下仍然可靠。',
    markdown: `## Local-first

Local-first software gives users ownership of data while preserving a fast and responsive experience.

## Product Implication

- 数据优先保存在本地
- 同步只是增强能力
- UI 需要明确展示保存状态`,
  },
  {
    id: 'apple-hig-clarity',
    title: 'Human Interface Guidelines and clarity',
    siteName: 'Apple Developer',
    siteLetter: 'A',
    url: 'https://developer.apple.com/design/human-interface-guidelines',
    author: 'Apple',
    publishedAt: '2024-12-16',
    createdAt: '昨天',
    excerpt: '清晰、层级、留白和动效共同决定了一个界面的高级感。',
    markdown: `## Clarity

Apple interface design favors clarity, deference and depth.

## Principles

- 内容优先
- 控件保持克制
- 动效只为理解服务`,
  },
  {
    id: 'linear-fast-ui',
    title: 'Building fast-feeling interfaces',
    siteName: 'Linear',
    siteLetter: 'L',
    url: 'https://linear.app/blog/fast-feeling-interfaces',
    author: 'Linear Team',
    publishedAt: '2024-11-02',
    createdAt: '2 天前',
    excerpt: '真正快的界面不仅依赖性能，也依赖反馈、过渡、乐观更新和信息密度。',
    markdown: `## Fast-feeling Interfaces

Interfaces feel fast when users receive immediate feedback.

## Tactics

- Optimistic updates
- Skeleton states
- Predictable navigation
- Low visual noise`,
  },
]
