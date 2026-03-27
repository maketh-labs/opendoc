// Compresses markdown to context.md and context-mini.md tiers
// Pure text processing — no LLM calls

function firstSentence(text: string): string {
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1]! : text.split('\n')[0]!;
}

export function compress(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let paragraphLines: string[] = [];

  function flushParagraph(): void {
    if (paragraphLines.length > 0) {
      output.push(firstSentence(paragraphLines.join(' ')));
      output.push('');
      paragraphLines = [];
    }
  }

  for (const line of lines) {
    // Code block fences
    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      inCodeBlock = !inCodeBlock;
      output.push(line);
      continue;
    }

    // Inside code block — keep everything
    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    // Headings — keep
    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      inList = false;
      output.push(line);
      output.push('');
      continue;
    }

    // Lists — keep
    if (/^\s*[-*+]\s|^\s*\d+\.\s/.test(line)) {
      flushParagraph();
      inList = true;
      output.push(line);
      continue;
    }

    // Continuation of list
    if (inList && line.match(/^\s+\S/)) {
      output.push(line);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) {
        inList = false;
        output.push('');
      }
      flushParagraph();
      continue;
    }

    // Body prose — collect for first-sentence extraction
    inList = false;
    paragraphLines.push(line.trim());
  }

  flushParagraph();
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function compressMini(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let currentSection: string[] = [];

  function flushSection(): void {
    if (currentSection.length > 0) {
      const text = currentSection.join(' ').trim();
      if (text) {
        output.push(firstSentence(text));
        output.push('');
      }
      currentSection = [];
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushSection();
      output.push(line);
      output.push('');
      continue;
    }

    // Skip H4+ headings and code blocks for mini
    if (/^#{4,}\s/.test(line) || line.trimStart().startsWith('```')) continue;

    // Collect text content
    if (line.trim()) {
      currentSection.push(line.trim());
    }
  }

  flushSection();
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
