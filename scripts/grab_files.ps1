<#
    .SYNOPSIS
    Organizes downloaded integration files into the correct directories.

    .DESCRIPTION
    This script moves files you downloaded from ChatGPT into their proper
    locations within the Vehicle Instructions App repository.  It looks
    for specific file names in a source directory (default: the current
    working directory) and copies them into the `scripts`, `functions`
    and `runbooks` folders as appropriate.  If the target folders do
    not exist they will be created.

    .PARAMETER SourceDir
    The directory where the downloaded files reside.  Defaults to the
    current directory.

    .PARAMETER RepoDir
    The root of the repository.  Defaults to the current directory.

    .EXAMPLE
        # Copy files from C:\Users\gregc\Downloads into the repo
        .\scripts\grab_files.ps1 -SourceDir "C:\Users\gregc\Downloads" -RepoDir "C:\Users\gregc\vi-clean"

    This will move pipeline.py into scripts\pipeline.py, index.js into
    functions\index.js, etc.  If any file is missing in SourceDir a
    warning is printed.
#>

param(
    [string]$SourceDir = (Get-Location),
    [string]$RepoDir   = (Get-Location)
)

function CopyIfExists {
    param(
        [string]$FileName,
        [string]$Destination
    )
    $srcPath = Join-Path $SourceDir $FileName
    if (Test-Path $srcPath) {
        $destDir = Split-Path $Destination -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $srcPath -Destination $Destination -Force
        Write-Host "Copied $FileName to $Destination"
    } else {
        Write-Host "[Warning] $FileName not found in $SourceDir"
    }
}

# Define the mapping of filenames to their destination paths
$fileMap = @{
    "pipeline.py"           = "scripts\pipeline.py";
    "upload_to_firebase.js" = "scripts\upload_to_firebase.js";
    "index.js"              = "functions\index.js";
    "firebase_integration.md" = "runbooks\firebase_integration.md";
    "sample_manual.pdf"     = "sample_manual.pdf";
    "sample_dashboard.jpg"  = "sample_dashboard.jpg";
}

foreach ($entry in $fileMap.GetEnumerator()) {
    $fileName = $entry.Key
    $relativeDest = $entry.Value
    $destPath = Join-Path $RepoDir $relativeDest
    CopyIfExists -FileName $fileName -Destination $destPath
}

Write-Host "File organization complete."