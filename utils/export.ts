import jsPDF from 'jspdf';

interface ModelSummary {
  providerId: string;
  modelId: string;
  text: string;
}

export function toMarkdown(title: string, url: string, summaries: ModelSummary[]): string {
  let md = `# ${title}\n\n`;
  md += `> Source: [${url}](${url})\n\n`;
  md += `---\n\n`;

  for (const s of summaries) {
    md += `## ${s.providerId} (${s.modelId})\n\n`;
    md += `${s.text}\n\n`;
    md += `---\n\n`;
  }

  return md;
}

export function toPDF(title: string, url: string, summaries: ModelSummary[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, maxWidth);
  for (const line of titleLines) {
    if (y > 275) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += 7;
  }
  y += 3;

  // URL
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  const urlLines = doc.splitTextToSize(url, maxWidth);
  for (const line of urlLines) {
    if (y > 275) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += 4;
  }
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const s of summaries) {
    // Model header
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${s.providerId} (${s.modelId})`, margin, y);
    y += 7;

    // Content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Strip markdown syntax for PDF (basic)
    const plainText = s.text
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    const lines = doc.splitTextToSize(plainText, maxWidth);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;

    // Divider between models
    if (summaries.indexOf(s) < summaries.length - 1) {
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y - 3, pageWidth - margin, y - 3);
      y += 4;
    }
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
  }

  doc.save(`${title.slice(0, 50).replace(/[/\\?%*:|"<>]/g, '-')}.pdf`);
}

export function toObsidianUri(title: string, summaries: ModelSummary[]): string {
  let content = `# ${title}\n\n`;
  for (const s of summaries) {
    content += `## ${s.providerId} (${s.modelId})\n\n${s.text}\n\n---\n\n`;
  }
  // URI length limit workaround: if content is too long, use clipboard
  if (content.length > 4000) {
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

/**
 * Export history entries as CSV.
 */
export interface HistoryCsvRow {
  title: string;
  url: string;
  timestamp: string;
  prompt: string;
  providerId: string;
  modelId: string;
  responseText: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  elapsedMs: number;
  status: string;
}

export function toCsv(rows: HistoryCsvRow[]): string {
  const escapeCsv = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = [
    'Title', 'URL', 'Timestamp', 'Prompt', 'Provider', 'Model',
    'Response', 'Input Tokens', 'Output Tokens', 'Cost (USD)', 'Elapsed (ms)', 'Status',
  ].join(',');

  const lines = rows.map(r => [
    escapeCsv(r.title),
    escapeCsv(r.url),
    escapeCsv(r.timestamp),
    escapeCsv(r.prompt),
    escapeCsv(r.providerId),
    escapeCsv(r.modelId),
    escapeCsv(r.responseText.slice(0, 500)), // Truncate long responses
    r.inputTokens,
    r.outputTokens,
    r.estimatedCost.toFixed(4),
    r.elapsedMs,
    r.status,
  ].join(','));

  return [header, ...lines].join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const BOM = '﻿'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
