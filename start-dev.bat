@echo off
cd /d "%~dp0"
npx browser-sync start --server --index "premodel_homepage_prototype.html" --files "**/*.html,images/**"
