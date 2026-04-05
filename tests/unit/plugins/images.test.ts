import { test, expect, describe } from 'bun:test';
import { renderFull } from '../../../src/renderer';

describe('imagePlugin', () => {
  test('wraps images in figure elements', async () => {
    const md = '![Alt text](image.png)';
    const { html } = await renderFull(md);
    expect(html).toContain('<figure');
    expect(html).toContain('od-figure');
    expect(html).toContain('<img');
  });

  test('adds lazy loading to images', async () => {
    const md = '![Alt](image.png)';
    const { html } = await renderFull(md);
    expect(html).toContain('loading="lazy"');
  });

  test('adds async decoding to images', async () => {
    const md = '![Alt](image.png)';
    const { html } = await renderFull(md);
    expect(html).toContain('decoding="async"');
  });

  test('converts inline em after image to figcaption', async () => {
    const md = '![Screenshot](shot.png)\n*Caption text*';
    const { html } = await renderFull(md);
    expect(html).toContain('<figcaption');
    expect(html).toContain('Caption text');
  });

  test('preserves alt text', async () => {
    const md = '![My Alt Text](image.png)';
    const { html } = await renderFull(md);
    expect(html).toContain('alt="My Alt Text"');
  });
});
