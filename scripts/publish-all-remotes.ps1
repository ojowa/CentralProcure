param(
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ("> git " + ($Arguments -join " "))
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

function Assert-RemoteExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteName
    )

    & git remote get-url $RemoteName *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Required remote '$RemoteName' is not configured."
    }
}

Assert-RemoteExists -RemoteName "origin"
Assert-RemoteExists -RemoteName "backend"
Assert-RemoteExists -RemoteName "frontend"

Invoke-Git -Arguments @("push", "origin", $Branch)
Invoke-Git -Arguments @("subtree", "push", "--prefix=Backend", "backend", $Branch)
Invoke-Git -Arguments @("subtree", "push", "--prefix=Frontend", "frontend", $Branch)
