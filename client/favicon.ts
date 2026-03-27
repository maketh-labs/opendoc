// Favicon generator — all processing happens in the browser via Canvas API

async function resizeImage(source: HTMLImageElement, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })
}

const FAVICON_SIZES: { name: string; width: number; height: number }[] = [
  { name: "favicon-16x16.png", width: 16, height: 16 },
  { name: "favicon-32x32.png", width: 32, height: 32 },
  { name: "favicon-48x48.png", width: 48, height: 48 },
  { name: "apple-touch-icon.png", width: 180, height: 180 },
  { name: "android-chrome-192x192.png", width: 192, height: 192 },
  { name: "android-chrome-512x512.png", width: 512, height: 512 },
]

async function generateFavicons(file: File): Promise<Map<string, Blob>> {
  const img = await loadImage(file)
  const result = new Map<string, Blob>()

  for (const size of FAVICON_SIZES) {
    const blob = await resizeImage(img, size.width, size.height)
    result.set(size.name, blob)
  }

  // Generate favicon.ico (32x32 PNG renamed — most browsers accept PNG-in-ICO)
  const icoBlob = await resizeImage(img, 32, 32)
  result.set("favicon.ico", icoBlob)

  return result
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

function generateWebManifest(siteTitle: string): string {
  return JSON.stringify({
    name: siteTitle,
    short_name: siteTitle,
    icons: [
      { src: "/favicons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/favicons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone"
  }, null, 2)
}

function generateMetaTags(): string {
  return `<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicons/android-chrome-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicons/android-chrome-512x512.png">
<link rel="manifest" href="/favicons/site.webmanifest">`
}

function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadAll(files: Map<string, Blob>, siteTitle: string): Promise<void> {
  // Download manifest
  const manifest = generateWebManifest(siteTitle)
  const manifestBlob = new Blob([manifest], { type: 'application/json' })
  downloadFile('site.webmanifest', manifestBlob)

  // Download each file with a small delay
  for (const [name, blob] of files) {
    await new Promise(r => setTimeout(r, 50))
    downloadFile(name, blob)
  }
}

function renderPreviewCanvas(img: HTMLImageElement, canvasId: string, size: number): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, size, size)
}

export function initFaviconPanel(): void {
  const dropZone = document.getElementById('favicon-drop')
  const dropInner = document.getElementById('favicon-drop-inner')
  const fileInput = document.getElementById('favicon-upload') as HTMLInputElement | null
  const browseBtn = document.getElementById('favicon-browse')
  const previewSection = document.getElementById('favicon-preview')
  const previewImg = document.getElementById('favicon-preview-img') as HTMLImageElement | null
  const tagsSection = document.getElementById('favicon-tags')
  const tagsOutput = document.getElementById('favicon-tags-output') as HTMLTextAreaElement | null
  const copyTagsBtn = document.getElementById('favicon-copy-tags')
  const downloadAllBtn = document.getElementById('favicon-download-all')

  if (!dropZone || !fileInput) return

  let generatedFiles: Map<string, Blob> | null = null

  // Browse button
  browseBtn?.addEventListener('click', () => fileInput.click())

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('od-favicon-drag-over')
  })

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('od-favicon-drag-over')
  })

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('od-favicon-drag-over')
    const file = e.dataTransfer?.files[0]
    if (file && (file.type === 'image/png' || file.type === 'image/svg+xml')) {
      processFile(file)
    }
  })

  // File input change
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) processFile(file)
  })

  async function processFile(file: File) {
    const img = await loadImage(file)

    // Show preview
    if (previewImg) {
      previewImg.src = img.src
    }
    if (previewSection) previewSection.style.display = ''

    // Render preview canvases
    renderPreviewCanvas(img, 'preview-16', 16)
    renderPreviewCanvas(img, 'preview-32', 32)
    renderPreviewCanvas(img, 'preview-180', 180)

    // Generate favicons
    generatedFiles = await generateFavicons(file)

    // Show tags
    if (tagsOutput) {
      tagsOutput.value = generateMetaTags()
    }
    if (tagsSection) tagsSection.style.display = ''

    // Hide drop inner text, show as compact
    if (dropInner) {
      dropInner.innerHTML = `<p>Uploaded: ${file.name}</p><button class="od-btn od-btn-secondary" id="favicon-browse-replace">Replace</button>`
      document.getElementById('favicon-browse-replace')?.addEventListener('click', () => fileInput!.click())
    }
  }

  // Copy tags
  copyTagsBtn?.addEventListener('click', () => {
    if (tagsOutput) {
      navigator.clipboard.writeText(tagsOutput.value)
    }
  })

  // Download all
  downloadAllBtn?.addEventListener('click', async () => {
    if (!generatedFiles) return
    const siteTitle = document.title || 'My Site'
    await downloadAll(generatedFiles, siteTitle)
  })
}
