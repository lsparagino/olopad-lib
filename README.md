# OloPad Libraries

Reusable npm packages for the OloPad ecosystem.

## Packages

| Package | Description |
|---------|-------------|
| [`@olopad/ngx-consent`](./packages/ngx-consent/) | Angular GDPR cookie consent with GTM & Google Consent Mode v2 |
| [`@olopad/cdk-cognito-branding`](./packages/cdk-cognito-branding/) | AWS CDK construct for Cognito managed login branding |
| [`@olopad/consent-setup`](./packages/consent-setup/) | CLI tool to automate GTM + GA4 setup with Consent Mode v2 |

## Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build --workspaces
```

## Structure

This is an npm workspaces monorepo. Each package lives under `packages/` and can be developed, built, and published independently.
