import { escapeHtml } from "./utils.js"
import type { NavNode } from "./types.js"

export function navToHtml(node: NavNode, currentPath = ""): string {
  if (!node) return ""
  const active = node.path === currentPath ? " class=\"active\"" : ""
  const iconSpan = node.icon ? `<span class="od-nav-icon">${node.icon}</span> ` : ""
  let html = `<li><a href="${node.url}"${active}>${iconSpan}${escapeHtml(node.title)}</a>`
  if (node.children?.length) {
    html += "<ul>" + node.children.map(c => navToHtml(c, currentPath)).join("") + "</ul>"
  }
  html += "</li>"
  return html
}

export function backlinksToHtml(links: string[]): string {
  if (!links?.length) return ""
  const items = links.map(l => {
    const url = l === "." ? "/" : `/${l}`
    const name = l === "." ? "Home" : l.split("/").pop()!.replace(/-/g, " ")
    return `<li><a href="${url}">${escapeHtml(name)}</a></li>`
  }).join("")
  return `<aside class="od-backlinks"><h4>Referenced by</h4><ul>${items}</ul></aside>`
}
