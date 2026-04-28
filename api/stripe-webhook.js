import Stripe from 'stripe';

// API key is only required for outbound API calls (e.g. creating payment links).
// Signature verification works without it. Use the real secret if present, fall back to placeholder.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'unused', { apiVersion: '2024-12-18.acacia' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ---------- Supabase REST helpers ----------

async function findBusinessByEmail(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function findBusinessByStripeCustomer(customerId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function updateBusiness(id, data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed (${res.status}): ${text}`);
  }
}

// ---------- Event handlers ----------

async function updateInvoice(id, data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase invoice update failed (${res.status}): ${text}`);
  }
}

async function handleCheckoutCompleted(session) {
  // Branch A: Wynflow customer paying their own invoice (metadata.kind === wynflow_invoice)
  const meta = session.metadata || {};
  if (meta.kind === 'wynflow_invoice' && meta.invoice_id) {
    await updateInvoice(meta.invoice_id, {
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_via: 'stripe',
    });
    console.log(`checkout.session.completed — invoice ${meta.invoice_id} marked paid`);
    return;
  }

  // Branch B: Wynflow subscription signup (existing logic — match business by email)
  const email = session.customer_details?.email;
  if (!email) {
    console.log('checkout.session.completed — no customer email and no invoice metadata, skipping');
    return;
  }

  const business = await findBusinessByEmail(email);
  if (!business) {
    console.log(`checkout.session.completed — no business found for email: ${email}`);
    return;
  }

  await updateBusiness(business.id, {
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
    subscription_status: 'active',
    trial_ends_at: null,
  });
  console.log(`checkout.session.completed — activated business ${business.id} (${email})`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const business = await findBusinessByStripeCustomer(customerId);
  if (!business) {
    console.log(`invoice.payment_succeeded — no business for customer: ${customerId}`);
    return;
  }

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const updateData = { subscription_status: 'active' };
  if (periodEnd) {
    updateData.subscription_period_end = new Date(periodEnd * 1000).toISOString();
  }

  await updateBusiness(business.id, updateData);
  console.log(`invoice.payment_succeeded — renewed business ${business.id}`);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const business = await findBusinessByStripeCustomer(customerId);
  if (!business) {
    console.log(`invoice.payment_failed — no business for customer: ${customerId}`);
    return;
  }

  await updateBusiness(business.id, { subscription_status: 'expired' });
  console.log(`invoice.payment_failed — expired business ${business.id}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const business = await findBusinessByStripeCustomer(customerId);
  if (!business) {
    console.log(`customer.subscription.deleted — no business for customer: ${customerId}`);
    return;
  }

  await updateBusiness(business.id, { subscription_status: 'cancelled' });
  console.log(`customer.subscription.deleted — cancelled business ${business.id}`);
}

// ---------- Vercel serverless handler ----------

export const config = {
  api: {
    bodyParser: false, // We need the raw body for signature verification
  },
};

// Collect raw body from the request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!sig || !WEBHOOK_SECRET) {
      console.error('Missing stripe-signature header or STRIPE_WEBHOOK_SECRET env var');
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`Stripe event received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing ${event.type}: ${err.message}`);
    // Return 200 so Stripe doesn't retry — the event was received, processing failed
    return res.status(200).json({ received: true, error: err.message });
  }

  return res.status(200).json({ received: true });
}
