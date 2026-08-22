# =============================================================================
#  AI QA Toolkit - tiny static file server (no dependencies)
#  Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8123]
#  Serving over http:// (instead of opening index.html directly) is required for
#  the AI tools (CORS) and for Web Crypto features such as SHA-512 and HS256.
# =============================================================================
param(
  [int]$Port = 8123,
  [switch]$NoBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/markdown; charset=utf-8'
  '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix - is the port already in use?" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "AI QA Toolkit served at $prefix" -ForegroundColor Green
Write-Host "Root: $root"
Write-Host "Press Ctrl+C to stop."

if (-not $NoBrowser) { Start-Process $prefix }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }

  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    $full = Join-Path $root $rel
    $fullResolved = [System.IO.Path]::GetFullPath($full)

    # never serve outside the site root
    if (-not $fullResolved.StartsWith([System.IO.Path]::GetFullPath($root), [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }

    if (Test-Path -LiteralPath $fullResolved -PathType Container) {
      $fullResolved = Join-Path $fullResolved 'index.html'
    }

    if (Test-Path -LiteralPath $fullResolved -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($fullResolved).ToLower()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($fullResolved)
      $res.ContentType = $ct
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("200 " + $rel)
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.StatusCode = 404
      $res.ContentType = 'text/plain; charset=utf-8'
      $res.OutputStream.Write($msg, 0, $msg.Length)
      Write-Host ("404 " + $rel) -ForegroundColor Yellow
    }
  } catch {
    Write-Host ("500 " + $_.Exception.Message) -ForegroundColor Red
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
