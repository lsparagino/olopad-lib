import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

// Vitest config for the playground. This workspace already owns the Angular
// build chain (`@angular/build`, `compiler-cli`) needed by
// `@analogjs/vite-plugin-angular`, which compiles inline component templates
// under test — so the `<olo-type>` component spec lives here rather than in
// the library workspace.
export default defineConfig({
  plugins: [
    angular({
      tsconfig: 'tsconfig.spec.json',
      include: ['../olotype/src/**/*.ts'],
    }),
  ],
  test: {
    globals: true,
    // jsdom (not happy-dom) — ProseMirror's DOMObserver calls
    // MutationObserver.takeRecords(), which happy-dom does not implement.
    environment: 'jsdom',
    setupFiles: ['src/specs/test-setup.ts'],
    include: ['src/specs/**/*.spec.ts'],
  },
  resolve: {
    // Mirror the tsconfig path alias so the spec resolves `@olopad/olotype`
    // to the in-tree library source instead of any built artifact.
    alias: {
      '@olopad/olotype': new URL('../olotype/src/public-api.ts', import.meta.url).pathname,
    },
    // Force singletons for Angular runtime packages. Without dedupe, vite's
    // resolver picks up two copies (one via the spec, one via the aliased
    // library source), each with its own `currentInjector` global — TestBed
    // initializes one but the component reads from the other, manifesting as
    // NG0203 (`inject() must be called from an injection context`).
    dedupe: [
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      'rxjs',
    ],
  },
});
