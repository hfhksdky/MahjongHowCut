@echo off
cd /d "%~dp0"
echo.
echo 本視窗請保持開啟。伺服器在跑時，瀏覽器可一直按 F5 重新整理，不必重跑此檔。
echo 開啟: http://127.0.0.1:8765/index.html
echo 關閉: 在此視窗按 Ctrl+C 或直接關閉視窗
echo.
python -m http.server 8765
if errorlevel 1 pause
