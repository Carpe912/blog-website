/**
 * EmbeddingService — 文本向量化（OpenAI 兼容接口）
 *
 * 用途：给「相关文章」提供语义相似度，用来给已经通过关键词门槛的候选排序。
 *
 * 默认配置与 CodeLens 项目保持一致（阿里百炼 DashScope）：
 *   EMBED_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
 *   EMBED_MODEL=qwen3.7-text-embedding
 *   EMBED_DIMENSIONS=1536
 *
 * 未配置 EMBED_API_KEY 时不报错，只是 embedMany 返回 null，
 * 调用方自动退回纯关键词排序。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 单条文本送入模型的最大字符数，超长截断（模型约 8192 token） */
const MAX_CHARS = 8000;
/** 单次请求最多几条文本，避免超过服务商批量上限 */
const BATCH_SIZE = 10;
/** 单次请求超时（毫秒） */
const TIMEOUT_MS = 12000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string | null;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly dimensions: number;

  /** 文本 → 向量，避免同一篇文章反复计费 */
  private readonly cache = new Map<string, number[]>();
  private static readonly CACHE_LIMIT = 500;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('EMBED_API_KEY') ??
      this.configService.get<string>('DASHSCOPE_API_KEY') ??
      null;
    this.baseURL =
      this.configService.get<string>('EMBED_BASE_URL') ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model =
      this.configService.get<string>('EMBED_MODEL') ?? 'qwen3.7-text-embedding';
    this.dimensions = Number(this.configService.get<string>('EMBED_DIMENSIONS') ?? 1536);

    if (!this.apiKey) {
      this.logger.warn('未配置 EMBED_API_KEY，相关文章将退回纯关键词排序');
    }
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * 批量取向量；任何一条失败就整体返回 null，让调用方降级
   */
  async embedMany(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.apiKey || texts.length === 0) return texts.map(() => null);

    const result: (number[] | null)[] = new Array(texts.length).fill(null);
    const pending: { index: number; text: string }[] = [];

    texts.forEach((text, index) => {
      const key = this.normalize(text);
      const hit = this.cache.get(key);
      if (hit) result[index] = hit;
      else pending.push({ index, text: key });
    });

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        const vectors = await this.request(batch.map((b) => b.text));
        batch.forEach((item, j) => {
          const vec = vectors[j];
          if (!vec) return;
          result[item.index] = vec;
          this.remember(item.text, vec);
        });
      } catch (err) {
        this.logger.warn(`向量化失败，本次降级为关键词排序：${(err as Error).message}`);
        return texts.map((_, idx) => result[idx]);
      }
    }

    return result;
  }

  private async request(inputs: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseURL.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: inputs,
          dimensions: this.dimensions,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        throw new Error(`HTTP ${res.status} ${detail}`);
      }

      const json: any = await res.json();
      return (json?.data ?? []).map((d: any) => d.embedding as number[]);
    } finally {
      clearTimeout(timer);
    }
  }

  private normalize(text: string): string {
    const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
    return trimmed.slice(0, MAX_CHARS);
  }

  private remember(text: string, vec: number[]) {
    if (this.cache.size >= EmbeddingService.CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(text, vec);
  }
}

/** 余弦相似度，向量长度不一致时返回 0 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
