function Resolve-Bin([string]$bin){
  $cmd=Get-Command $bin -ErrorAction SilentlyContinue; if($cmd){return $cmd.Source}
  $w=(where.exe $bin 2>$null|Select-Object -First 1); if($w){return $w}
  return $null
}
function Invoke-Npm { param([Parameter(Mandatory)][string[]]$Args,[string]$Label="npm")
  $npm=Resolve-Bin "npm.cmd"; if(-not $npm){ throw "npm.cmd not found" }
  $env:NPM_CONFIG_LOGLEVEL="error"; $env:NPM_CONFIG_FUND="false"; $env:NPM_CONFIG_AUDIT="false"
  & $npm $Args 2>&1 | ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { throw ("$Label failed (exit $LASTEXITCODE): npm " + ($Args -join ' ')) }
}
