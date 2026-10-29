/**
 * Microsoft Entra ID (Azure AD) token verification.
 *
 * The browser sends the ID token it got from Microsoft. We never trust it on
 * sight: anyone can POST a hand-written JSON blob to this endpoint. The token
 * is verified against Microsoft's published signing keys, and the issuer,
 * audience and expiry are all checked, before any account is created or looked
 * up from it.
 *
 * Config is read from the environment rather than hard-coded, so the tenant and
 * client id stay out of a public repository.
 */
import jwt, { type JwtHeader, type SigningKeyCallback } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

export interface EntraProfile {
  /** Immutable per-user, per-tenant object id. The account key — never the email. */
  oid: string;
  email: string;
  name: string;
  tenantId: string;
}

export const entraConfig = () => ({
  clientId: process.env.AZURE_CLIENT_ID || '',
  tenantId: process.env.AZURE_TENANT_ID || '',
});

export const isEntraConfigured = (): boolean => {
  const { clientId, tenantId } = entraConfig();
  return Boolean(clientId && tenantId);
};

/**
 * One JWKS client per tenant, cached. jwks-rsa caches the keys themselves and
 * rate-limits fetches, so a burst of logins cannot hammer Microsoft.
 */
const clients = new Map<string, JwksClient>();
const jwksFor = (tenantId: string): JwksClient => {
  let c = clients.get(tenantId);
  if (!c) {
    c = new JwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    clients.set(tenantId, c);
  }
  return c;
};

const keyLookup = (tenantId: string) =>
  (header: JwtHeader, cb: SigningKeyCallback) => {
    jwksFor(tenantId)
      .getSigningKey(header.kid)
      .then((key) => cb(null, key.getPublicKey()))
      .catch((err) => cb(err as Error));
  };

/**
 * Verify a Microsoft ID token and return the profile it asserts.
 *
 * Rejects anything that is not signed by our tenant for our application. The
 * audience check is what stops a token minted for some other app in the same
 * directory being replayed here.
 */
export const verifyEntraToken = (idToken: string): Promise<EntraProfile> =>
  new Promise((resolve, reject) => {
    const { clientId, tenantId } = entraConfig();
    if (!clientId || !tenantId) {
      return reject(new Error('Microsoft sign-in is not configured on this server'));
    }

    jwt.verify(
      idToken,
      keyLookup(tenantId),
      {
        audience: clientId,
        // v2.0 tokens carry this issuer. Single-tenant, so the tenant id is fixed.
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        algorithms: ['RS256'],
        clockTolerance: 60,
      },
      (err, decoded) => {
        if (err) return reject(err);
        const c = decoded as Record<string, any>;

        const oid = c.oid || c.sub;
        if (!oid) return reject(new Error('Token carries no object id'));

        // preferred_username is the sign-in name; email is not always present.
        const email = String(c.preferred_username || c.email || c.upn || '').toLowerCase();
        if (!email) return reject(new Error('Token carries no email address'));

        // Belt and braces: the issuer check above already pins the tenant, but
        // a mismatch here would mean something is badly wrong.
        if (c.tid && c.tid !== tenantId) {
          return reject(new Error('Token is from a different directory'));
        }

        resolve({
          oid: String(oid),
          email,
          name: String(c.name || email.split('@')[0]),
          tenantId: String(c.tid || tenantId),
        });
      }
    );
  });
