import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'AI-Powered Quote Management';
  const subtitle = searchParams.get('subtitle') || 'Generate quotes from photos. Chase customers automatically. Win more jobs.';

  return new ImageResponse(
    (
      <div
        style={{
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
        }}
      >
        {/* Background glow orbs */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: 150, background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)', display: 'flex' }} />

        {/* Top border accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, transparent, #14B8A6, transparent)', display: 'flex' }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Logo + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #14B8A6, #0D9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 30px rgba(20,184,166,0.3)',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: 'white', letterSpacing: '-0.03em', display: 'flex' }}>
              Wynflow
            </div>
          </div>

          {/* Title */}
          <div style={{
            fontSize: 52, fontWeight: 700, color: 'white',
            lineHeight: 1.15, letterSpacing: '-0.03em',
            marginBottom: 20, maxWidth: 900, display: 'flex',
          }}>
            {title}
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 24, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.5, maxWidth: 700, display: 'flex',
          }}>
            {subtitle}
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
            {['AI Photo Quotes', 'Auto Follow-Ups', 'Quote Dashboard'].map((f) => (
              <div key={f} style={{
                padding: '10px 20px', borderRadius: 100,
                background: 'rgba(20,184,166,0.1)',
                border: '1px solid rgba(20,184,166,0.2)',
                color: '#14B8A6', fontSize: 16, fontWeight: 600,
                display: 'flex', alignItems: 'center',
              }}>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 60px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
            wynflow.co.nz
          </div>
          <div style={{
            padding: '8px 24px', borderRadius: 8,
            background: '#14B8A6', color: '#000',
            fontSize: 16, fontWeight: 700, display: 'flex',
          }}>
            Try Free for 14 Days
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
