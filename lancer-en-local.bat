@echo off
rem Lance le jeu en local : petit serveur Python, puis ouverture du navigateur.
cd /d "%~dp0"
start "" http://127.0.0.1:8765/index.html
python serveur_local.py 8765 || py serveur_local.py 8765
pause
