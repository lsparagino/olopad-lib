# @olopad/olotype-playground

Dev harness for [`@olopad/olotype`](../olotype). Not published.

The playground imports the lib through a tsconfig path mapping (`@olopad/olotype` → `../olotype/src/public-api.ts`), so editing files under `packages/olotype/src/` triggers a hot reload here. No `npm run build` of the lib is needed during development.

## Run

From the **monorepo root**:

```sh
npm install
npm start --workspace @olopad/olotype-playground
```

Opens at <http://localhost:4200>.

## Build

```sh
npm run build --workspace @olopad/olotype-playground
```

Output goes to `packages/olotype-playground/dist/playground/`.
