#!/usr/bin/env bun

import { startServer } from './server';
import { build } from './builder';
import { resolve } from 'path';


const args = process.argv.slice(2);

// Detect if first arg is a subcommand or a path
const COMMANDS = ['serve', 'build', 'help', '--help', '-h'];
const firstArg = args[0] ?? '';

let command: string;
let dir: string;

if (COMMANDS.includes(firstArg)) {
  command = firstArg;
  dir = args[1] ?? '.';
} else {
  // No subcommand — default to serve, first arg is the path
  command = 'serve';
  dir = firstArg || '.';
}

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
  case 'help':
  case '--help':
  case '-h':
  default:
    console.log(`
OpenDoc — git-native docs and wiki

Usage:
  bunx opendoc [dir]          Serve docs in dir (default: current directory)
  bunx opendoc serve [dir]    Start dev server (:3000) + MCP server (:3001)
  bunx opendoc build [dir]    Build static site to .opendoc/dist

Examples:
  bunx opendoc                 Serve current folder
  bunx opendoc ./docs          Serve ./docs
  bunx opendoc build ./docs    Build ./docs to static site
`);
    process.exit(command === 'help' || command === '--help' || command === '-h' ? 0 : 1);
}
