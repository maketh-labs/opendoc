#!/usr/bin/env bun

import { startServer } from './server';
import { build } from './builder';
import { init } from './init';
import { resolve } from 'path';

const HELP = `
OpenDoc — git-native docs and wiki

Usage:
  opendoc serve [dir] [options]   Start docs server (:3000) + MCP server (:3001)
  opendoc build [dir]             Build static site to dir/dist
  opendoc init [dir]              Create a new docs project

Serve options:
  --port <n>        Docs server port (default 3000; next free port if taken)
  --mcp-port <n>    MCP server port (default 3001)
  --host <addr>     Interface to bind (default 127.0.0.1). The editing API and
                    MCP server only accept requests from this machine regardless.
  --no-open         Don't open a browser

Examples:
  opendoc serve ./docs
  opendoc serve ./docs --port 4000 --no-open
  opendoc build ./docs
`;

function fail(message: string): never {
  console.error(`opendoc: ${message}`);
  process.exit(1);
}

const positionals: string[] = [];
const flags: Record<string, string | true> = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]!;
  if (arg === '-h') { flags.help = true; continue; }
  if (!arg.startsWith('--')) { positionals.push(arg); continue; }
  const [name, inline] = arg.slice(2).split('=', 2) as [string, string | undefined];
  if (name === 'no-open' || name === 'help') { flags[name] = true; continue; }
  const value = inline ?? argv[++i];
  if (value === undefined) fail(`--${name} requires a value`);
  flags[name] = value;
}

function portFlag(name: string): number | undefined {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) fail(`invalid --${name}: ${raw}`);
  return n;
}

const command = flags.help ? 'help' : positionals[0] ?? 'help';
const dir = positionals[1] ?? '.';
const rootDir = resolve(dir);

switch (command) {
  case 'serve': {
    await startServer(rootDir, {
      port: portFlag('port'),
      mcpPort: portFlag('mcp-port'),
      host: typeof flags.host === 'string' ? flags.host : undefined,
      open: !flags['no-open'],
    });
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
    console.log(HELP);
    break;
  default:
    console.log(HELP);
    process.exit(1);
}
