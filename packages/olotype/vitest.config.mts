import { defineConfig } from 'vitest/config';

// Vitest config for `@olopad/olotype`.
//
// All specs in the library workspace are pure TS / ProseMirror — Vitest's
// default esbuild loader handles them. The Angular component spec for
// `<olo-type>` lives in the `olotype-playground` workspace, which already
// owns the Angular build chain (`@angular/build`, compiler-cli, etc.) needed
// to compile inline component templates under test.
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**'],
  },
});
