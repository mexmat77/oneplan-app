import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Продакшн: самодостаточная сборка (`.next/standalone` + `.next/static` + `public`) — её копируем на сервер и запускаем `node server.js`.
  output: "standalone",
  experimental: {
    // Серверные экшены принимают файлы для ИИ (прайс-лист в PDF, лист плана этажа): лимит по умолчанию 1 МБ мал.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
