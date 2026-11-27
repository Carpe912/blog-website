/**
 * AiService — 调用 DeepSeek 模型完成文章相关能力
 *
 * 目前提供三项能力：
 *  - 自动生成文章摘要（后台保存文章时使用）
 *  - 提取语义关键词（用于相关文章推荐）
 *  - 生成文章标签（用于归档与分类，不依赖调用方传参）
 *
 * 使用 DeepSeek 的 OpenAI 兼容接口，无需额外 SDK。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TAG_HINTS } from './tag-vocabulary';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | null;
  private readonly baseURL: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') ?? null;
    this.baseURL =
      this.configService.get<string>('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com';
    this.model = this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat';

    if (!this.apiKey) {
      this.logger.warn('未配置 DEEPSEEK_API_KEY，AI 摘要与关键词功能不可用');
    }
  }

  /**
   * 为文章自动生成摘要
   * @returns 60~110 字的中文摘要，失败时返回空字符串
   */
  async generateExcerpt(title: string, content: string): Promise<string> {
    const plain = this.toPlainText(content).slice(0, 4000);
    if (!plain) return '';

    const prompt = `请为下面这篇文章写一段中文摘要，用于博客列表展示。

要求：
- 长度 60 到 110 个汉字，一到两句话
- 直接概括文章的核心内容与价值，不要评价，不要用"本文"开头
- 不要使用 Markdown、引号或换行
- 只输出摘要正文，不要任何解释

标题：${title}
正文：${plain}`;

    try {
      const text = await this.chat(prompt, 300);
      return text
        .replace(/^["'「『]+|["'」』]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
    } catch (err) {
      this.logger.error('AI 摘要生成失败', err);
      return '';
    }
  }

  /**
   * 提取文章的语义关键词
   * @returns 关键词数组（8~12 个），失败时返回空数组
   */
  async extractKeywords(title: string, content: string): Promise<string[]> {
    const plain = this.toPlainText(content).slice(0, 3000);
    if (!plain) return [];

    const prompt = `请从以下文章中提取 8 到 12 个技术关键词/概念，用于相似文章推荐匹配。

要求：
- 只提取具体、明确的技术术语（框架名、库名、算法名、协议名、核心概念等）
- 中文专有名词用中文，英文技术名词保持英文原文（如 React、TCP/IP、B+Tree）
- 排除笼统词汇，如"源码解析"、"教程"、"学习"、"介绍"等
- 直接返回 JSON 数组，不要任何解释或 markdown

文章标题：${title}
文章内容：${plain}

返回格式示例：["React", "Fiber架构", "调度器", "优先级队列", "Reconciler", "虚拟DOM", "diff算法", "concurrent模式"]`;

    try {
      const text = await this.chat(prompt, 256);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const keywords = JSON.parse(match[0]) as unknown[];
      if (!Array.isArray(keywords)) return [];

      return keywords
        .filter((k) => typeof k === 'string' && k.trim().length > 0)
        .map((k) => (k as string).trim())
        .slice(0, 15);
    } catch (err) {
      this.logger.error('AI 关键词提取失败', err);
      return [];
    }
  }

  /**
   * 生成文章的具体标签。只有显式重建词表时才传入固定选项。
   * @returns 至多 3 个标签，失败时返回空数组
   */
  async generateTags(
    title: string,
    content: string,
    vocabulary?: string[],
  ): Promise<string[]> {
    const plain = this.toPlainText(content).slice(0, 3000);
    if (!plain || vocabulary?.length === 0) return [];

    const instructions = vocabulary
      ? `从下列固定词表选 2 到 3 个最贴合文章主线的标签，保留原词：
${vocabulary.map((name) => `- ${name}${TAG_HINTS[name] ? `：${TAG_HINTS[name]}` : ''}`).join('\n')}`
      : `根据本篇文章的主线直接生成 1 到 3 个具体的技术标签，精准度优先。
- 优先使用读者会搜索的框架、协议、算法或具体机制，如「PostgreSQL 索引」「SQLite WAL」「DMN 决策表」
- 避免「源码解析」「软件设计」「前端工程」「Agent 工程」等泛类词，也不选正文只顺带提到的概念
- 采用通用技术术语，同一概念只选一个名称。一个标签足够时就只给一个
- 每个标签最多 24 个字符，不加 # 或解释，不用文章标题或长句当标签`;

    const prompt = `${instructions}

- 直接返回 JSON 数组，不要任何解释或 markdown

文章标题：${title}
文章内容：${plain}`;

    try {
      const text = await this.chat(prompt, 120, 0.3);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const tags = JSON.parse(match[0]) as unknown[];
      if (!Array.isArray(tags)) return [];

      return tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => (t as string).trim())
        .slice(0, 3);
    } catch (err) {
      this.logger.error('AI 标签生成失败', err);
      return [];
    }
  }

  /**
   * 按全部文章重新生成一套精简词表（可合并同义/过细标签）
   * @param posts 全部文章的标题与摘要
   * @param currentTags 现有标签及使用次数，作为合并依据
   */
  async proposeVocabulary(
    posts: { title: string; excerpt?: string | null }[],
    currentTags: { name: string; count: number }[],
  ): Promise<string[]> {
    if (posts.length === 0) return [];

    const titles = posts
      .map((p, i) => `${i + 1}. ${p.title}${p.excerpt ? `（${p.excerpt.slice(0, 40)}）` : ''}`)
      .join('\n')
      .slice(0, 8000);
    const current =
      currentTags
        .filter((t) => t.count > 0)
        .map((t) => `${t.name}(${t.count})`)
        .join('、') || '（暂无）';

    const prompt = `你在维护一个技术博客的标签体系。请根据全部文章，判断现有标签是否需要调整。

要求：
- 如果现有标签已经能覆盖这些文章，就原样返回它们，不要为了改而改
- 只有出现明显的同义/重叠标签，或新文章带来新的主题簇时，才合并、更名或新增
- 输出 8 到 15 个标签，每个 2 到 12 个字
- 标签要「宽」：一个标签能覆盖多篇文章，不要为单篇文章造词
- 英文标签小写，中文保持原样，不要标点
- 只返回 JSON 数组，不要解释

现有标签（使用次数）：${current}

文章标题：
${titles}

返回示例：["deepseek", "harness", "源码解析", "agent工程", "javascript", "浏览器"]`;

    try {
      const text = await this.chat(prompt, 300, 0.2);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const tags = JSON.parse(match[0]) as unknown[];
      if (!Array.isArray(tags)) return [];

      return tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => (t as string).trim())
        .slice(0, 15);
    } catch (err) {
      this.logger.error('AI 词表生成失败', err);
      return [];
    }
  }

  // ── 私有：调用 DeepSeek 对话接口 ─────────────────────────────────────────
  private async chat(prompt: string, maxTokens: number, temperature = 0.7): Promise<string> {
    if (!this.apiKey) return '';

    const res = await fetch(`${this.baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`DeepSeek API ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data: any = await res.json();
    return (data?.choices?.[0]?.message?.content ?? '').trim();
  }

  // ── 私有：HTML / Markdown 转纯文本 ───────────────────────────────────────
  private toPlainText(raw: string): string {
    return raw
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[#*`>|-]{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
