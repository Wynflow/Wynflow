// Rewrites a single follow-up sequence step (subject + body) into more
// natural, on-brand prose using Claude. Keeps placeholder tags ({name},
// {job}, {amount}, {business_name}, {invoice_number}, {due_date}) intact
// so the runtime substitution still works.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

const ALLOWED_PLACEHOLDERS = ['{name}', '{job}', '{amount}', '{business_name}', '{invoice_number}', '{due_date}'];

function buildPrompt({ subject, body, businessName, trade, stepNumber, totalSteps, sequenceType, tone }) {
  const isInvoice = sequenceType === 'invoice';
  const stage =
    stepNumber === 1 ? 'first gentle nudge' :
    stepNumber === 2 ? 'second polite reminder' :
    stepNumber >= 3 ? 'firmer but still friendly reminder' :
    'follow-up';

  return `You are rewriting a ${isInvoice ? 'payment-reminder' : 'quote follow-up'} email for a New Zealand tradie business.

BUSINESS: ${businessName || 'a NZ trades business'}${trade ? ` (${trade})` : ''}
SEQUENCE STAGE: step ${stepNumber} of ${totalSteps} — ${stage}
TONE: ${tone || 'friendly, plain-spoken, professional. Sounds like a NZ tradie wrote it themselves — not a marketer, not a lawyer, not a robot. No exclamation marks. No emojis.'}

CURRENT SUBJECT LINE:
${subject || '(none)'}

CURRENT EMAIL BODY:
${body || '(none)'}

REWRITE RULES:
- Output JSON only: { "subject": "...", "body": "..." }
- Keep these placeholder tags exactly as-is so runtime substitution works: ${ALLOWED_PLACEHOLDERS.join(', ')}
- The body MUST include {name} (recipient first name) at least once
- The body should be 3–6 short sentences, plain text, no HTML
- Use NZ English (organise, recognise, no Americanisms)
- No emojis
- Don't start with "I hope this email finds you well" or other corporate openers
- Don't end with "Best regards" — sign off naturally (a name comes from {business_name} elsewhere)
${isInvoice ? '- Reference the invoice and due date factually. Step 3+ should mention the consequence of further delay (e.g., late fees / handing to a collections agent — but only on a final reminder).' : '- Step 1: light touch, ask if they have questions. Step 2: nudge with a clear call-to-action. Step 3+: ask if they want to proceed or close out.'}

Return ONLY the JSON object, no preamble, no markdown fences.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY env var not configured' });
  }

  try {
    const { subject = '', body = '', businessName = '', trade = '', stepNumber = 1, totalSteps = 3, sequenceType = 'quote', tone = '' } = req.body || {};

    if (!subject && !body) {
      return res.status(400).json({ error: 'Provide at least one of subject or body to rewrite' });
    }

    const prompt = buildPrompt({ subject, body, businessName, trade, stepNumber, totalSteps, sequenceType, tone });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Anthropic API error:', r.status, errText);
      return res.status(502).json({ error: `Anthropic API error: ${r.status}` });
    }

    const data = await r.json();
    const text = data?.content?.[0]?.text?.trim() || '';

    // Strip any accidental markdown fences
    let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude output:', text.slice(0, 200));
      return res.status(502).json({ error: 'AI returned non-JSON output', raw: text.slice(0, 500) });
    }

    if (!parsed.subject || !parsed.body) {
      return res.status(502).json({ error: 'AI output missing subject or body', raw: parsed });
    }

    // Safety: ensure body still contains {name} placeholder; if not, prepend "Hi {name}," line
    let outBody = parsed.body;
    if (!outBody.includes('{name}')) {
      outBody = `Hi {name},\n\n${outBody}`;
    }

    return res.status(200).json({ subject: parsed.subject, body: outBody });
  } catch (err) {
    console.error('ai-rewrite-step error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
