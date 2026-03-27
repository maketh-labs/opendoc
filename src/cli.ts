#!/usr/bin/env bun

import { startServer } from './server';
import { build } from './builder';
import { resolve } from 'path';

const [command, dir] = process.argv.slice(2);
const rootDir = resolve(dir || '.');

switch (command) {
  case 'serve':
    startServer(rootDir);
    break;
  case 'build':
    await build(rootDir);
    break;
  default:
    console.log(`
OpenDoc — git-native docs and wiki

Usage:
  opendoc serve [dir]   Start dev server (:3000) + MCP server (:3001)
  opendoc build [dir]   Build static site to .opendoc/dist
`);
    process.exit(command ? 1 : 0);
}
