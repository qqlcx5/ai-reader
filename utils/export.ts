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
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  // Title in bold
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, pageWidth - 20);
  for (const line of titleLines) {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
    doc.text(line, 10, y);
    y += 8;
  }
  doc.setFont('helvetica', 'normal');
  y += 4;

  for (const s of summaries) {
    // Model name in bold
    if (y > 270) {
      doc.addPage();
      y = 10;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${s.providerId} (${s.modelId})`, 10, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(s.text, pageWidth - 20);
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

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
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
