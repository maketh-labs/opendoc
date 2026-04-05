import { test, expect, describe } from 'bun:test';
import { renderFull } from '../../../src/renderer';

// Test callouts through the full rendering pipeline since the plugin
// transforms blockquote AST nodes

describe('calloutPlugin', () => {
  test('renders NOTE callout', async () => {
    const md = '> [!NOTE] This is a note.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout');
    expect(html).toContain('od-callout-note');
    expect(html).toContain('od-callout-icon');
  });

  test('renders WARNING callout', async () => {
    const md = '> [!WARNING] Be careful!';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-warning');
  });

  test('renders TIP callout', async () => {
    const md = '> [!TIP] A helpful tip.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-tip');
  });

  test('renders DANGER callout', async () => {
    const md = '> [!DANGER] Dangerous operation.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-danger');
  });

  test('renders INFO callout', async () => {
    const md = '> [!INFO] For your information.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-info');
  });

  test('renders IMPORTANT callout', async () => {
    const md = '> [!IMPORTANT] Do not skip this.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-important');
  });

  test('preserves callout body content', async () => {
    const md = '> [!NOTE] Important info here.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-body');
  });

  test('leaves regular blockquotes alone', async () => {
    const md = '> Just a regular quote.';
    const { html } = await renderFull(md);
    expect(html).not.toContain('od-callout');
    expect(html).toContain('<blockquote>');
  });

  test('handles case insensitivity in type', async () => {
    const md = '> [!note] lowercase note.';
    const { html } = await renderFull(md);
    // The regex matches \w+ case-insensitively then uppercases
    expect(html).toContain('od-callout-note');
  });

  test('handles multi-line callout body', async () => {
    const md = '> [!NOTE] First line.\n> Second line of the callout.';
    const { html } = await renderFull(md);
    expect(html).toContain('od-callout-note');
  });
});
