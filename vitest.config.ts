import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is supplied by Next, not by a package in node_modules, so
      // importing anything that carries the marker blows up under vitest. It is
      // stubbed here rather than removed from the modules that declare it: the
      // marker is what stops a credential helper being pulled into a client
      // bundle, and that guarantee matters more than the test runner's
      // convenience.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
