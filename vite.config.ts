import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

// Version label shown in the game: the latest git tag (e.g. "v2.0.0"),
// falling back to package.json when git is not available.
function versionLabel(): string {
  try {
    return execSync('git describe --tags --always', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return `v${pkg.version}`;
  }
}

export default defineConfig({
  // Relative paths so the build works on GitHub Pages (sub-path) and from a downloaded zip.
  base: './',
  // Everything (JS + CSS) is inlined into one index.html, so it also runs from file://.
  plugins: [svelte(), viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(versionLabel()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
