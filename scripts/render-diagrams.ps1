param(
  [string]$InputDir = "design notes/diagrams",
  [string]$OutputDir = "design notes/diagrams/out"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$files = Get-ChildItem -Path $InputDir -Filter *.mmd
if (-not $files) {
  Write-Host "No .mmd files found in $InputDir."
  exit 0
}

foreach ($file in $files) {
  $outFile = Join-Path $OutputDir ($file.BaseName + ".svg")
  npx -p @mermaid-js/mermaid-cli mmdc -i "$($file.FullName)" -o "$outFile"
}

Write-Host "Rendered $($files.Count) diagram(s) to $OutputDir."
