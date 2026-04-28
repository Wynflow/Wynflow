import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'Quote the job. Win the job.';
  const subtitle = searchParams.get('subtitle') || 'Job & customer management software for NZ tradies.';

  // Fetch the W logo from the live site
  const logoData = await fetch('https://www.wynflow.co.nz/logo.png').then(r => r.arrayBuffer());
  const logoSrc = `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(logoData)))}`;

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0A0E17 0%, #111827 50%, #0A0E17 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Top teal accent line
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: 'linear-gradient(90deg, transparent, #14B8A6, transparent)',
                display: 'flex',
              },
            },
          },
          // Background glow top-right
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: -80, right: -80, width: 400, height: 400,
                borderRadius: 200,
                background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
                display: 'flex',
              },
            },
          },
          // Background glow bottom-left
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: -60, left: -60, width: 300, height: 300,
                borderRadius: 150,
                background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)',
                display: 'flex',
              },
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0 80px', position: 'relative', zIndex: 1,
              },
              children: [
                // Logo + Wynflow text
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: 18, marginBottom: 36 },
                    children: [
                      {
                        type: 'img',
                        props: {
                          src: logoSrc,
                          width: 72,
                          height: 60,
                          style: { objectFit: 'contain' },
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 48, fontWeight: 700, color: 'white',
                            letterSpacing: '-0.03em', display: 'flex',
                          },
                          children: 'Wynflow',
                        },
                      },
                    ],
                  },
                },
                // Title
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 64, fontWeight: 700, color: 'white',
                      lineHeight: 1.1, letterSpacing: '-0.04em',
                      marginBottom: 20, maxWidth: 900, display: 'flex',
                      textAlign: 'center',
                    },
                    children: title,
                  },
                },
                // Subtitle
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24, color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.5, maxWidth: 800, display: 'flex',
                      textAlign: 'center',
                    },
                    children: subtitle,
                  },
                },
                // Feature pills
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', gap: 12, marginTop: 40 },
                    children: ['Quoting', 'Auto Follow-Ups', 'Customer Management'].map((f) => ({
                      type: 'div',
                      props: {
                        style: {
                          padding: '10px 22px', borderRadius: 100,
                          background: 'rgba(20,184,166,0.1)',
                          border: '1px solid rgba(20,184,166,0.25)',
                          color: '#14B8A6', fontSize: 16, fontWeight: 600,
                          display: 'flex', alignItems: 'center',
                        },
                        children: f,
                      },
                    })),
                  },
                },
              ],
            },
          },
          // Bottom bar
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '16px 60px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.2)',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 16, color: 'rgba(255,255,255,0.35)', display: 'flex' },
                    children: 'wynflow.co.nz',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      padding: '8px 24px', borderRadius: 8,
                      background: '#14B8A6', color: '#000',
                      fontSize: 16, fontWeight: 700, display: 'flex',
                    },
                    children: 'Try Free for 14 Days',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  );
}
