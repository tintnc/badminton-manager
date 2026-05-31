import type { IRepository } from './IRepository';

export class LocalRepository<T extends { id: string }> implements IRepository<T> {
  private readonly storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  async getAll(): Promise<T[]> {
    const data = localStorage.getItem(this.storageKey);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<T | undefined> {
    const items = await this.getAll();
    return items.find((item) => item.id === id);
  }

  async save(item: T): Promise<void> {
    const items = await this.getAll();
    const index = items.findIndex((i) => i.id === item.id);
    
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    
    await this.saveAll(items);
  }

  async saveAll(items: T[]): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  async delete(id: string): Promise<void> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.id !== id);
    await this.saveAll(filtered);
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }
}
