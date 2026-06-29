// The `webdav` package only ships types for the node entry (`webdav`); the
// browser build lives at `webdav/web` without a types entry. Declare the
// subset we use so imports stay typed.
declare module 'webdav/web' {
  export interface WebDAVClientOptions {
    username?: string
    password?: string
    headers?: Record<string, string>
  }

  export interface WebDAVClient {
    exists(path: string): Promise<boolean>
    createDirectory(path: string, options?: { recursive?: boolean }): Promise<void>
    putFileContents(
      path: string,
      data: string | ArrayBuffer,
      options?: { overwrite?: boolean },
    ): Promise<boolean>
    getFileContents(
      path: string,
      options?: { format?: 'text' | 'binary' },
    ): Promise<string | ArrayBuffer>
    deleteFile(path: string): Promise<void>
  }

  export function createClient(url: string, options?: WebDAVClientOptions): WebDAVClient
}
