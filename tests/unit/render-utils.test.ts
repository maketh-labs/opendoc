import { test, expect, describe } from 'bun:test';
import { navToHtml, backlinksToHtml } from '../../src/render-utils';
import type { NavNode } from '../../src/types';

describe('navToHtml', () => {
  test('renders a simple node', () => {
    const node: NavNode = { title: 'Home', path: '.', url: '/', children: [] };
    const html = navToHtml(node);
    expect(html).toContain('<li>');
    expect(html).toContain('href="/"');
    expect(html).toContain('Home');
  });

  test('marks active node', () => {
    const node: NavNode = { title: 'Home', path: '.', url: '/', children: [] };
    const html = navToHtml(node, '.');
    expect(html).toContain('class="active"');
  });

  test('renders icon span when icon present', () => {
    const node: NavNode = { title: 'Home', path: '.', url: '/', icon: 'star', children: [] };
    const html = navToHtml(node);
    expect(html).toContain('od-nav-icon');
    expect(html).toContain('star');
  });

  test('renders nested children', () => {
    const node: NavNode = {
      title: 'Root',
      path: '.',
      url: '/',
      children: [
        { title: 'Child', path: 'child', url: '/child', children: [] },
      ],
    };
    const html = navToHtml(node);
    expect(html).toContain('Root');
    expect(html).toContain('Child');
    expect(html).toContain('<ul>');
  });

  test('escapes HTML in titles', () => {
    const node: NavNode = { title: 'A & B', path: '.', url: '/', children: [] };
    const html = navToHtml(node);
    expect(html).toContain('A &amp; B');
  });
});

describe('backlinksToHtml', () => {
  test('renders backlinks list', () => {
    const html = backlinksToHtml(['getting-started', 'api-reference']);
    expect(html).toContain('od-backlinks');
    expect(html).toContain('Referenced by');
    expect(html).toContain('href="/getting-started"');
    expect(html).toContain('href="/api-reference"');
  });

  test('handles root page link', () => {
    const html = backlinksToHtml(['.']);
    expect(html).toContain('href="/"');
    expect(html).toContain('Home');
  });

  test('returns empty string for empty array', () => {
    expect(backlinksToHtml([])).toBe('');
  });

  test('returns empty string for null/undefined', () => {
    expect(backlinksToHtml(null as any)).toBe('');
    expect(backlinksToHtml(undefined as any)).toBe('');
  });

  test('formats page names from slugs', () => {
    const html = backlinksToHtml(['guides/getting-started']);
    expect(html).toContain('getting started'); // last segment, hyphens → spaces
  });
});
