import { test, expect, describe } from 'bun:test';
import { renderTemplate } from '../../src/theme';
import type { TemplateVars } from '../../src/types';

function makeVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    title: 'Test Title',
    siteTitle: 'Test Site',
    content: '<p>Hello</p>',
    nav: '<ul><li>Nav</li></ul>',
    backlinks: '',
    toc: '',
    icon: '',
    pageTitle: 'Test Title',
    pageFavicon: '',
    ogImage: '',
    ...overrides,
  };
}

describe('renderTemplate', () => {
  test('replaces simple variables', () => {
    const template = '<title>{{title}}</title><body>{{content}}</body>';
    const html = renderTemplate(template, makeVars());
    expect(html).toContain('<title>Test Title</title>');
    expect(html).toContain('<body><p>Hello</p></body>');
  });

  test('escapes HTML in title variables', () => {
    const template = '<title>{{title}}</title>';
    const html = renderTemplate(template, makeVars({ title: 'A & B <C>' }));
    expect(html).toContain('A &amp; B &lt;C&gt;');
  });

  test('handles conditional icon block - present', () => {
    const template = '{{#if icon}}<span>{{icon}}</span>{{/if}}';
    const html = renderTemplate(template, makeVars({ icon: 'star' }));
    expect(html).toContain('<span>star</span>');
  });

  test('handles conditional icon block - absent', () => {
    const template = '{{#if icon}}<span>{{icon}}</span>{{/if}}';
    const html = renderTemplate(template, makeVars({ icon: '' }));
    expect(html).toBe('');
  });

  test('handles conditional toc block', () => {
    const template = '{{#if toc}}<nav>{{toc}}</nav>{{/if}}';
    const html = renderTemplate(template, makeVars({ toc: '<li>Section</li>' }));
    expect(html).toContain('<nav><li>Section</li></nav>');
  });

  test('handles conditional pageFavicon block', () => {
    const template = '{{#if pageFavicon}}<link href="{{pageFavicon}}">{{/if}}';
    const html = renderTemplate(template, makeVars({ pageFavicon: '/favicon.ico' }));
    expect(html).toContain('href="/favicon.ico"');
  });

  test('handles conditional ogImage block', () => {
    const template = '{{#if ogImage}}<meta content="{{ogImage}}">{{/if}}';
    const html = renderTemplate(template, makeVars({ ogImage: '' }));
    expect(html).toBe('');
  });

  test('replaces all occurrences of a variable', () => {
    const template = '{{title}} and again {{title}}';
    const html = renderTemplate(template, makeVars());
    expect(html).toBe('Test Title and again Test Title');
  });
});
