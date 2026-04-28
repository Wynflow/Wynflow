import Stripe from 'stripe';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' }) : null;

const sbHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' });

async function fetchInvoice(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}&select=*`, { headers: sbHeaders() });
  const rows = await r.json();
  return rows?.[0] ?? null;
}

async function fetchBusiness(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}&select=id,business_name,email`, { headers: sbHeaders() });
  const rows = await r.json();
  return rows?.[0] ?? null;
}

async function updateInvoice(id, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Supabase update failed (${r.status}): ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY env var not configured' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });

    const invoice = await fetchInvoice(invoice_id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // If already has a payment link, return it (idempotent)
    if (invoice.stripe_payment_link_url) {
      return res.status(200).json({ url: invoice.stripe_payment_link_url, id: invoice.stripe_payment_link_id, reused: true });
    }

    const business = await fetchBusiness(invoice.business_id);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const amountCents = Math.round((parseFloat(invoice.amount || 0) + parseFloat(invoice.gst_amount || 0)) * 100);
    if (!amountCents || amountCents < 100) {
      return res.status(400).json({ error: 'Invoice amount must be at least $1.00' });
    }

    // Create a one-time price → payment link
    const product = await stripe.products.create({
      name: `${business.business_name} — ${invoice.invoice_number}`,
      description: invoice.job_title || 'Invoice payment',
      metadata: { invoice_id: String(invoice_id), business_id: String(business.id) },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: 'nzd',
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoice_id: String(invoice_id), business_id: String(business.id), kind: 'wynflow_invoice' },
      payment_intent_data: {
        metadata: { invoice_id: String(invoice_id), business_id: String(business.id), kind: 'wynflow_invoice' },
      },
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: { custom_message: `Thanks — your payment has been received. ${business.business_name} will be notified.` },
      },
      automatic_tax: { enabled: false },
    });

    await updateInvoice(invoice_id, {
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
    });

    return res.status(200).json({ url: paymentLink.url, id: paymentLink.id, reused: false });
  } catch (err) {
    console.error('create-invoice-payment-link error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
