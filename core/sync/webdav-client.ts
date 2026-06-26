export interface WebDAVOptions {
  serverUrl: string;
  username: string;
  password: string;
}

function getAuthHeader(options: WebDAVOptions): string {
  return `Basic ${btoa(`${options.username}:${options.password}`)}`;
}

export async function propfind(options: WebDAVOptions, path: string): Promise<Response> {
  const url = `${options.serverUrl.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: getAuthHeader(options),
      Depth: '1',
    },
  });
}

export async function mkcol(options: WebDAVOptions, path: string): Promise<Response> {
  const url = `${options.serverUrl.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    method: 'MKCOL',
    headers: {
      Authorization: getAuthHeader(options),
    },
  });
}

export async function put(
  options: WebDAVOptions,
  path: string,
  data: string | Blob,
  contentType = 'application/octet-stream',
): Promise<Response> {
  const url = `${options.serverUrl.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: getAuthHeader(options),
      'Content-Type': contentType,
    },
    body: data,
  });
}

export async function get(options: WebDAVOptions, path: string): Promise<Response> {
  const url = `${options.serverUrl.replace(/\/$/, '')}${path}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(options),
    },
  });
}

export async function gzipCompress(data: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(data)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function gzipDecompress(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(stream);
  return response.text();
}
