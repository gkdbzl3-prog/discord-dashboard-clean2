@echo off
chcp 65001
title Multi-Runner (Bot + ngrok)

REM 1. 디스코드 봇 실행
cd /d C:\Users\user\Documents\discord-dashboard-clean2
start "Discord Bot" cmd /k "node bot.js"

echo 7초 대기 중...
timeout /t 7

REM 2. ngrok 실행 (ngrok 폴더로 이동해서 실행)
cd /d C:\finalUsers\user\AppData\Local\ngrok
start "ngrok Tunnel" cmd /k "ngrok http 3000"

echo 모든 프로세스가 시작되었습니다!
pause
