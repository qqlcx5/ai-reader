import jsPDF from 'jspdf';

export function toMarkdown(title: string, content: string, url: string): string {
  return `# ${title}\n\n> Source: ${url}\n\n${content}`;
}

export function toPDF(title: string, content: string): void {
  const doc = new jsPDF();
  const lines = doc.splitTextToSize(content, 180);
  doc.text(title, 10, 10);
  doc.text(lines, 10, 20);
  doc.save(`${title.slice(0, 50)}.pdf`);
}

export function toObsidianUri(title: string, content: string, vault: string = ''): string {
  const params = new URLSearchParams({
    name: title,
    content: `# ${title}\n\n${content}`,
  });
  if (vault) params.set('vault', vault);
  return `obsidian://new?${params.toString()}`;
}

export async function toNotion(title: string, content: string): Promise<void> {
  const markdown = `# ${title}\n\n${content}`;
  await navigator.clipboard.writeText(markdown);
}
