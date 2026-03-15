import { readFileSync } from 'fs';
import { resolve } from 'path';

let cachedHtml = null;
function getBaseHtml() {
  if (cachedHtml) return cachedHtml;
  const paths = [
    resolve(process.cwd(), 'dist', 'index.html'),
    resolve(process.cwd(), 'index.html'),
    resolve('dist', 'index.html'),
  ];
  for (const p of paths) {
    try {
      cachedHtml = readFileSync(p, 'utf-8');
      return cachedHtml;
    } catch { continue; }
  }
  return null;
}

export default async function handler(req, res) {
  const bizId = req.query.id || '';
  if (!bizId) { res.redirect(302, '/'); return; }

  let html = getBaseHtml();
  if (!html) { res.redirect(302, '/'); return; }

  // Remove the OG image tags so no Wynflow marketing card shows when shared
  html = html.replace(/<meta\s+property="og:image"[^>]*>/gi, '');
  html = html.replace(/<meta\s+property="og:image:width"[^>]*>/gi, '');
  html = html.replace(/<meta\s+property="og:image:height"[^>]*>/gi, '');
  html = html.replace(/<meta\s+property="og:image:alt"[^>]*>/gi, '');
  html = html.replace(/<meta\s+name="twitter:image"[^>]*>/gi, '');
  html = html.replace(/<meta\s+name="twitter:card"[^>]*>/gi, '');

  // Update title/description to be generic
  html = html.replace(/<title>[^<]*<\/title>/, `<title>Request a Quote — Wynflow</title>`);
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/i,
    `$1Request a Quote$2`
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/i,
    `$1Fill in your details and get a free quote fast.$2`
  );
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i,
    `$1Request a Quote$2`
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i,
    `$1Fill in your details and get a free quote fast.$2`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
