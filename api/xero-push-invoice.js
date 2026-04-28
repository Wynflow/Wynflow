// Pushes a Wynflow invoice to Xero. Refreshes the access token if
// needed, ensures the customer contact exists, then creates the invoice.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;

const sbHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });

async function getInvoice(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}&select=*`, { headers: sbHeaders() });
  const rows = await r.json();
  return rows?.[0] ?? null;
}

async function getBusiness(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}&select=*`, { headers: sbHeaders() });
  const rows = await r.json();
  return rows?.[0] ?? null;
}

async function patchBusiness(id, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}

async function patchInvoice(id, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}

async function refreshIfNeeded(business) {
  const expires = business.xero_token_expires_at ? new Date(business.xero_token_expires_at).getTime() : 0;
  if (expires && expires - Date.now() > 30000) {
    return business.xero_access_token; // still valid
  }
  if (!business.xero_refresh_token) throw new Error('No refresh token');

  const basic = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: business.xero_refresh_token });
  const r = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Refresh failed: ${r.status}`);
  const data = await r.json();
  const newExpires = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await patchBusiness(business.id, {
    xero_access_token: data.access_token,
    xero_refresh_token: data.refresh_token,
    xero_token_expires_at: newExpires,
  });
  return data.access_token;
}

const xeroHeaders = (accessToken, tenantId) => ({
  Authorization: `Bearer ${accessToken}`,
  'Xero-tenant-id': tenantId,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

async function findOrCreateContact(accessToken, tenantId, customerName, customerEmail) {
  // Try find by email
  if (customerEmail) {
    const where = encodeURIComponent(`EmailAddress=="${customerEmail.replace(/"/g, '\\"')}"`);
    const r = await fetch(`https://api.xero.com/api.xro/2.0/Contacts?where=${where}`, { headers: xeroHeaders(accessToken, tenantId) });
    if (r.ok) {
      const data = await r.json();
      const found = data?.Contacts?.[0];
      if (found?.ContactID) return found.ContactID;
    }
  }
  // Create
  const body = { Name: customerName || customerEmail || 'Customer', EmailAddress: customerEmail || undefined };
  const r2 = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    method: 'POST',
    headers: xeroHeaders(accessToken, tenantId),
    body: JSON.stringify({ Contacts: [body] }),
  });
  if (!r2.ok) {
    const text = await r2.text();
    throw new Error(`Failed to create Xero contact: ${r2.status} ${text}`);
  }
  const data = await r2.json();
  return data?.Contacts?.[0]?.ContactID;
}

function isoDate(d) {
  return new Date(d || Date.now()).toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Xero credentials not configured' });
  }

  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });

    const invoice = await getInvoice(invoice_id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const business = await getBusiness(invoice.business_id);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    if (!business.xero_access_token || !business.xero_tenant_id) {
      return res.status(400).json({ error: 'Xero not connected — visit Settings to connect' });
    }

    const accessToken = await refreshIfNeeded(business);

    // Find or create contact
    const contactId = await findOrCreateContact(accessToken, business.xero_tenant_id, invoice.customer_name, invoice.customer_email);
    if (!contactId) throw new Error('Could not resolve Xero contact');

    // Build line items from breakdown if present, else single line
    let bd = null;
    try { bd = typeof invoice.breakdown === 'string' ? JSON.parse(invoice.breakdown) : invoice.breakdown; } catch {}

    const lineItems = [];
    const isGST = !!business.gst_number && parseFloat(invoice.gst_amount || 0) > 0;
    const gstStatus = isGST ? 'OUTPUT2' : 'NONE'; // 15% NZ GST output tax

    if (bd && Array.isArray(bd.lineItems) && bd.lineItems.some(i => i.description?.trim())) {
      bd.lineItems.filter(i => i.description?.trim()).forEach(item => {
        lineItems.push({
          Description: item.description,
          Quantity: 1,
          UnitAmount: parseFloat(item.price || 0),
          AccountCode: business.xero_sales_account_code || '200',
          TaxType: gstStatus,
        });
      });
    } else {
      lineItems.push({
        Description: invoice.job_title || invoice.description || 'Services',
        Quantity: 1,
        UnitAmount: parseFloat(invoice.amount || 0),
        AccountCode: business.xero_sales_account_code || '200',
        TaxType: gstStatus,
      });
    }

    const xeroInvoice = {
      Type: 'ACCREC',
      Contact: { ContactID: contactId },
      Date: isoDate(invoice.sent_at || invoice.created_at),
      DueDate: isoDate(invoice.due_date),
      InvoiceNumber: invoice.invoice_number,
      Reference: invoice.job_title || '',
      LineAmountTypes: isGST ? 'Exclusive' : 'NoTax',
      LineItems: lineItems,
      Status: invoice.status === 'draft' ? 'DRAFT' : 'AUTHORISED',
    };

    // Create or update via PUT (Xero idempotency by InvoiceNumber)
    const r = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: xeroHeaders(accessToken, business.xero_tenant_id),
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });
    if (!r.ok) {
      const text = await r.text();
      await patchInvoice(invoice_id, { xero_push_error: `${r.status}: ${text.slice(0, 500)}` });
      return res.status(502).json({ error: `Xero rejected the invoice (${r.status})`, detail: text.slice(0, 500) });
    }

    const data = await r.json();
    const created = data?.Invoices?.[0];
    if (!created?.InvoiceID) {
      await patchInvoice(invoice_id, { xero_push_error: 'No InvoiceID returned' });
      return res.status(502).json({ error: 'Xero returned no InvoiceID' });
    }

    await patchInvoice(invoice_id, {
      xero_invoice_id: created.InvoiceID,
      xero_pushed_at: new Date().toISOString(),
      xero_push_error: null,
    });

    return res.status(200).json({ ok: true, xero_invoice_id: created.InvoiceID });
  } catch (err) {
    console.error('xero-push-invoice error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
