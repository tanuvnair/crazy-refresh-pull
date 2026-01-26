import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  vite: {
    server: {
      watch: {
        ignored: ["**/data/**", "**/node_modules/**"],
      },
    },
  },
});
