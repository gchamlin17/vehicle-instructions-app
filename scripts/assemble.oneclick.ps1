# One-click assembly script for Vehicle Instructions App
Write-Output "[assemble.oneclick.ps1] Starting assembly..."

# Ensure Node.js and npm are installed (skipped here; assume prerequisites met)

# Create React Native Expo project if missing
if (-not (Test-Path "mobile")) {
    Write-Output "[assemble.oneclick.ps1] Creating React Native mobile app..."
    npx create-expo-app mobile --template blank
}

# Create Next.js admin project if missing
if (-not (Test-Path "admin")) {
    Write-Output "[assemble.oneclick.ps1] Creating Next.js admin app..."
    npx create-next-app admin --typescript --use-npm
}

# Install dependencies (placeholder)
Write-Output "[assemble.oneclick.ps1] Installing dependencies..."
# npm install -g firebase-tools expo-cli @next 

# Initialize Firebase (placeholder)
Write-Output "[assemble.oneclick.ps1] Initializing Firebase project..."
# firebase login
# firebase projects:create $env:FIREBASE_PROJECT_ID

# Copy configuration files or create .env
Write-Output "[assemble.oneclick.ps1] Setting up environment variables..."
$env:FIREBASE_PROJECT_ID = "<your-project-id>"
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PWD\keys\admin.json"

Write-Output "[assemble.oneclick.ps1] Assembly completed."
