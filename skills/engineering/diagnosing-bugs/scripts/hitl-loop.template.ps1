$ErrorActionPreference = 'Stop'

function Invoke-Step([string]$Instruction) {
    Write-Host "`n>>> $Instruction"
    Read-Host '    Press Enter when done' | Out-Null
}

function Read-Capture([string]$Question) {
    Write-Host "`n>>> $Question"
    return Read-Host '    >'
}

# Edit the example steps below for the reproduction.
Invoke-Step 'Open the app at http://localhost:3000 and sign in.'
$errored = Read-Capture "Click the 'Export' button. Did it throw an error? (y/n)"
$errorMessage = Read-Capture "Paste the error message (or 'none')"

Write-Host "`n--- Captured ---"
Write-Host "ERRORED=$errored"
Write-Host "ERROR_MSG=$errorMessage"
