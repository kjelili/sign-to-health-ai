# Auto-commit PowerShell script
# Usage: .\scripts\auto-commit.ps1

$commitInterval = 60 # seconds
$projectRoot = $PSScriptRoot

Write-Host "🚀 Auto-commit watcher started" -ForegroundColor Green
Write-Host "⏱️  Commit interval: $commitInterval seconds" -ForegroundColor Cyan
Write-Host "📁 Watching: $projectRoot" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

while ($true) {
    $status = git status --porcelain
    if ($status) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $message = "Auto-commit: $timestamp"
        
        Write-Host "📝 Staging changes..." -ForegroundColor Yellow
        git add .
        
        Write-Host "💾 Committing: $message" -ForegroundColor Yellow
        git commit -m $message
        
        Write-Host "✅ Committed successfully`n" -ForegroundColor Green
    } else {
        Write-Host "No changes detected..." -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds $commitInterval
}
