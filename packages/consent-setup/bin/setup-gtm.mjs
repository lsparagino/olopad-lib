#!/usr/bin/env node

/**
 * GTM + GA4 Consent Mode v2 Setup Script
 *
 * This script automates the full Google-side setup:
 *   1. Creates a GA4 property + web data stream → Measurement ID
 *   2. Creates a GTM container (or uses existing) → Container ID
 *   3. Creates a GA4 tag in GTM with consent settings
 *   4. Creates the "All Pages" trigger
 *   5. Publishes the GTM container version
 *
 * Prerequisites:
 *   - A Google Cloud project with these APIs enabled:
 *       • Google Tag Manager API
 *       • Google Analytics Admin API
 *   - OAuth2 client credentials (Desktop app type)
 *     Download the client_secret JSON and place it as `client_secret.json` in the working directory
 *
 * Usage:
 *   npx @olopad/consent-setup
 *
 *   Or after global install:
 *   consent-setup
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import open from 'open';
import { createInterface } from 'readline';

// ── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function log(msg) { console.log(`\x1b[36m[consent-setup]\x1b[0m ${msg}`); }
function success(msg) { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function warn(msg) { console.log(`\x1b[33m⚠\x1b[0m ${msg}`); }
function error(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); }

// ── OAuth2 ───────────────────────────────────────────────────────────────────

const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.manage.accounts',
  'https://www.googleapis.com/auth/analytics.edit',
];

const TOKEN_PATH = './oauth_token.json';
const CLIENT_SECRET_PATH = './client_secret.json';

async function authenticate() {
  if (!existsSync(CLIENT_SECRET_PATH)) {
    error(`Missing ${CLIENT_SECRET_PATH}`);
    console.log(`
To create OAuth2 credentials:
  1. Go to https://console.cloud.google.com/apis/credentials
  2. Click "Create Credentials" → "OAuth client ID"
  3. Application type: "Desktop app"
  4. Download the JSON and save it as "${CLIENT_SECRET_PATH}" in this directory
  5. Enable these APIs in your project:
     • Google Tag Manager API
     • Google Analytics Admin API
`);
    process.exit(1);
  }

  const credentials = JSON.parse(readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const redirectUri = 'http://localhost:3847/oauth2callback';

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Check for existing token
  if (existsSync(TOKEN_PATH)) {
    const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);

    // Refresh if expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      log('Refreshing expired token...');
      const { credentials: newCreds } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newCreds);
      writeFileSync(TOKEN_PATH, JSON.stringify(newCreds, null, 2));
    }

    // Verify token has required scopes
    if (token.scope) {
      log(`Token scopes: ${token.scope}`);
      if (!token.scope.includes('tagmanager.publish')) {
        warn('Token is missing tagmanager.publish scope — re-authenticating...');
      } else {
        success('Authenticated with existing token');
        return oauth2Client;
      }
    } else {
      success('Authenticated with existing token');
      return oauth2Client;
    }
  }

  // Interactive OAuth2 flow
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  log('Opening browser for authentication...');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3847');
      const authCode = url.searchParams.get('code');
      if (authCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>✔ Authentication successful!</h2><p>You can close this tab.</p></body></html>');
        server.close();
        resolve(authCode);
      } else {
        res.writeHead(400);
        res.end('Missing code parameter');
      }
    });

    server.listen(3847, () => {
      open(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => { server.close(); reject(new Error('OAuth timeout (60s)')); }, 60000);
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  success('Authentication complete — token saved');

  return oauth2Client;
}

// ── GA4 Setup ────────────────────────────────────────────────────────────────

async function setupGA4(auth) {
  log('Setting up Google Analytics 4...');

  const analyticsAdmin = new AnalyticsAdminServiceClient({
    authClient: auth,
  });

  // List existing accounts
  const [accounts] = await analyticsAdmin.listAccounts();
  if (!accounts || accounts.length === 0) {
    error('No Google Analytics accounts found. Create one at https://analytics.google.com/');
    process.exit(1);
  }

  console.log('\nAvailable GA accounts:');
  accounts.forEach((acc, i) => {
    console.log(`  ${i + 1}. ${acc.displayName} (${acc.name})`);
  });

  const accIdx = parseInt(await prompt('\nSelect account number: ')) - 1;
  const account = accounts[accIdx];
  if (!account) { error('Invalid selection'); process.exit(1); }

  // Check for existing GA4 properties
  const [properties] = await analyticsAdmin.listProperties({
    filter: `parent:${account.name}`,
  });

  let property;
  if (properties && properties.length > 0) {
    console.log('\nExisting GA4 properties:');
    properties.forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.displayName} (${prop.name})`);
    });
    console.log(`  ${properties.length + 1}. [Create new property]`);

    const propIdx = parseInt(await prompt('\nSelect property or create new: ')) - 1;
    if (propIdx < properties.length) {
      property = properties[propIdx];
      success(`Using existing property: ${property.displayName}`);
    }
  }

  if (!property) {
    const propName = await prompt('Enter new property name (e.g. "My Website"): ');
    const timezone = await prompt('Timezone (e.g. "Europe/Rome") [Europe/Rome]: ') || 'Europe/Rome';

    const [newProp] = await analyticsAdmin.createProperty({
      property: {
        displayName: propName,
        parent: account.name,
        timeZone: timezone,
        currencyCode: 'EUR',
      },
    });
    property = newProp;
    success(`Created GA4 property: ${property.displayName}`);
  }

  // Check for existing data streams
  const [streams] = await analyticsAdmin.listDataStreams({
    parent: property.name,
  });

  let dataStream;
  const webStreams = streams?.filter(s => s.type === 'WEB_DATA_STREAM') || [];

  if (webStreams.length > 0) {
    console.log('\nExisting web data streams:');
    webStreams.forEach((ds, i) => {
      const measurementId = ds.webStreamData?.measurementId || 'N/A';
      console.log(`  ${i + 1}. ${ds.displayName} — ${measurementId}`);
    });
    console.log(`  ${webStreams.length + 1}. [Create new stream]`);

    const dsIdx = parseInt(await prompt('\nSelect data stream or create new: ')) - 1;
    if (dsIdx < webStreams.length) {
      dataStream = webStreams[dsIdx];
      success(`Using existing stream: ${dataStream.displayName}`);
    }
  }

  if (!dataStream) {
    const siteUrl = await prompt('Enter website URL (e.g. "https://olopad.com"): ');
    const streamName = await prompt('Stream name [Web]: ') || 'Web';

    const [newStream] = await analyticsAdmin.createDataStream({
      parent: property.name,
      dataStream: {
        type: 'WEB_DATA_STREAM',
        displayName: streamName,
        webStreamData: { defaultUri: siteUrl },
      },
    });
    dataStream = newStream;
    success(`Created data stream: ${dataStream.displayName}`);
  }

  const measurementId = dataStream.webStreamData?.measurementId;
  success(`GA4 Measurement ID: ${measurementId}`);

  return { measurementId, propertyName: property.name };
}

// ── GTM Setup ────────────────────────────────────────────────────────────────

async function setupGTM(auth, measurementId) {
  log('Setting up Google Tag Manager...');

  const tagmanager = google.tagmanager({ version: 'v2', auth });

  // List accounts
  const { data: { account: gtmAccounts } } = await tagmanager.accounts.list();
  if (!gtmAccounts || gtmAccounts.length === 0) {
    error('No GTM accounts found. Create one at https://tagmanager.google.com/');
    process.exit(1);
  }

  console.log('\nAvailable GTM accounts:');
  gtmAccounts.forEach((acc, i) => {
    console.log(`  ${i + 1}. ${acc.name} (${acc.path})`);
  });

  const gtmAccIdx = parseInt(await prompt('\nSelect GTM account number: ')) - 1;
  const gtmAccount = gtmAccounts[gtmAccIdx];
  if (!gtmAccount) { error('Invalid selection'); process.exit(1); }

  // List containers
  const { data: { container: containers } } = await tagmanager.accounts.containers.list({
    parent: gtmAccount.path,
  });

  let container;
  if (containers && containers.length > 0) {
    console.log('\nExisting containers:');
    containers.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} — ${c.publicId}`);
    });
    console.log(`  ${containers.length + 1}. [Create new container]`);

    const cIdx = parseInt(await prompt('\nSelect container or create new: ')) - 1;
    if (cIdx < containers.length) {
      container = containers[cIdx];
      success(`Using existing container: ${container.name} (${container.publicId})`);
    }
  }

  if (!container) {
    const containerName = await prompt('Enter container name (e.g. "olopad.com"): ');
    const { data: newContainer } = await tagmanager.accounts.containers.create({
      parent: gtmAccount.path,
      requestBody: {
        name: containerName,
        usageContext: ['web'],
      },
    });
    container = newContainer;
    success(`Created GTM container: ${container.name} (${container.publicId})`);
  }

  // Create a workspace
  log('Creating workspace...');
  const { data: workspace } = await tagmanager.accounts.containers.workspaces.create({
    parent: container.path,
    requestBody: {
      name: `${container.name} — Consent Mode`,
      description: 'Automated consent-mode setup via @olopad/consent-setup',
    },
  });
  success(`Workspace created: ${workspace.name}`);

  // List existing triggers to find "Initialization - All Pages" (ID: 2147479573)
  // and "All Pages" (ID: 2147479553) — these are built-in
  const { data: { trigger: existingTriggers } } = await tagmanager.accounts.containers.workspaces.triggers.list({
    parent: workspace.path,
  });

  // Find or create the "Consent Initialization" trigger
  let initTriggerId;
  const initTrigger = existingTriggers?.find(t => t.name === 'Initialization - All Pages');
  if (initTrigger) {
    initTriggerId = initTrigger.triggerId;
  } else {
    // Create "All Pages" trigger as fallback
    const { data: newTrigger } = await tagmanager.accounts.containers.workspaces.triggers.create({
      parent: workspace.path,
      requestBody: {
        name: 'All Pages',
        type: 'pageview',
      },
    });
    initTriggerId = newTrigger.triggerId;
  }

  // Create GA4 Google Tag
  log('Creating GA4 tag...');
  const { data: ga4Tag } = await tagmanager.accounts.containers.workspaces.tags.create({
    parent: workspace.path,
    requestBody: {
      name: 'GA4 - Google Tag',
      type: 'googtag',
      parameter: [
        { type: 'template', key: 'tagId', value: measurementId },
      ],
      consentSettings: {
        consentStatus: 'needed',
        consentType: {
          type: 'list',
          list: [
            { type: 'template', value: 'analytics_storage' },
          ],
        },
      },
      firingTriggerId: [initTriggerId],
    },
  });
  success(`GA4 tag created: ${ga4Tag.name} (Measurement ID: ${measurementId})`);

  // Create and publish version
  const shouldPublish = (await prompt('\nPublish this GTM container version? (y/n) [y]: ') || 'y').toLowerCase();
  if (shouldPublish === 'y') {
    log('Publishing container version...');
    const { data: version } = await tagmanager.accounts.containers.workspaces.create_version({
      path: workspace.path,
      requestBody: {
        name: 'Consent Mode v2 Setup',
        notes: 'Automated setup: GA4 tag with consent mode',
      },
    });

    // Publish the version
    try {
      await tagmanager.accounts.containers.versions.publish({
        path: version.containerVersion.path,
      });
      success('Container version published!');
    } catch (pubErr) {
      warn(`Auto-publish failed: ${pubErr.message}`);
      warn('Please publish manually: tagmanager.google.com → your container → Submit → Publish');
    }
  } else {
    warn('Skipped publishing. You can publish manually in GTM.');
  }

  return { containerId: container.publicId };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  @olopad/consent-setup                                       ║
║  Sets up GTM + GA4 with Consent Mode v2                      ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    const auth = await authenticate();

    // Step 1: GA4
    const { measurementId } = await setupGA4(auth);

    // Step 2: GTM
    const { containerId } = await setupGTM(auth, measurementId);

    // Summary
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ✔ Setup Complete!                                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  GTM Container ID:    ${containerId.padEnd(38)}║
║  GA4 Measurement ID:  ${measurementId.padEnd(38)}║
║                                                              ║
║  Next steps:                                                 ║
║  1. Update your app config:                                  ║
║                                                              ║
║     provideConsent({                                         ║
║       gtmId: '${containerId}',${' '.repeat(Math.max(0, 28 - containerId.length))}║
║       privacyPolicyUrl: '/privacy',                          ║
║     })                                                       ║
║                                                              ║
║  2. Verify in GTM Preview mode                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  } catch (err) {
    error(`Setup failed: ${err.message}`);
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
