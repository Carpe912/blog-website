/**
 * ClaudeService — 使用 Claude API 从文章中提取语义关键词
 *
 * 提取结果用于相关文章推荐，比标签匹配精确得多。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    const baseURL = this.configService.get<string>('ANTHROPIC_BASE_URL');
    this.model = this.configService.get<string>('CLAUDE_MODEL') ?? 'claude-opus-4-5';

    if (!apiKey) {
      this.logger.warn('未配置 ANTHROPIC_API_KEY，AI 关键词提取功能不可用');
      this.client = null;
    } else {
      this.client = new Anthropic({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
    }
  }

  /**
   * 提取文章的语义关键词
   * @returns 关键词数组（8~12 个），失败时返回空数组
   */
  async extractKeywords(title: string, content: string): Promise<string[]> {
    if (!this.client) return [];

    // 取正文前 3000 字符，避免 token 过多
    const excerpt = content.replace(/<[^>]+>/g, '').slice(0, 3000);

    const prompt = `请从以下文章中提取 8 到 12 个技术关键词/概念，用于相似文章推荐匹配。

要求：
- 只提取具体、明确的技术术语（框架名、库名、算法名、协议名、核心概念等）
- 中文专有名词用中文，英文技术名词保持英文原文（如 React、TCP/IP、B+Tree）
- 排除笼统词汇，如"源码解析"、"教程"、"学习"、"介绍"等
- 直接返回 JSON 数组，不要任何解释或 markdown

文章标题：${title}
文章内容：${excerpt}

返回格式示例：["React", "Fiber架构", "调度器", "优先级队列", "Reconciler", "虚拟DOM", "diff算法", "concurrent模式"]`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

      // 提取 JSON 数组（防止模型多输出了说明文字）
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
}
