import { Construct } from 'constructs';
import { CfnManagedLoginBranding } from 'aws-cdk-lib/aws-cognito';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ManagedLoginBrandingProps {
  userPoolId: string;
  clientId: string;
  /**
   * Optional path to a logo image file (PNG, SVG, or JPG).
   * Displayed outside/above the form.
   */
  logoFilePath?: string;
}

export class ManagedLoginBrandingConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ManagedLoginBrandingProps) {
    super(scope, id);

    const assets: CfnManagedLoginBranding.AssetTypeProperty[] = [];

    if (props.logoFilePath) {
      const absolutePath = path.isAbsolute(props.logoFilePath)
        ? props.logoFilePath
        : path.resolve(process.cwd(), props.logoFilePath);

      const logoBytes = fs.readFileSync(absolutePath);
      const base64Logo = logoBytes.toString('base64');
      const ext = path.extname(absolutePath).replace('.', '').toUpperCase();

      assets.push({
        category: 'FORM_LOGO',
        colorMode: 'DARK',
        extension: ext,
        bytes: base64Logo,
      });
    }

    const hasLogo = !!props.logoFilePath;

    new CfnManagedLoginBranding(this, 'Branding', {
      userPoolId: props.userPoolId,
      clientId: props.clientId,
      returnMergedResources: true,
      settings: {
        components: {
          secondaryButton: {
            darkMode: {
              hover: {
                backgroundColor: '192534ff',
                borderColor: '89bdeeff',
                textColor: '89bdeeff',
              },
              defaults: {
                backgroundColor: '0f1b2aff',
                borderColor: '00ffccff',
                textColor: '00ffccff',
              },
              active: {
                backgroundColor: '354150ff',
                borderColor: '89bdeeff',
                textColor: '89bdeeff',
              },
            },
          },
          form: {
            borderRadius: 5,
            backgroundImage: { enabled: false },
            logo: {
              location: 'CENTER',
              position: 'TOP',
              enabled: hasLogo,
              formInclusion: 'OUT',
            },
            darkMode: {
              backgroundColor: '16161dff',
              borderColor: '424650ff',
            },
          },
          alert: {
            borderRadius: 12,
            darkMode: {
              error: {
                backgroundColor: '1a0000ff',
                borderColor: 'eb6f6fff',
              },
            },
          },
          pageBackground: {
            image: { enabled: false },
            darkMode: {
              color: '0A0A0Fff',
            },
          },
          pageText: {
            darkMode: {
              bodyColor: 'b6bec9ff',
              headingColor: 'd1d5dbff',
              descriptionColor: 'b6bec9ff',
            },
          },
          primaryButton: {
            darkMode: {
              hover: {
                backgroundColor: '89bdeeff',
                textColor: '000716ff',
              },
              defaults: {
                backgroundColor: '00ffccff',
                textColor: '0A0A0Fff',
              },
              active: {
                backgroundColor: '539fe5ff',
                textColor: '000716ff',
              },
              disabled: {
                backgroundColor: 'ffffffff',
                borderColor: 'ffffffff',
              },
            },
          },
          pageFooter: {
            backgroundImage: { enabled: false },
            logo: { location: 'START', enabled: false },
            darkMode: {
              borderColor: '424650ff',
              background: { color: '0f141aff' },
            },
          },
          pageHeader: {
            backgroundImage: { enabled: false },
            logo: { location: 'START', enabled: false },
            darkMode: {
              borderColor: '424650ff',
              background: { color: '0f141aff' },
            },
          },
          idpButton: {
            standard: {
              darkMode: {
                hover: {
                  backgroundColor: '192534ff',
                  borderColor: '89bdeeff',
                  textColor: '89bdeeff',
                },
                defaults: {
                  backgroundColor: '0f1b2aff',
                  borderColor: 'c6c6cdff',
                  textColor: 'c6c6cdff',
                },
                active: {
                  backgroundColor: '354150ff',
                  borderColor: '89bdeeff',
                  textColor: '89bdeeff',
                },
              },
            },
            custom: {},
          },
        },
        componentClasses: {
          dropDown: {
            borderRadius: 8,
            darkMode: {
              hover: {
                itemBackgroundColor: '081120ff',
                itemBorderColor: '5f6b7aff',
                itemTextColor: 'e9ebedff',
              },
              defaults: {
                itemBackgroundColor: '192534ff',
              },
              match: {
                itemBackgroundColor: 'd1d5dbff',
                itemTextColor: '89bdeeff',
              },
            },
          },
          input: {
            borderRadius: 5,
            darkMode: {
              defaults: {
                backgroundColor: '0f1b2aff',
                borderColor: '5f6b7aff',
              },
              placeholderColor: '8d99a8ff',
            },
          },
          inputDescription: {
            darkMode: {
              textColor: '8d99a8ff',
            },
          },
          buttons: {
            borderRadius: 5,
          },
          optionControls: {
            darkMode: {
              defaults: {
                backgroundColor: '0f1b2aff',
                borderColor: '7d8998ff',
              },
              selected: {
                backgroundColor: '539fe5ff',
                foregroundColor: '000716ff',
              },
            },
          },
          statusIndicator: {
            darkMode: {
              success: {
                backgroundColor: '001a02ff',
                borderColor: '29ad32ff',
                indicatorColor: '29ad32ff',
              },
              pending: { indicatorColor: 'AAAAAAAA' },
              warning: {
                backgroundColor: '1d1906ff',
                borderColor: 'e0ca57ff',
                indicatorColor: 'e0ca57ff',
              },
              error: {
                backgroundColor: '1a0000ff',
                borderColor: 'eb6f6fff',
                indicatorColor: 'eb6f6fff',
              },
            },
          },
          divider: {
            darkMode: {
              borderColor: '232b37ff',
            },
          },
          idpButtons: {
            icons: { enabled: true },
          },
          focusState: {
            darkMode: {
              borderColor: '539fe5ff',
            },
          },
          inputLabel: {
            darkMode: {
              textColor: 'd1d5dbff',
            },
          },
          link: {
            darkMode: {
              hover: { textColor: '89bdeeff' },
              defaults: { textColor: '539fe5ff' },
            },
          },
        },
        categories: {
          form: {
            sessionTimerDisplay: 'NONE',
            instructions: { enabled: false },
            languageSelector: { enabled: false },
            displayGraphics: true,
            location: {
              horizontal: 'CENTER',
              vertical: 'CENTER',
            },
          },
          auth: {
            federation: {
              interfaceStyle: 'BUTTON_LIST',
              order: [],
            },
            authMethodOrder: [[
              { display: 'BUTTON', type: 'FEDERATED' },
              { display: 'INPUT', type: 'USERNAME_PASSWORD' },
            ]],
          },
          global: {
            colorSchemeMode: 'DARK',
            pageFooter: { enabled: false },
            pageHeader: { enabled: false },
            spacingDensity: 'REGULAR',
          },
        },
      },
      assets: assets.length > 0 ? assets : undefined,
    });
  }
}
