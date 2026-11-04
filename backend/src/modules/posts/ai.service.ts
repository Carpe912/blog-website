/**
 * AiService — 调用 DeepSeek 模型完成文章相关能力
 *
 * 目前提供两项能力：
 *  - 自动生成文章摘要（后台保存文章时使用）
 *  - 提取语义关键词（用于相关文章推荐）
 *
 * 使用 DeepSeek 的 OpenAI 兼容接口，无需额外 SDK。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  // ── 私有：调用 DeepSeek 对话接口 ─────────────────────────────────────────
  private async chat(prompt: string, maxTokens: number): Promise<string> {
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
        temperature: 0.7,
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
