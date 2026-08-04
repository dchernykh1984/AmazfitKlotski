import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The watch page imports the `@zos/*` modules Zepp OS provides at runtime; they
// are not npm packages and cannot be installed. Point them at hand-written stubs
// so the page can be built, driven and inspected in a unit test. Nothing in lib/
// touches them - only page/index.js does.
const stub = (name) => fileURLToPath(new URL(`./test/stubs/${name}.mjs`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@zos/ui": stub("zos-ui"),
      "@zos/device": stub("zos-device"),
      "@zos/settings": stub("zos-settings"),
      "@zos/interaction": stub("zos-interaction"),
      "@zos/display": stub("zos-display"),
      "@zos/storage": stub("zos-storage"),
    },
  },
});
