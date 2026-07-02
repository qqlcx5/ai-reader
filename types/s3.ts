/** Device-local S3 connection config. Never synced across devices. */
export interface S3Config {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  basePath: string
  enabled: boolean
  /** Use path-style addressing (true for MinIO / non-AWS endpoints). */
  forcePathStyle: boolean
  /** Max timestamped backup snapshots to keep on the remote (default 10). */
  maxBackups?: number
}
