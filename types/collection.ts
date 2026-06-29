export interface CollectionEntity {
  id: string

  name: string
  description?: string

  createdAt: string
  updatedAt: string
}

export interface CollectionItemEntity {
  id: string

  collectionId: string
  documentId: string

  /** Position within the collection (0-based, ascending = reading order). */
  order: number

  addedAt: string
}
