import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Продакшн: самодостаточная сборка (`.next/standalone` + `.next/static` + `public`) — её копируем на сервер и запускаем `node server.js`.
  output: "standalone",
  // Идентификатор деплоя (deploy.sh ставит NEXT_DEPLOYMENT_ID при сборке): вкладка со старой версией при расхождении
  // перезагружается сама, а не падает на «Failed to find Server Action» (12.10.2026, ошибка «Не удалось сохранить» у пользователя).
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  experimental: {
    // Серверные экшены принимают файлы для ИИ (прайс-лист в PDF, лист плана этажа): лимит по умолчанию 1 МБ мал.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
