@echo off
setlocal

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VSDEVCMD="

if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "VSDEVCMD=%%I\Common7\Tools\VsDevCmd.bat"
  )
)

if not defined VSDEVCMD if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" set "VSDEVCMD=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if not defined VSDEVCMD if exist "%ProgramFiles%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" set "VSDEVCMD=%ProgramFiles%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"

if not defined VSDEVCMD (
  echo [error] Build Tools environment not found. Please install Visual Studio 2022 Build Tools with C++ workload.
  exit /b 1
)

if not exist "%VSDEVCMD%" (
  echo [error] Build Tools environment not found. Please install Visual Studio 2022 Build Tools with C++ workload.
  exit /b 1
)

call "%VSDEVCMD%" -no_logo -arch=x64 -host_arch=x64 >nul
if errorlevel 1 (
  echo [error] Failed to initialize Visual Studio build environment.
  exit /b 1
)

if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

cargo -V >nul 2>nul
if errorlevel 1 (
  echo [error] cargo not found. Install Rust with rustup and reopen terminal.
  exit /b 1
)

set "DEV_PORT=1420"
powershell -NoProfile -Command ^
  "$port = %DEV_PORT%; $conn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $conn) { exit 0 }; $ownerPid = $conn.OwningProcess; $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -ieq 'node') { Write-Host ('[info] Port ' + $port + ' is occupied by node (PID ' + $ownerPid + '). Stopping stale process...'); Stop-Process -Id $ownerPid -Force; Start-Sleep -Seconds 1; exit 0 }; if ($proc) { Write-Host ('[error] Port ' + $port + ' is occupied by ' + $proc.ProcessName + ' (PID ' + $ownerPid + '). Please close it and retry.') } else { Write-Host ('[error] Port ' + $port + ' is occupied by PID ' + $ownerPid + '. Please close it and retry.') }; exit 1"
if errorlevel 1 exit /b 1

call npm run tauri:dev:raw %*
