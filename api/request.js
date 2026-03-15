export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const bizId = url.searchParams.get('id') || '';

  if (!bizId) {
    return Response.redirect(new URL('/', req.url), 302);
  }

  // Fetch the actual homepage HTML from origin
  const originRes = await fetch(new URL('/', req.url), {
    headers: { 'Accept': 'text/html' },
  });
  let html = await originRes.text();

  // Strip ALL OG image / Twitter card image tags so no preview card shows
  html = html.replace(/<meta\s+property="og:image"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+property="og:image:width"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+property="og:image:height"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+property="og:image:alt"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:image"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:card"[^>]*\/?>/gi, '');

  // Set basic title/description instead of Wynflow marketing copy
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Request a Quote</title>');
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    '$1Fill in your details to request a free quote.$2'
  );
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/i,
    '$1Request a Quote$2'
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/i,
    '$1Fill in your details to request a free quote.$2'
  );
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i,
    '$1Request a Quote$2'
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i,
    '$1Fill in your details to request a free quote.$2'
  );

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
