# Verification script for Phase 2a — checks the Critical/High audit fixes in production.
# Run from PowerShell: .\scripts\verify_shipped_fixes.ps1
#
# Expected outcomes are documented inline. A PASS means the endpoint behaves
# as hardened; a FAIL means the fix didn't ship.

$base = "https://edubot-api.edubot-leonardus.workers.dev/api"
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int]$ExpectedStatus
    )
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            SkipHttpErrorCheck = $true
            ErrorAction = 'Stop'
        }
        if ($Body) { $params.Body = $Body; $params.ContentType = 'application/json' }
        $response = Invoke-WebRequest @params
        $actualStatus = [int]$response.StatusCode
        $pass = ($actualStatus -eq $ExpectedStatus)
        $marker = if ($pass) { "PASS" } else { "FAIL" }
        Write-Host "[$marker] $Name (expected $ExpectedStatus, got $actualStatus)" -ForegroundColor $(if ($pass) { 'Green' } else { 'Red' })
        if (-not $pass) {
            Write-Host "       Body: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Yellow
        }
        return [PSCustomObject]@{ Name = $Name; Pass = $pass; Expected = $ExpectedStatus; Actual = $actualStatus }
    } catch {
        Write-Host "[ERROR] $Name — $($_.Exception.Message)" -ForegroundColor Red
        return [PSCustomObject]@{ Name = $Name; Pass = $false; Expected = $ExpectedStatus; Actual = 'error' }
    }
}

Write-Host "`n=== Phase 2a — Verifying shipped security fixes ===" -ForegroundColor Cyan

# 1. Payment webhook rejects unauthenticated request (no hash, no secret header)
$results += Test-Endpoint -Name "Payment webhook rejects anonymous POST" `
    -Method POST -Url "$base/premium/stars/callback" `
    -Body '{"invoice_payload":"premium_1_7_123","telegram_payment_charge_id":"FAKE"}' `
    -ExpectedStatus 401

# 2. Payment webhook rejects bad hash
$results += Test-Endpoint -Name "Payment webhook rejects invalid hash" `
    -Method POST -Url "$base/premium/stars/callback" `
    -Body '{"invoice_payload":"premium_1_7_123","hash":"deadbeef","telegram_payment_charge_id":"FAKE2"}' `
    -ExpectedStatus 403

# 3. Tests /start rejects unauthenticated
$results += Test-Endpoint -Name "Tests /start rejects anonymous" `
    -Method POST -Url "$base/tests/start" `
    -Body '{"test_type":"TOEFL_IBT"}' `
    -ExpectedStatus 401

# 4. Speaking /evaluate rejects anonymous
$results += Test-Endpoint -Name "Speaking /evaluate rejects anonymous" `
    -Method POST -Url "$base/speaking/evaluate" `
    -Body '' `
    -ExpectedStatus 401

# 5. Writing /evaluate rejects anonymous
$results += Test-Endpoint -Name "Writing /evaluate rejects anonymous" `
    -Method POST -Url "$base/writing/evaluate" `
    -Body '{"text":"hello world this is a test essay"}' `
    -ExpectedStatus 401

# 6. TTS /speak rejects anonymous
$results += Test-Endpoint -Name "TTS /speak rejects anonymous" `
    -Method GET -Url "$base/tts/speak?text=test" `
    -ExpectedStatus 401

# 7. TTS /dialogue rejects anonymous
$results += Test-Endpoint -Name "TTS /dialogue rejects anonymous" `
    -Method POST -Url "$base/tts/dialogue" `
    -Body '{"text":"Woman: Hi. Man: Hello."}' `
    -ExpectedStatus 401

# 8. Health check still works (sanity)
$results += Test-Endpoint -Name "Health check is public" `
    -Method GET -Url "$base/health" `
    -ExpectedStatus 200

# Summary
$passed = ($results | Where-Object { $_.Pass }).Count
$total = $results.Count
Write-Host "`n=== Summary: $passed/$total passed ===" -ForegroundColor $(if ($passed -eq $total) { 'Green' } else { 'Yellow' })

if ($passed -ne $total) {
    Write-Host "`nManual verification items (require real Telegram user):" -ForegroundColor Cyan
    Write-Host "  - Open the mini app with a valid JWT, answer an exercise on 2 consecutive days (WIB) — streak goes 1 -> 2"
    Write-Host "  - Start a mock-mode test, wait past deadline, submit answer — expect TIME_EXPIRED"
    Write-Host "  - Make one real 375 Star purchase, replay the same webhook — second call returns duplicate:true"
    Write-Host "  - Free user hits 10 questions on 1 day, checks at 00:00 WIB — quota resets"
}
