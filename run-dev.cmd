@echo off
REM Double-click this to build and launch the GitDesktop dev app.
REM
REM This shim exists because Windows opens .ps1 files in an editor when you
REM double-click them rather than running them, and because the default
REM execution policy blocks unsigned local scripts.
REM
REM Pass -Rebuild to force a rebuild, or -NoBuild to skip it:
REM   run-dev.cmd -Rebuild

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-dev.ps1" %*
