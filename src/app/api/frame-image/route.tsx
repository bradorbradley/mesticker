import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'system-ui',
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          }}
        />
        
        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              marginBottom: '20px',
              background: 'linear-gradient(90deg, #14b8a6, #06b6d4)',
              backgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
            }}
          >
            MeSticker
          </h1>
          
          <p
            style={{
              fontSize: '32px',
              marginBottom: '40px',
              color: '#e2e8f0',
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            Transform into your favorite cartoon character!
          </p>
          
          {/* Example images */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '30px',
            }}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '20px',
                border: '3px solid #475569',
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
              }}
            >
              📸
            </div>
            
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  color: '#14b8a6',
                  marginBottom: '8px',
                }}
              >
                ➡️
              </div>
              <span
                style={{
                  fontSize: '16px',
                  color: '#14b8a6',
                  fontWeight: 'bold',
                }}
              >
                Transform
              </span>
            </div>
            
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '20px',
                border: '3px solid #14b8a6',
                background: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                boxShadow: '0 0 30px rgba(20, 184, 166, 0.3)',
              }}
            >
              🎨
            </div>
          </div>
          
          <p
            style={{
              fontSize: '24px',
              marginTop: '40px',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            7 cartoon styles • Hey Arnold, SpongeBob, Simpsons & more!
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}