# Indonesian tone audit — scan source for user-facing Indonesian strings
# and flag anti-patterns that break the brand voice (casual, warm, "aku/kamu").
#
# Run: .\scripts\tone_audit.ps1

Push-Location "$PSScriptRoot\.."

Write-Host "`n=== Indonesian Tone Audit ===" -ForegroundColor Cyan

$issues = @()

# Pattern 1: Non-Latin characters (CJK, Cyrillic, Hangul) in source
Write-Host "`nChecking for stray non-Latin characters in .ts files..." -ForegroundColor Yellow
$cjkHits = Get-ChildItem -Path worker\src, frontend\src -Recurse -Include *.ts, *.tsx |
  Select-String -Pattern '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]' |
  Where-Object { $_.Line -notmatch '^\s*//|^\s*\*' }

if ($cjkHits) {
  foreach ($hit in $cjkHits) {
    $issues += "CJK/Cyrillic leak — $($hit.Path):$($hit.LineNumber)  $($hit.Line.Trim())"
  }
} else {
  Write-Host "  OK — no non-Latin leaks" -ForegroundColor Green
}

# Pattern 2: Overly formal "Anda" in casual user-facing strings
Write-Host "`nChecking for formal 'Anda' in bot/UI strings..." -ForegroundColor Yellow
$andaHits = Get-ChildItem -Path worker\src\bot, worker\src\services, frontend\src\pages -Recurse -Include *.ts, *.tsx |
  Select-String -Pattern '\bAnda\b' |
  Where-Object { $_.Line -notmatch '^\s*//' }

if ($andaHits) {
  foreach ($hit in $andaHits) {
    $issues += "Formal 'Anda' — $($hit.Path):$($hit.LineNumber)  $($hit.Line.Trim())"
  }
} else {
  Write-Host "  OK — consistent casual tone" -ForegroundColor Green
}

# Pattern 3: ALL-CAPS shouting (4+ consecutive uppercase words)
Write-Host "`nChecking for ALL-CAPS shouting..." -ForegroundColor Yellow
$shoutHits = Get-ChildItem -Path worker\src\bot -Recurse -Include *.ts |
  Select-String -Pattern "'[^']*[A-Z]{4,}\s[A-Z]{4,}[^']*'"

if ($shoutHits) {
  foreach ($hit in $shoutHits) {
    $issues += "Shouting — $($hit.Path):$($hit.LineNumber)  $($hit.Line.Trim())"
  }
} else {
  Write-Host "  OK — no user-facing shouting" -ForegroundColor Green
}

# Pattern 4: English error messages that should be Indonesian
Write-Host "`nChecking for English error boilerplate in user messages..." -ForegroundColor Yellow
$engErrPatterns = @(
  "'Something went wrong'",
  "'An error occurred'",
  "'Please try again later'"
)
foreach ($pat in $engErrPatterns) {
  $hits = Get-ChildItem -Path worker\src, frontend\src -Recurse -Include *.ts, *.tsx |
    Select-String -Pattern ([regex]::Escape($pat))
  foreach ($hit in $hits) {
    $issues += "Untranslated error — $($hit.Path):$($hit.LineNumber)  $($hit.Line.Trim())"
  }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
  Write-Host "No tone issues found. Bahasa voice is consistent." -ForegroundColor Green
} else {
  Write-Host "Found $($issues.Count) issues:" -ForegroundColor Yellow
  $issues | ForEach-Object { Write-Host "  $_" }
}

Pop-Location
