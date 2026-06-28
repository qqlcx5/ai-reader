/**
 * Generic repository interface for IndexedDB-backed entities.
 * All repositories implement this contract.
 */
export interface IRepository<T> {
  findById(id: string): Promise<T | undefined>
  findAll(): Promise<T[]>
  save(entity: T): Promise<T>
  delete(id: string): Promise<void>
  count(): Promise<number>
}
