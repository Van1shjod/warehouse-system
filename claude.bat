@echo off
setlocal

REM ====== НАСТРОЙКИ ======
REM Вставь сюда НОВЫЙ ключ OmniRoute
set "ANTHROPIC_AUTH_TOKEN=sk-2587236236fc397b-00e028-230c5377"

REM Anthropic-compatible endpoint OmniRoute
set "ANTHROPIC_BASE_URL=http://localhost:20128/v1"

REM Если gateway не поддерживает experimental betas
set "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1"

REM Модель
set "ANTHROPIC_MODEL=kr/claude-sonnet-4.5"

echo Starting Claude Code via OmniRoute...

REM Запускаем настоящий Claude Code напрямую,
REM чтобы не вызвать этот BAT-файл повторно
"%AppData%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"

endlocal