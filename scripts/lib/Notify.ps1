param([string]$Title,[string]$Message,[ValidateSet("info","ok","warn","err")][string]$Level="info")
$ErrorActionPreference="SilentlyContinue"
Set-Location $PSScriptRoot
$cfgPath = Join-Path $PSScriptRoot "..\config\notify.json"
$cfg = if (Test-Path $cfgPath) { Get-Content $cfgPath -Raw | ConvertFrom-Json } else { $null }

# Slack
try {
  if ($cfg -and $cfg.slack_webhook -and $cfg.slack_webhook.Trim().Length -gt 0) {
    $payload = @{ text = ":robot_face: *$Title* ? $Message" } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $cfg.slack_webhook -Body $payload -ContentType "application/json" | Out-Null
  }
} catch {}

# Toast (BurntToast) ? optional
try {
  if ($cfg -and $cfg.toast_enabled) {
    if (-not (Get-Module -ListAvailable -Name BurntToast)) {
      Install-Module BurntToast -Scope CurrentUser -Force -AllowClobber -ErrorAction SilentlyContinue | Out-Null
    }
    Import-Module BurntToast -ErrorAction SilentlyContinue | Out-Null
    if (Get-Command New-BurntToastNotification -ErrorAction SilentlyContinue) {
      switch ($Level) { "ok"{$s="Success"} "warn"{$s="Warning"} "err"{$s="Error"} default{$s="Info"} }
      New-BurntToastNotification -Text $Title, $Message -AppLogo (New-BTImage -Source "ms-appx:///Assets/Square44x44Logo.targetsize-44.png") | Out-Null
    } else {
      # fallback beep
      [console]::beep(1000,200)
    }
  }
} catch {}
