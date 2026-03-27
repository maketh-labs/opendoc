#!/usr/bin/env bun
import { $ } from "bun"

const targets = [
  { name: "opendoc-darwin-arm64",  target: "bun-darwin-arm64",  ext: "" },
  { name: "opendoc-darwin-x64",    target: "bun-darwin-x64",    ext: "" },
  { name: "opendoc-linux-x64",     target: "bun-linux-x64",     ext: "" },
  { name: "opendoc-linux-arm64",   target: "bun-linux-arm64",   ext: "" },
  { name: "opendoc-win32-x64",     target: "bun-windows-x64",   ext: ".exe" },
]

for (const { name, target, ext } of targets) {
  console.log(`Building ${name}...`)
  await $`bun build --compile --target=${target} src/cli.ts --outfile npm/${name}/bin/opendoc${ext}`
}

console.log("All binaries built.")
