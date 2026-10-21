#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js não encontrado. Instale em https://nodejs.org e rode de novo."; exit 1; }
exec node instalar.mjs "$@"
