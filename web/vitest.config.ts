// Юнит-тесты чистой логики (lib/*, store/* без браузера): `npm run test:unit`. Запускаются перед каждым деплоем (scripts/deploy.sh).
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only.ts") } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
