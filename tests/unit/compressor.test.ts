import { test, expect, describe } from 'bun:test';
import { compress, compressMini } from '../../src/compressor';

describe('compress', () => {
  test('keeps headings intact', () => {
    const input = '# Title\n\n## Section\n\nSome text here.';
    const output = compress(input);
    expect(output).toContain('# Title');
    expect(output).toContain('## Section');
  });

  test('keeps code blocks intact', () => {
    const input = '## Code\n\n```js\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);\n```\n';
    const output = compress(input);
    expect(output).toContain('```js');
    expect(output).toContain('const x = 1;');
    expect(output).toContain('const y = 2;');
    expect(output).toContain('console.log(x + y);');
    expect(output).toContain('```');
  });

  test('keeps lists intact', () => {
    const input = '## Items\n\n- First item\n- Second item\n- Third item\n';
    const output = compress(input);
    expect(output).toContain('- First item');
    expect(output).toContain('- Second item');
    expect(output).toContain('- Third item');
  });

  test('reduces paragraphs to first sentence', () => {
    const input = 'This is the first sentence. This is the second. And the third.';
    const output = compress(input);
    expect(output).toContain('This is the first sentence.');
    expect(output).not.toContain('This is the second.');
  });

  test('handles multi-line paragraphs', () => {
    const input = 'First line of the paragraph.\nSecond line continues here. Third sentence.';
    const output = compress(input);
    expect(output).toContain('First line of the paragraph.');
    expect(output).not.toContain('Third sentence.');
  });

  test('handles numbered lists', () => {
    const input = '1. First\n2. Second\n3. Third\n';
    const output = compress(input);
    expect(output).toContain('1. First');
    expect(output).toContain('2. Second');
  });

  test('handles empty input', () => {
    const output = compress('');
    expect(output.trim()).toBe('');
  });

  test('normalizes excessive blank lines', () => {
    const input = '# Title\n\n\n\n\n## Section\n';
    const output = compress(input);
    // Should not have 3+ consecutive newlines
    expect(output).not.toMatch(/\n{3,}/);
  });
});

describe('compressMini', () => {
  test('keeps H1-H3 headings', () => {
    const input = '# Title\n\n## Section\n\n### Subsection\n\nSome text.';
    const output = compressMini(input);
    expect(output).toContain('# Title');
    expect(output).toContain('## Section');
    expect(output).toContain('### Subsection');
  });

  test('drops H4+ headings', () => {
    const input = '# Title\n\n#### Deep Heading\n\nText here.';
    const output = compressMini(input);
    expect(output).toContain('# Title');
    expect(output).not.toContain('#### Deep Heading');
  });

  test('drops code block fences but content becomes body text', () => {
    const input = '# Title\n\n```js\ncode here\n```\n\nMore text.';
    const output = compressMini(input);
    // compressMini skips fence lines (```), but code lines between fences
    // are collected as section text since it only filters by heading/fence patterns
    expect(output).not.toContain('```');
  });

  test('keeps first sentence summary per section', () => {
    const input = '# Title\n\nThis is the summary. More detail follows. Even more detail.';
    const output = compressMini(input);
    expect(output).toContain('This is the summary.');
    expect(output).not.toContain('Even more detail.');
  });

  test('handles empty input', () => {
    const output = compressMini('');
    expect(output.trim()).toBe('');
  });

  test('handles heading-only input', () => {
    const input = '# Title\n\n## Section One\n\n## Section Two\n';
    const output = compressMini(input);
    expect(output).toContain('# Title');
    expect(output).toContain('## Section One');
    expect(output).toContain('## Section Two');
  });
});
