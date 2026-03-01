import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MeSticker — Turn yourself into a cartoon sticker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #7C5CFC 0%, #FF6B9D 50%, #FFA726 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <span style={{ fontSize: "64px" }}>📸</span>
          <span style={{ fontSize: "48px", color: "white" }}>→</span>
          <span style={{ fontSize: "64px" }}>🎨</span>
          <span style={{ fontSize: "48px", color: "white" }}>→</span>
          <span style={{ fontSize: "64px" }}>🏠</span>
        </div>
        <h1
          style={{
            fontSize: "72px",
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            margin: "0 0 16px 0",
            textShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          MeSticker
        </h1>
        <p
          style={{
            fontSize: "32px",
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            margin: 0,
            maxWidth: "800px",
          }}
        >
          Turn yourself into a cartoon sticker.
          <br />
          Shipped to your door.
        </p>
        <p
          style={{
            fontSize: "22px",
            color: "rgba(255,255,255,0.7)",
            marginTop: "24px",
          }}
        >
          mesticker.fun
        </p>
      </div>
    ),
    { ...size }
  );
}
