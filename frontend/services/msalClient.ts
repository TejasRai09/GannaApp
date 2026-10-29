/**
 * Microsoft (Entra ID) sign-in for the browser.
 *
 * The client id and authority are fetched from the server at /api/auth/config
 * rather than compiled into the bundle, so the tenant stays out of a public
 * repository and can be changed without a rebuild.
 *
 * This is a public SPA client: there is no client secret, and there must not
 * be. PKCE is what makes the flow safe, and MSAL handles it.
 *
 * The browser's token is never trusted on its own — it is posted to the server,
 * which verifies the signature against Microsoft's published keys before
 * issuing a session. Everything here is convenience, not security.
 */
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

export interface MicrosoftConfig {
  enabled: boolean;
  clientId: string;
  authority: string;
}

let configPromise: Promise<MicrosoftConfig> | null = null;
let instance: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication | null> | null = null;

/** Cached so a re-render cannot trigger a second round trip. */
export const getMicrosoftConfig = (): Promise<MicrosoftConfig> => {
  if (!configPromise) {
    configPromise = fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.microsoft ?? { enabled: false, clientId: '', authority: '' })
      .catch(() => ({ enabled: false, clientId: '', authority: '' }));
  }
  return configPromise;
};

/**
 * Build the MSAL instance, or null when Microsoft sign-in is not configured.
 *
 * MSAL v3 requires initialize() to be awaited before any other call, so this
 * resolves only once that has happened.
 */
const getInstance = (): Promise<PublicClientApplication | null> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const cfg = await getMicrosoftConfig();
    if (!cfg.enabled || !cfg.clientId || !cfg.authority) return null;

    const msalConfig: Configuration = {
      auth: {
        clientId: cfg.clientId,
        authority: cfg.authority,
        // Must match a Redirect URI registered as "SPA" on the app
        // registration, exactly, including scheme and no trailing path.
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        // sessionStorage so closing the tab ends the Microsoft session cache;
        // our own session cookie/token governs how long the user stays in.
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    };

    const app = new PublicClientApplication(msalConfig);
    await app.initialize();
    instance = app;
    return app;
  })();

  return initPromise;
};

export const isMicrosoftAvailable = async (): Promise<boolean> => (await getInstance()) !== null;

/**
 * Handle the redirect leg, if this page load is returning from Microsoft.
 * Safe to call on every load; resolves null when there is nothing to handle.
 */
export const handleRedirect = async (): Promise<string | null> => {
  const app = await getInstance();
  if (!app) return null;
  const result = await app.handleRedirectPromise();
  return result?.idToken ?? null;
};

/**
 * Sign in and return the Microsoft ID token for the server to verify.
 *
 * A popup is used so the user keeps their place in the app. If the browser
 * blocks it, the caller is told to fall back to redirect.
 */
export const signInWithMicrosoft = async (): Promise<string> => {
  const app = await getInstance();
  if (!app) throw new Error('Microsoft sign-in is not configured on this server');

  // openid/profile/email are what populate the claims the server reads.
  const request = { scopes: ['openid', 'profile', 'email'], prompt: 'select_account' as const };

  try {
    const result = await app.loginPopup(request);
    if (!result.idToken) throw new Error('Microsoft did not return an identity token');
    return result.idToken;
  } catch (err: any) {
    // A blocked popup is a browser policy problem, not a credential problem —
    // falling back to a full-page redirect is the only way through.
    if (err?.errorCode === 'popup_window_error' || err?.errorCode === 'empty_window_error') {
      await app.loginRedirect(request);
      // loginRedirect navigates away; nothing after this runs.
      return new Promise<string>(() => {});
    }
    throw err;
  }
};

/** Silently refresh, used to re-establish a session without prompting. */
export const acquireSilent = async (account: AccountInfo): Promise<string | null> => {
  const app = await getInstance();
  if (!app) return null;
  try {
    const r = await app.acquireTokenSilent({ scopes: ['openid', 'profile', 'email'], account });
    return r.idToken ?? null;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) return null;
    return null;
  }
};

/** Clear MSAL's own cache. Our session is cleared separately by AuthContext. */
export const signOutMicrosoft = async (): Promise<void> => {
  const app = instance ?? (await getInstance());
  if (!app) return;
  try {
    const accounts = app.getAllAccounts();
    for (const a of accounts) app.clearCache({ account: a });
  } catch {
    // Clearing a cache that is already gone is not worth surfacing.
  }
};
