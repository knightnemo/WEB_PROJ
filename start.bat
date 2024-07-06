@echo off
echo Starting db-manager...
start "" cmd /c "cd db-manager && call db-manager-start.bat"

timeout /t 5 /nobreak

echo Starting doctor...
start "" cmd /c "cd doctor && call doctor-start.bat"

echo Starting course...
start "" cmd /c "cd source && call source-start.bat"

echo Starting patient...
start "" cmd /c "cd patient && call patient-start.bat"

echo Starting tw-portal...
start "" cmd /c "cd tw-portal && call tw-portal-start.bat"

timeout /t 60 /nobreak

echo Starting login-panel...
start "" cmd /c "cd login-panel && call login-panel-start.bat"

echo All processes started.
pause
