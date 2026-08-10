<#
.SYNOPSIS
    Build (if needed) and launch the GitDesktop development app.

.DESCRIPTION
    Double-click run-dev.cmd to use this. Windows opens .ps1 files in an editor
    when double-clicked rather than running them, so the .cmd shim exists to
    invoke this properly.

    Renderer changes hot-reload once the app is running, so a rebuild is only
    needed when main-process or build-script code changes. This detects that by
    timestamp instead of rebuilding every launch, which would cost about a
    minute each time.

.PARAMETER Rebuild
    Force a rebuild even if nothing looks stale.

.PARAMETER NoBuild
    Skip the build entirely and launch whatever is already built.
#>
[CmdletBinding()]
param(
    [switch] $Rebuild,
    [switch] $NoBuild
)

$ErrorActionPreference = 'Stop'

# Double-clicking starts in C:\Windows\System32, so anchor to this file.
Set-Location -Path $PSScriptRoot

$exitCode = 0

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Failure($message) {
    Write-Host ""
    Write-Host "ERROR: $message" -ForegroundColor Red
}

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is not on PATH. Install it from https://nodejs.org and reopen this window."
    }

    # Prefer a real yarn install; fall back to npx so this works on a machine
    # that has never had yarn installed. yarn.lock is v1 format, so classic
    # yarn is the correct version -- do not let npx pick latest.
    $yarnCmd = Get-Command yarn -ErrorAction SilentlyContinue
    if ($yarnCmd) {
        $yarnExe = 'yarn'
        $yarnArgs = @()
    } else {
        Write-Host "yarn not found on PATH; using npx (slower). 'npm install --global yarn' to speed this up." -ForegroundColor Yellow
        $yarnExe = 'npx'
        $yarnArgs = @('--yes', 'yarn@1.22.22')
    }

    function Invoke-Yarn {
        param(
            [Parameter(Mandatory = $true)][string[]] $Arguments,
            # `yarn start` runs until the user stops it, and Ctrl+C leaves a
            # non-zero exit code. That is a normal end to the session, not a
            # failure worth reporting as one.
            [switch] $AllowNonZeroExit
        )

        $allArgs = $yarnArgs + $Arguments
        & $yarnExe @allArgs

        if ($LASTEXITCODE -ne 0 -and -not $AllowNonZeroExit) {
            throw "'$yarnExe $($allArgs -join ' ')' failed with exit code $LASTEXITCODE."
        }
    }

    if (-not (Test-Path 'node_modules')) {
        Write-Step "Installing dependencies (first run, this takes a few minutes)"
        Invoke-Yarn @('install')
    }

    # Architecture is not assumed: the packaged folder is GitDesktop-dev-win32-<arch>.
    $appExe = Get-ChildItem -Path 'dist' -Filter 'GitDesktop-dev.exe' -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    $needsBuild = $false

    if ($NoBuild) {
        if (-not $appExe) {
            throw "-NoBuild was given but no build exists yet. Run without -NoBuild first."
        }
    } elseif ($Rebuild) {
        $needsBuild = $true
    } elseif (-not $appExe) {
        Write-Host "No existing build found." -ForegroundColor Yellow
        $needsBuild = $true
    } else {
        # Only main-process and build-script changes require repackaging;
        # everything in the renderer is served by the dev server.
        $watched = @('app\src\main-process', 'script', 'app\package.json')
        $newest = $null

        foreach ($path in $watched) {
            if (-not (Test-Path $path)) { continue }

            $candidate = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

            if ($candidate -and (-not $newest -or $candidate.LastWriteTime -gt $newest.LastWriteTime)) {
                $newest = $candidate
            }
        }

        if ($newest -and $newest.LastWriteTime -gt $appExe.LastWriteTime) {
            Write-Host "Main-process code changed since the last build ($($newest.Name))." -ForegroundColor Yellow
            $needsBuild = $true
        }
    }

    if ($needsBuild) {
        # The build deletes dist\ before repackaging, which Windows refuses
        # while a previous instance still has files in it open. The failure
        # surfaces as a bare "EPERM, Permission denied" on the directory,
        # several hundred lines into an otherwise successful webpack run, and
        # says nothing about the app being open. Catch it here instead.
        $running = @(Get-Process 'GitDesktop-dev' -ErrorAction SilentlyContinue)

        if ($running.Count -gt 0) {
            Write-Host ""
            Write-Host "GitDesktop-dev is already running ($($running.Count) process(es))." -ForegroundColor Yellow
            Write-Host "A rebuild cannot replace dist\ while it is open." -ForegroundColor Yellow
            $answer = Read-Host "Close it and continue? [Y/n]"

            if ($answer -eq '' -or $answer -match '^[Yy]') {
                $running | Stop-Process -Force
                # Stop-Process returns before the handles are actually gone.
                Start-Sleep -Milliseconds 750
                Write-Host "Closed." -ForegroundColor DarkGray
            } else {
                throw "Close GitDesktop-dev and run this again, or pass -NoBuild to launch the existing build."
            }
        }

        Write-Step "Building development app (about a minute)"
        Invoke-Yarn @('build:dev')
    } else {
        Write-Host "Build is up to date. Use -Rebuild to force one." -ForegroundColor DarkGray
    }

    Write-Step "Starting GitDesktop (dev)"
    Write-Host "The dev build has a TEAL icon and is named GitDesktop-dev, so it will not" -ForegroundColor DarkGray
    Write-Host "collide with an installed GitHub Desktop or a release GitDesktop." -ForegroundColor DarkGray
    Write-Host "Press Ctrl+C here to stop the dev server." -ForegroundColor DarkGray

    Invoke-Yarn @('start') -AllowNonZeroExit
} catch {
    Write-Failure $_.Exception.Message
    $exitCode = 1
} finally {
    if ($exitCode -ne 0) {
        Write-Host ""
        Read-Host "Press Enter to close"
    }
}

exit $exitCode
