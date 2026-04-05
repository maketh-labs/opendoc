#!/usr/bin/env bun

import { startServer } from './server';
import { build } from './builder';
import { init } from './init';
import { resolve } from 'path';


const args = process.argv.slice(2);

const command = args[0] ?? 'help';
const dir = args[1] ?? '.';

const rootDir = resolve(dir);

switch (command) {
  case 'serve': {
    await startServer(rootDir);
    break;
  }
  case 'build': {
    await build(rootDir);
    break;
  }
  case 'init': {
    await init(dir);
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  default:
    console.log(`
OpenDoc — git-native docs and wiki

Usage:
  bunx @maketh-labs/opendoc serve [dir]    Start dev server (:3000) + MCP server (:3001)
  bunx @maketh-labs/opendoc build [dir]    Build static site to dist/
  bunx @maketh-labs/opendoc init [dir]     Create a new docs project

Examples:
  bunx @maketh-labs/opendoc serve           Serve current directory
  bunx @maketh-labs/opendoc serve ./docs    Serve ./docs
  bunx @maketh-labs/opendoc build ./docs    Build ./docs to static site
  bunx @maketh-labs/opendoc init ./docs     Create a new docs project in ./docs
  bunx @maketh-labs/opendoc init            Initialize in the current directory
`);
    process.exit(command === 'help' || command === '--help' || command === '-h' ? 0 : 1);
}
