import { db } from './schema';
import type { SavedArticle } from '../shared/domain';

export class ArticleRepository {
  async save(article: SavedArticle): Promise<string> {
    await db.articles.put(article);
    return article.id;
  }

  async getById(id: string): Promise<SavedArticle | undefined> {
    return db.articles.get(id);
  }

  async getAll(): Promise<SavedArticle[]> {
    return db.articles.orderBy('createdAt').reverse().toArray();
  }

  async delete(id: string): Promise<void> {
    await db.articles.delete(id);
  }

  async findByUrl(url: string): Promise<SavedArticle | undefined> {
    return db.articles.where('url').equals(url).first();
  }

  async searchByTitle(query: string, limit = 20): Promise<SavedArticle[]> {
    const lower = query.toLowerCase();
    return db.articles
      .filter(
        (a) =>
          a.title.toLowerCase().includes(lower) ||
          a.excerpt.toLowerCase().includes(lower) ||
          a.contentText.toLowerCase().includes(lower),
      )
      .limit(limit)
      .toArray();
  }

  async count(): Promise<number> {
    return db.articles.count();
  }
}

export const articleRepo = new ArticleRepository();
