import { Provider, APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { CONSENT_CONFIG, ConsentConfig } from './consent.config';
import { ConsentService } from './consent.service';

/**
 * Provides the consent module with the given configuration.
 * Add this to your app's providers array.
 *
 * @example
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideConsent({
 *       gtmId: 'GTM-XXXXXXX',
 *       privacyPolicyUrl: '/privacy',
 *       branding: { logoUrl: '/img/logo.svg', logoAlt: 'My App' },
 *     }),
 *   ],
 * };
 * ```
 */
export function provideConsent(config: ConsentConfig): EnvironmentProviders {
  const providers: Provider[] = [
    { provide: CONSENT_CONFIG, useValue: config },
    {
      provide: APP_INITIALIZER,
      useFactory: (consentService: ConsentService) => () => consentService.initialize(),
      deps: [ConsentService],
      multi: true,
    },
  ];

  return makeEnvironmentProviders(providers);
}
