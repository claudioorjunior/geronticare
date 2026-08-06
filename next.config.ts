import type { NextConfig } from 'next';

// SEGURANÇA: headers de proteção para instalações self-hosted (Vercel aplica
// alguns por padrão; o deploy próprio precisa deles explícitos).
// CSP completa não entra aqui porque quebra scripts/fontes inline do Next;
// ver ONDE-PAREI (hardening futuro).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Empty turbopack config: Next 16 enables Turbopack by default for `next build`.
  // Without this, a custom `webpack` config triggers a build error.
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // PGlite bundles WebAssembly and uses native fs.readFile with URL objects.
      // Webpack bundling breaks the instanceof URL check inside Node.js core fs.
      // Externalize it so the server uses the raw node_modules code.
      config.externals.push('@electric-sql/pglite');
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
