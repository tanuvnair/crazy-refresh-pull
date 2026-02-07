import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  vite: {
    server: {
      watch: {
        ignored: ["**/node_modules/**"],
      },
    },
  },
});
