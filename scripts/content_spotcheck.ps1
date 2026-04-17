# Content Quality Spot-Check — samples 50 random questions from D1 and flags issues.
# Run: .\scripts\content_spotcheck.ps1
#
# Checks:
#   - Empty question_text / correct_answer / options
#   - correct_answer not in options (for MCQ)
#   - Duplicate question_text across rows
#   - Passage shorter than 100 chars (likely broken)
#   - Explanations shorter than 20 chars (low-value)
#   - Chinese/unexpected unicode in Indonesian-context fields

Push-Location "$PSScriptRoot\..\worker"

$query = @"
SELECT id, section, question_type, question_text, correct_answer, options, explanation, passage
FROM content
WHERE status = 'published'
ORDER BY RANDOM()
LIMIT 50;
"@

Write-Host "`n=== Content Spot-Check (sample of 50) ===" -ForegroundColor Cyan

$result = npx wrangler d1 execute edubot-db --remote --json --command=$query 2>&1 | Out-String
try {
  $data = $result | ConvertFrom-Json
  $rows = $data[0].results
} catch {
  Write-Host "Could not parse D1 output — run wrangler login and re-try." -ForegroundColor Red
  Pop-Location
  exit 1
}

$issues = @()
$seen = @{}

foreach ($r in $rows) {
  $qText = if ($r.question_text) { [string]$r.question_text } else { '' }
  $correct = if ($r.correct_answer) { [string]$r.correct_answer } else { '' }
  $options = if ($r.options) { [string]$r.options } else { '' }
  $explanation = if ($r.explanation) { [string]$r.explanation } else { '' }
  $passage = if ($r.passage) { [string]$r.passage } else { '' }

  if (-not $qText.Trim()) { $issues += "[#$($r.id)] empty question_text" }
  if (-not $correct.Trim() -and $r.section -notin @('writing','speaking')) { $issues += "[#$($r.id)] empty correct_answer" }

  if ($r.question_type -eq 'multiple_choice' -and $options -and $correct) {
    if ($options -notmatch [regex]::Escape($correct)) {
      $issues += "[#$($r.id)] correct_answer '$correct' not found in options"
    }
  }

  if ($r.section -eq 'reading' -and $passage.Length -gt 0 -and $passage.Length -lt 100) {
    $issues += "[#$($r.id)] reading passage too short ($($passage.Length) chars)"
  }

  if ($explanation -and $explanation.Length -lt 20 -and $explanation.Length -gt 0) {
    $issues += "[#$($r.id)] explanation too short ($($explanation.Length) chars): '$explanation'"
  }

  # CJK / Hangul leakage
  if ($qText -match '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]') {
    $issues += "[#$($r.id)] CJK characters in question_text"
  }

  # Duplicate detection
  $key = $qText.Substring(0, [Math]::Min(60, $qText.Length))
  if ($seen.ContainsKey($key)) {
    $issues += "[#$($r.id)] duplicate question_text (first seen #$($seen[$key]))"
  } else {
    $seen[$key] = $r.id
  }
}

if ($issues.Count -eq 0) {
  Write-Host "All 50 sampled questions passed basic checks." -ForegroundColor Green
} else {
  Write-Host "`nFound $($issues.Count) issues:" -ForegroundColor Yellow
  $issues | ForEach-Object { Write-Host "  $_" }
}

Pop-Location
