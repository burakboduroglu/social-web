import { PixelCharacter } from "./pixel-character";

// Native pixel scene for the auth screens: no stock asset, crisp at any size.
export function AuthHero() {
  return <div className="auth-hero" aria-hidden="true">
    <span className="auth-hero-glow" />
    <svg viewBox="0 0 320 240" shapeRendering="crispEdges" role="presentation">
      <g className="auth-sparkle auth-sparkle-a" fill="#b8abff">
        <path d="M22 26h8v8h8v8h-8v8h-8v-8h-8v-8h8z" />
      </g>
      <g className="auth-sparkle auth-sparkle-b" fill="#1d9bf0">
        <path d="M286 36h6v6h6v6h-6v6h-6v-6h-6v-6h6z" />
      </g>
      <g className="auth-sparkle auth-sparkle-c" fill="#eeedf5">
        <path d="M296 168h4v4h4v4h-4v4h-4v-4h-4v-4h4z" />
      </g>
      <path fill="#343b47" d="M16 164h6v6h-6zm8-8h6v6h-6z" />
      <path fill="#20242c" d="M26 202h268v12H26z" />
      <path fill="#343b47" d="M26 202h268v4H26z" />
      <path fill="#b8abff" d="M34 42h152v82H70l-16 16v-16H34z" />
      <path fill="#8f7fe8" d="M34 42h152v8H34z" />
      <path fill="#241f3d" d="M52 66h94v8H52zm0 18h70v8H52zm0 18h46v8H52z" />
      <path fill="#1d9bf0" d="M200 80h84v60h-26l12 14-26-14h-44z" />
      <path fill="#0f6fb5" d="M200 80h84v6h-84z" />
      <path fill="#e7f5ff" d="M216 100h52v6h-52zm0 14h34v6h-34z" />
      <path fill="#ff8fb3" d="M282 152h4v4h8v4h4v8h-4v4h-8v4h-4v-4h-8v-4h-4v-8h4v-4h8z" />
      <g className="auth-float auth-float-a"><PixelCharacter seed="auth-left" x={104} y={140} size={64} /></g>
      <g className="auth-float auth-float-b"><PixelCharacter seed="auth-right" x={184} y={132} size={72} /></g>
    </svg>
  </div>;
}
