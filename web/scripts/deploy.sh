#!/usr/bin/env bash
# Деплой на one-plan.pro (прод) или ai.one-plan.pro (staging): продакшн-сборка на этом компьютере → standalone-артефакты по rsync → перезапуск pm2.
# Запуск: `cd web && ./scripts/deploy.sh`.
# Сервер: Hetzner 2.28.56.160 (Ubuntu 26.04, 4 ГБ), первичная настройка — scripts/server-setup.sh; nginx → 127.0.0.1:3000,
# pm2 «oneplan», certbot. Старый сервер 130.49.173.203 (Россия: API Anthropic отвечал 403) — алиас oneplan-old, выключен после переезда.
# Переменные окружения живут на сервере в /var/www/oneplan/.env (туда скрипт не лезет; при изменении — scp вручную и pm2 restart).
set -euo pipefail
cd "$(dirname "$0")/.."
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null
HOST=oneplan            # алиас из ~/.ssh/config (ключ ~/.ssh/oneplan_deploy)
# `./scripts/deploy.sh staging` → тестовая копия: /var/www/oneplan-staging, pm2 «oneplan-staging» на 3001, https://ai.one-plan.pro
# (своя .env с NEXT_PUBLIC_STAGE=staging — баннер «тестовая версия»). Прод — без аргумента.
STAGE="${1:-prod}"
if [ "$STAGE" = "staging" ]; then DIR=/var/www/oneplan-staging; APP=oneplan-staging; PORT=3001; URL=https://ai.one-plan.pro/; else DIR=/var/www/oneplan; APP=oneplan; PORT=3000; URL=https://one-plan.pro/; fi
echo "▸ проверка"; npx tsc --noEmit && npx eslint src --quiet && npm run test:unit --silent
echo "▸ сборка";   NEXT_DEPLOYMENT_ID="$(date +%Y%m%d%H%M%S)-$STAGE" npm run build >/dev/null
echo "▸ загрузка"
rsync -az --delete --exclude .env -e "ssh -o BatchMode=yes" .next/standalone/ "$HOST:$DIR/"
rsync -az --delete -e "ssh -o BatchMode=yes" .next/static/ "$HOST:$DIR/.next/static/"
rsync -az --delete --exclude proto -e "ssh -o BatchMode=yes" public/ "$HOST:$DIR/public/"
echo "▸ перезапуск"
ssh -o BatchMode=yes "$HOST" "cd $DIR && set -a && . ./.env && set +a && export PORT=$PORT && (pm2 restart $APP --update-env >/dev/null 2>&1 || pm2 start server.js --name $APP >/dev/null) && pm2 save >/dev/null && sleep 3 && pm2 ls | grep -c online"
curl -s -o /dev/null -w "▸ $URL → HTTP %{http_code}\n" --max-time 30 "$URL"
curl -s --max-time 30 "${URL}api/health"; echo
