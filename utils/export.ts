import jsPDF from 'jspdf';

interface ModelSummary {
  providerId: string;
  modelId: string;
  text: string;
}

export function toMarkdown(title: string, url: string, summaries: ModelSummary[]): string {
  let md = `# ${title}\n\n> Source: ${url}\n\n---\n\n`;
  for (const s of summaries) {
    md += `## ${s.providerId} (${s.modelId})\n\n${s.text}\n\n---\n\n`;
  }
  return md;
}

export function toPDF(title: string, summaries: ModelSummary[]): void {
  const doc = new jsPDF();
  let y = 10;

  doc.setFontSize(16);
  doc.text(title, 10, y);
  y += 10;

  for (const s of summaries) {
    doc.setFontSize(12);
    doc.text(`${s.providerId} (${s.modelId})`, 10, y);
    y += 8;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(s.text, 180);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
      doc.text(line, 10, y);
      y += 5;
    }
    y += 5;
  }

  doc.save(`${title.slice(0, 50)}.pdf`);
}

export function toObsidianUri(title: string, summaries: ModelSummary[]): string {
  let content = `# ${title}\n\n`;
  for (const s of summaries) {
    content += `## ${s.providerId} (${s.modelId})\n\n${s.text}\n\n---\n\n`;
  }
  // URI length limit workaround: if content is too long, use clipboard
  if (content.length > 4000) {
    // Return a special marker that the caller should handle
    return 'clipboard:' + content;
  }
  const params = new URLSearchParams({ name: title, content });
  return `obsidian://new?${params.toString()}`;
}

export async function toNotion(title: string, summaries: ModelSummary[]): Promise<void> {
  let markdown = `# ${title}\n\n`;
  for (const s of summaries) {
    markdown += `## ${s.providerId} (${s.modelId})\n\n${s.text}\n\n---\n\n`;
  }
  await navigator.clipboard.writeText(markdown);
}
