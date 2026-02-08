import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "src/middleware/index.ts",
  vite: {
    server: {
      watch: {
        ignored: ["**/node_modules/**"],
      },
    },
  },
});
