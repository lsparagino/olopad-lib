# @olopad/consent-setup

CLI tool to automate the Google Tag Manager + GA4 setup with Google Consent Mode v2.

Use this alongside [`@olopad/ngx-consent`](https://www.npmjs.com/package/@olopad/ngx-consent) to get a complete GDPR-compliant analytics setup.

## Usage

```bash
npx @olopad/consent-setup
```

Or install globally:

```bash
npm install -g @olopad/consent-setup
consent-setup
```

## Prerequisites

1. A Google Cloud project with these APIs enabled:
   - [Google Tag Manager API](https://console.cloud.google.com/apis/library/tagmanager.googleapis.com)
   - [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)

2. OAuth2 credentials (Desktop app type):
   - Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   - Click **Create Credentials → OAuth client ID → Desktop app**
   - Download the JSON and save it as `client_secret.json` in your working directory

## What it does

1. Opens your browser for Google authentication
2. Creates (or selects existing) GA4 property + web data stream → **Measurement ID**
3. Creates (or selects existing) GTM container
4. Creates a GA4 tag with consent settings (`analytics_storage` required)
5. Publishes the GTM container version
6. Prints the `gtmId` and `measurementId` for your app config
