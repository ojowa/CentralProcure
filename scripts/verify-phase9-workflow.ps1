param(
    [string]$BaseUrl,
    [string]$ScenarioPath = (Join-Path $PSScriptRoot "phase9-workflow-scenarios.json"),
    [switch]$IncludeDatabaseChecks,
    [switch]$IncludeMutations
)

$ErrorActionPreference = "Stop"

function New-CheckResult {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Detail,
        [hashtable]$Data = @{}
    )

    return [ordered]@{
        Name = $Name
        Status = $Status
        Detail = $Detail
        Data = $Data
    }
}

function Invoke-Phase9Check {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    try {
        $result = & $Action
        if ($null -eq $result) {
            return (New-CheckResult -Name $Name -Status "passed" -Detail "Completed.")
        }

        return $result
    }
    catch {
        return (New-CheckResult -Name $Name -Status "failed" -Detail $_.Exception.Message)
    }
}

function Resolve-Template {
    param(
        [string]$Template,
        [string]$EntityId
    )

    return $Template.Replace("{entityId}", $EntityId)
}

function Write-Phase9Artifacts {
    param(
        [hashtable]$Report
    )

    $artifactRoot = Join-Path $PSScriptRoot "..\artifacts\verification\phase9"
    $null = New-Item -ItemType Directory -Path $artifactRoot -Force

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $jsonPath = Join-Path $artifactRoot "phase9-report-$timestamp.json"
    $markdownPath = Join-Path $artifactRoot "phase9-summary-$timestamp.md"

    $Report | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath

    $lines = @(
        "# Phase 9 Verification Summary",
        "",
        "- Generated: $($Report.GeneratedAtUtc)",
        "- Base URL: $($Report.BaseUrl)",
        "- Scope: $($Report.Scope)",
        ""
    )

    foreach ($check in $Report.Checks) {
        $lines += "- [$($check.Status)] $($check.Name): $($check.Detail)"
    }

    if ($Report.Warnings.Count -gt 0) {
        $lines += ""
        $lines += "## Warnings"
        foreach ($warning in $Report.Warnings) {
            $lines += "- $warning"
        }
    }

    $lines | Set-Content -Path $markdownPath

    return [ordered]@{
        JsonPath = $jsonPath
        MarkdownPath = $markdownPath
    }
}

if (-not (Test-Path -LiteralPath $ScenarioPath)) {
    throw "Scenario manifest not found at $ScenarioPath"
}

$scenario = Get-Content -LiteralPath $ScenarioPath -Raw | ConvertFrom-Json
$resolvedBaseUrl = if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $scenario.baseUrl } else { $BaseUrl }
$resolvedBaseUrl = $resolvedBaseUrl.TrimEnd("/")

$warnings = New-Object System.Collections.Generic.List[string]

if ($IncludeDatabaseChecks.IsPresent) {
    $warnings.Add("Database checks are not implemented in the tracked Phase 9 compatibility verifier. Flag accepted but skipped.")
}

if ($IncludeMutations.IsPresent) {
    $warnings.Add("Mutation coverage is not implemented in the tracked Phase 9 compatibility verifier. Approval verification remains read-mostly except for the approval action.")
}

$reportChecks = New-Object System.Collections.Generic.List[hashtable]
$session = $null
$token = $null
$targetTender = $null

$account = $scenario.accounts.accountingOfficer
$cgisScenario = $scenario.cgisApproval

