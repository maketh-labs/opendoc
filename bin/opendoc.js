#!/usr/bin/env node
import { createRequire } from "module"
import { execFileSync } from "child_process"
import { fileURLToPath } from "url"
import path from "path"

const require = createRequire(import.meta.url)

// Platform → optional package name
const PLATFORMS = {
  "darwin arm64": "@maketh-labs/opendoc-darwin-arm64",
  "darwin x64":   "@maketh-labs/opendoc-darwin-x64",
  "linux x64":    "@maketh-labs/opendoc-linux-x64",
  "linux arm64":  "@maketh-labs/opendoc-linux-arm64",
  "win32 x64":    "@maketh-labs/opendoc-win32-x64",
}

const key = `${process.platform} ${process.arch}`
const pkgName = PLATFORMS[key]

if (!pkgName) {
  console.error(`opendoc: unsupported platform: ${key}`)
  process.exit(1)
}

let binaryPath
try {
  // Resolve binary from the platform-specific optional package
  binaryPath = require.resolve(`${pkgName}/bin/opendoc`)
} catch {
  // Fallback: try running with bun directly (for bunx users)
  try {
    const cliPath = new URL("../src/cli.ts", import.meta.url)
    execFileSync("bun", ["run", fileURLToPath(cliPath), ...process.argv.slice(2)], { stdio: "inherit" })
    process.exit(0)
  } catch {
    console.error(`opendoc: could not find binary for ${key}. Try: bunx opendoc`)
    process.exit(1)
  }
}

execFileSync(binaryPath, process.argv.slice(2), { stdio: "inherit" })
