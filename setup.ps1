#requires -Version 5.1
<#
    熱狗小夥伴 — 開發環境自動補齊
    用法：在專案根目錄執行  .\setup.ps1
    偵測缺哪個裝哪個，已經有的直接跳過。
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$missing = @()
$installed = @()

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Miss($msg) { Write-Host "   [缺] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "   [失敗] $msg" -ForegroundColor Red }

# cargo 裝完不會馬上進 PATH，先把預設位置補上
function Add-CargoToPath {
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if ((Test-Path $cargoBin) -and ($env:Path -notlike "*$cargoBin*")) {
        $env:Path = "$cargoBin;$env:Path"
    }
}

function Test-Cmd($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Install-Pkg($id, $label, $override) {
    Write-Host "   正在安裝 $label ..." -ForegroundColor DarkGray
    $args = @(
        'install', '--id', $id, '--source', 'winget',
        '--accept-source-agreements', '--accept-package-agreements',
        '--disable-interactivity'
    )
    if ($override) { $args += @('--override', $override) }
    & winget @args
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "$label 安裝完成"
        $script:installed += $label
        return $true
    }
    Write-Fail "$label 安裝失敗 (winget exit $LASTEXITCODE)"
    $script:missing += $label
    return $false
}

Write-Host "熱狗小夥伴 — 開發環境檢查" -ForegroundColor Magenta
Write-Host ("=" * 40)

# ---- 0. winget ----
Write-Step "檢查 winget"
if (-not (Test-Cmd 'winget')) {
    Write-Fail "找不到 winget。請先從 Microsoft Store 安裝「應用程式安裝程式」後重跑本腳本。"
    exit 1
}
Write-Ok "winget 可用"

# ---- 1. Node.js ----
Write-Step "檢查 Node.js"
if (Test-Cmd 'node') {
    Write-Ok "Node.js $(node --version)"
} else {
    Write-Miss "Node.js"
    Install-Pkg 'OpenJS.NodeJS.LTS' 'Node.js LTS' $null | Out-Null
}

# ---- 2. Rust ----
Write-Step "檢查 Rust toolchain"
Add-CargoToPath
if (Test-Cmd 'cargo') {
    Write-Ok "$(rustc --version)"
} else {
    Write-Miss "Rust (cargo / rustc)"
    if (Install-Pkg 'Rustlang.Rustup' 'Rustup' $null) {
        Add-CargoToPath
        if (Test-Cmd 'rustup') { & rustup default stable-msvc }
    }
}

# ---- 3. VS C++ Build Tools ----
Write-Step "檢查 VS C++ Build Tools"
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$hasVC = $false
if (Test-Path $vswhere) {
    $found = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName
    if ($found) { $hasVC = $true }
}
if ($hasVC) {
    Write-Ok "C++ Build Tools 已安裝"
} else {
    Write-Miss "VS C++ Build Tools（Tauri 在 Windows 編譯必需，約 2-3 GB）"
    Install-Pkg 'Microsoft.VisualStudio.2022.BuildTools' 'VS 2022 Build Tools' `
        '--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended' | Out-Null
}

# ---- 4. WebView2 Runtime ----
Write-Step "檢查 WebView2 Runtime"
$wvKeys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$hasWv = $false
foreach ($k in $wvKeys) {
    if (Test-Path $k) {
        $v = (Get-ItemProperty $k -ErrorAction SilentlyContinue).pv
        if ($v -and $v -ne '0.0.0.0') { $hasWv = $true; Write-Ok "WebView2 Runtime $v"; break }
    }
}
if (-not $hasWv) {
    Write-Miss "WebView2 Runtime"
    Install-Pkg 'Microsoft.EdgeWebView2Runtime' 'WebView2 Runtime' $null | Out-Null
}

# ---- 5. npm 相依套件 ----
Write-Step "安裝 npm 相依套件"
if (Test-Cmd 'npm') {
    Push-Location $root
    try {
        & npm install
        if ($LASTEXITCODE -eq 0) { Write-Ok "node_modules 就緒" }
        else { Write-Fail "npm install 失敗"; $missing += 'npm install' }
    } finally { Pop-Location }
} else {
    Write-Fail "npm 尚未進 PATH，請開新視窗重跑本腳本"
    $missing += 'npm'
}

# ---- 收尾 ----
Write-Host "`n$("=" * 40)"
if ($installed.Count) {
    Write-Host "本次安裝：$($installed -join '、')" -ForegroundColor Green
}
if ($missing.Count) {
    Write-Host "仍有問題：$($missing -join '、')" -ForegroundColor Red
    Write-Host "請處理後重跑 .\setup.ps1" -ForegroundColor Red
    exit 1
}
Write-Host "環境就緒 🌭" -ForegroundColor Magenta
if ($installed.Count) {
    Write-Host "有裝新東西，請「開一個新的終端機視窗」再跑，否則 PATH 吃不到。" -ForegroundColor Yellow
}
Write-Host "接著執行： npm run dev`n" -ForegroundColor Cyan
