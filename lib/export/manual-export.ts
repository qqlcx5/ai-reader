import JSZip from 'jszip';
import { collectBackupSnapshot } from './backup';
import { pageRepo } from '@/modules/storage/repositories/page.repo';

/** Trigger a browser download via an anchor element */
function downloadFile(filename: string, content: string | Blob, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Export full JSON backup (including pages) */
export async function exportJson(): Promise<void> {
  const snapshot = await collectBackupSnapshot();
  const pages = await pageRepo.listRecent({ limit: 10000 });
  const full = { ...snapshot, pages };
  const filename = `readchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  downloadFile(filename, JSON.stringify(full, null, 2), 'application/json');
}

/** Export ZIP backup (backup.json + pages/ directory with one .md per page) */
export async function exportZipWithPages(): Promise<void> {
  const snapshot = await collectBackupSnapshot();
  const pages = await pageRepo.listRecent({ limit: 10000 });
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify({ ...snapshot, pages }, null, 2));
  const pagesFolder = zip.folder('pages')!;
  for (const page of pages) {
    const safe = page.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 50);
    const mdContent = `# ${page.title}\n\nURL: ${page.url}\n\n---\n\n${page.content.rawText}`;
    pagesFolder.file(`${page.id}-${safe}.md`, mdContent);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `readchat-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  downloadFile(filename, blob, 'application/zip');
}
