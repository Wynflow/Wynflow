// Initiates the Xero OAuth flow. Generates a random state token,
// stores it on the business row (10-min expiry), and redirects the
// user to Xero's authorize URL.
//
// Call from the app: window.location.href = '/api/xero-oauth-init?business_id=...'

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const SITE_BASE = process.env.SITE_BASE_URL || 'https://www.wynflow.co.nz';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.transactions',
  'accounting.contacts',
  'accounting.settings.read',
].join(' ');

const sbHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });

export default async function handler(req, res) {
  const businessId = (req.query.business_id || '').trim();
  if (!businessId) {
    return res.status(400).send('Missing business_id');
  }
  if (!XERO_CLIENT_ID) {
    return res.status(500).send('XERO_CLIENT_ID not configured');
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).send('Supabase env vars not configured');
  }

  // Verify business exists
  const r = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${businessId}&select=id`, { headers: sbHeaders() });
  const rows = await r.json();
  if (!rows?.[0]) return res.status(404).send('Business not found');

  // Generate state, store on business
  const state = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const upd = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${businessId}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ xero_oauth_state: state, xero_oauth_state_expires_at: expires }),
  });
  if (!upd.ok) {
    return res.status(500).send('Failed to store state');
  }

  const redirectUri = `${SITE_BASE}/api/xero-oauth-callback`;
  const authorizeUrl = new URL('https://login.xero.com/identity/connect/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', XERO_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('state', state);

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}