$reportChecks.Add((Invoke-Phase9Check -Name "Authenticate accounting officer" -Action {
    $body = @{
        email = $account.email
        password = $account.password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod `
        -Uri "$resolvedBaseUrl/api/Auth/internal/login" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -SessionVariable session

    $script:session = $session
    $script:token = $loginResponse.token

    return (New-CheckResult -Name "Authenticate accounting officer" -Status "passed" -Detail "Authenticated successfully." -Data @{
        Email = $account.email
        HasToken = [bool]$script:token
    })
}))

$reportChecks.Add((Invoke-Phase9Check -Name "Load CGIS queue" -Action {
    $queue = Invoke-RestMethod -Uri "$resolvedBaseUrl$($cgisScenario.queueEndpoint)" -Method Get -WebSession $script:session
    $script:targetTender = $queue | Where-Object { $_.RecordTitle -like "*$($cgisScenario.targetTenderTitlePattern)*" } | Select-Object -First 1

    if ($null -eq $script:targetTender) {
        throw "Seeded tender matching '$($cgisScenario.targetTenderTitlePattern)' was not found in the CGIS queue."
    }

    return (New-CheckResult -Name "Load CGIS queue" -Status "passed" -Detail "Found seeded CGIS tender in queue." -Data @{
        RecordTitle = $script:targetTender.RecordTitle
        EntityId = $script:targetTender.EntityId
        Amount = $script:targetTender.Amount
    })
}))

$reportChecks.Add((Invoke-Phase9Check -Name "Retrieve CGIS documents" -Action {
    $documentUrl = Resolve-Template -Template $cgisScenario.documentEndpointTemplate -EntityId ([string]$script:targetTender.EntityId)
    $documents = Invoke-RestMethod -Uri "$resolvedBaseUrl$documentUrl" -Method Get -WebSession $script:session
    $count = @($documents).Count

    $status = if ($count -gt 0) { "passed" } else { "warning" }
    $detail = if ($count -gt 0) { "Retrieved approval document pack." } else { "No CGIS documents were returned for the seeded tender." }

    return (New-CheckResult -Name "Retrieve CGIS documents" -Status $status -Detail $detail -Data @{
        DocumentCount = $count
    })
}))

$reportChecks.Add((Invoke-Phase9Check -Name "Submit CGIS approval decision" -Action {
    $approveBody = @{
        EntityType = "tender"
        EntityId = $script:targetTender.EntityId
        Rationale = $cgisScenario.approvalRationale
        Actor = $account.email
    } | ConvertTo-Json

    $approvalResult = Invoke-RestMethod `
        -Uri "$resolvedBaseUrl$($cgisScenario.approveEndpoint)" `
        -Method Post `
        -Body $approveBody `
        -ContentType "application/json" `
        -WebSession $script:session

    return (New-CheckResult -Name "Submit CGIS approval decision" -Status "passed" -Detail "Approval endpoint accepted the request." -Data @{
        Message = $approvalResult.message
        TargetStage = $approvalResult.targetStage
    })
}))

$reportChecks.Add((Invoke-Phase9Check -Name "Verify workflow history transition" -Action {
    $historyUrl = Resolve-Template -Template $cgisScenario.historyEndpointTemplate -EntityId ([string]$script:targetTender.EntityId)
    $history = Invoke-RestMethod -Uri "$resolvedBaseUrl$historyUrl" -Method Get -WebSession $script:session
    $approvalEntry = $history | Where-Object { $_.ToStageKey -eq $cgisScenario.expectedTargetStage } | Select-Object -First 1

    if ($null -eq $approvalEntry) {
        throw "No workflow history entry was found for transition to '$($cgisScenario.expectedTargetStage)'."
    }

    return (New-CheckResult -Name "Verify workflow history transition" -Status "passed" -Detail "Workflow history contains the expected approval transition." -Data @{
        FromStageKey = $approvalEntry.FromStageKey
        ToStageKey = $approvalEntry.ToStageKey
        Actor = $approvalEntry.Actor
    })
}))

$reportChecks.Add((Invoke-Phase9Check -Name "Verify downstream award visibility" -Action {
    $awards = Invoke-RestMethod -Uri "$resolvedBaseUrl$($cgisScenario.awardsEndpoint)" -Method Get -WebSession $script:session
    $award = $awards | Where-Object { $_.tenderTitle -like "*$($cgisScenario.targetTenderTitlePattern)*" } | Select-Object -First 1

    if ($null -eq $award) {
        throw "Downstream contract award was not visible after approval."
    }

    return (New-CheckResult -Name "Verify downstream award visibility" -Status "passed" -Detail "Contract awards surface reflects the approved tender." -Data @{
        AwardCode = $award.award_code
        Status = $award.status
        TenderTitle = $award.tenderTitle
    })
}))

$overallStatus = if ($reportChecks.Status -contains "failed") { "failed" } elseif ($reportChecks.Status -contains "warning") { "warning" } else { "passed" }
$report = [ordered]@{
    GeneratedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    BaseUrl = $resolvedBaseUrl
    Scope = "Tracked Phase 9 compatibility verifier for the CGIS approval workflow path."
    Status = $overallStatus
    Checks = $reportChecks
    Warnings = $warnings
}

$artifacts = Write-Phase9Artifacts -Report $report

Write-Host "Phase 9 verification status: $overallStatus"
Write-Host "JSON report: $($artifacts.JsonPath)"
Write-Host "Markdown summary: $($artifacts.MarkdownPath)"

if ($warnings.Count -gt 0) {
    foreach ($warning in $warnings) {
        Write-Warning $warning
    }
}

if ($overallStatus -eq "failed") {
    exit 1
}
