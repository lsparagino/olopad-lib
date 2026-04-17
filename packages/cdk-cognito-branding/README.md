# @olopad/cdk-cognito-branding

AWS CDK construct for applying OloPad-themed managed login branding to Amazon Cognito user pools.

## Features

- **Dark theme** — OloPad brand colors (`#00FFCC` primary, `#0A0A0F` background)
- **Logo support** — Optional logo image (PNG, SVG, JPG) displayed above the login form
- **Full branding** — Styles all Cognito managed login UI components (buttons, inputs, alerts, etc.)

## Installation

```bash
npm install @olopad/cdk-cognito-branding
```

## Usage

```typescript
import { ManagedLoginBrandingConstruct } from '@olopad/cdk-cognito-branding';

// In your CDK stack:
new ManagedLoginBrandingConstruct(this, 'MyBranding', {
  userPoolId: userPool.userPoolId,
  clientId: userPoolClient.userPoolClientId,
  logoFilePath: path.resolve(__dirname, '..', 'assets', 'logo.png'), // optional
});
```

## Props

| Property | Type | Required | Description |
|---|---|---|---|
| `userPoolId` | `string` | ✅ | Cognito User Pool ID |
| `clientId` | `string` | ✅ | Cognito App Client ID |
| `logoFilePath` | `string` | ❌ | Path to a logo image file (PNG, SVG, or JPG) |

## What it configures

- Page background: `#0A0A0F` (OloPad dark)
- Primary button: `#00FFCC` with dark text
- Form card: Dark glassmorphic style with subtle borders
- All input fields, dropdowns, toggles, alerts, and links
- Dark color scheme mode enforced
- Header/footer hidden by default
