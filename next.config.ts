import type { NextConfig } from "next";

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
};

export default nextConfig;
