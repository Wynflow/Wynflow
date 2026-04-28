// Handles the redirect from Xero after the user authorizes the app.
// Exchanges the code for tokens, fetches the tenant_id, and stores
// everything on the business row.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const SITE_BASE = process.env.SITE_BASE_URL || 'https://www.wynflow.co.nz';

const sbHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });

const errorRedirect = (res, msg) => {
  res.writeHead(302, { Location: `${SITE_BASE}/?xero_error=${encodeURIComponent(msg)}#settings` });
  res.end();
};

const successRedirect = (res) => {
  res.writeHead(302, { Location: `${SITE_BASE}/?xero_connected=1#settings` });
  res.end();
};

export default async function handler(req, res) {
  const code = (req.query.code || '').trim();
  const state = (req.query.state || '').trim();

  if (!code || !state) return errorRedirect(res, 'Missing code or state');
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) return errorRedirect(res, 'Xero credentials not configured');
  if (!SUPABASE_URL || !SUPABASE_KEY) return errorRedirect(res, 'Supabase not configured');

  // Look up business by state, verify not expired
  const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?xero_oauth_state=eq.${encodeURIComponent(state)}&select=id,xero_oauth_state_expires_at`, { headers: sbHeaders() });
  const rows = await lookupRes.json();
  const business = rows?.[0];
  if (!business) return errorRedirect(res, 'Invalid or expired state');
  if (business.xero_oauth_state_expires_at && new Date(business.xero_oauth_state_expires_at) < new Date()) {
    return errorRedirect(res, 'State expired — please try again');
  }

  const redirectUri = `${SITE_BASE}/api/xero-oauth-callback`;

  // Exchange code for tokens
  const basic = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Xero token exchange failed:', tokenRes.status, errText);
    return errorRedirect(res, 'Token exchange failed');
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;
  if (!access_token) return errorRedirect(res, 'No access token returned');

  // Fetch tenant connections
  const connRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
  });
  if (!connRes.ok) {
    return errorRedirect(res, 'Failed to fetch Xero org');
  }
  const connections = await connRes.json();
  const tenantId = connections?.[0]?.tenantId;
  if (!tenantId) return errorRedirect(res, 'No Xero org found');

  // Store tokens
  const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
  const updRes = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${business.id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      xero_access_token: access_token,
      xero_refresh_token: refresh_token,
      xero_tenant_id: tenantId,
      xero_token_expires_at: expiresAt,
      xero_connected_at: new Date().toISOString(),
      xero_oauth_state: null,
      xero_oauth_state_expires_at: null,
    }),
  });

  if (!updRes.ok) {
    const errText = await updRes.text();
    console.error('Failed to store Xero tokens:', updRes.status, errText);
    return errorRedirect(res, 'Failed to save Xero connection');
  }

  return successRedirect(res);
}
