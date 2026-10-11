#!/usr/bin/env bash
# Первичная настройка чистого Ubuntu-сервера под OnePlan (Hetzner, 2.28.56.160). Запускать на сервере от root:
#   ssh oneplan 'bash -s' < scripts/server-setup.sh
# Ставит Node 22 + pm2, nginx, certbot; создаёт /var/www/oneplan и сайт nginx (пока только HTTP).
# Сертификат выпускается отдельно, когда DNS ai.one-plan.pro укажет на этот сервер:
#   certbot --nginx -d ai.one-plan.pro --non-interactive --agree-tos -m mexmat77@gmail.com --redirect
# .env приложения копируется со старого сервера отдельно (см. deploy-инструкцию), сборка — локально через scripts/deploy.sh.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl ca-certificates gnupg nginx certbot python3-certbot-nginx rsync
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
npm install -g pm2@latest >/dev/null
mkdir -p /var/www/oneplan
cat > /etc/nginx/sites-available/oneplan <<'NG'
server {
    listen 80;
    server_name ai.one-plan.pro www.ai.one-plan.pro;
    client_max_body_size 30m;
    # Supabase SSR пишет большие Set-Cookie (сессия ~4–8 КБ в нескольких cookies); с буфером 4k по умолчанию nginx отдаёт 502
    # «upstream sent too big header».
    proxy_buffer_size 64k;
    proxy_buffers 8 64k;
    proxy_busy_buffers_size 128k;
    large_client_header_buffers 4 32k;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
NG
ln -sf /etc/nginx/sites-available/oneplan /etc/nginx/sites-enabled/oneplan
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx
# pm2 автозапуск при перезагрузке
pm2 startup systemd -u root --hp /root >/dev/null || true
echo "node $(node -v), pm2 $(pm2 -v), nginx ok, /var/www/oneplan готов"
