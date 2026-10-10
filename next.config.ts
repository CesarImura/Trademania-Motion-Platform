import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shot files are edited on disk while the app runs; keep the dev server from
  // treating them as source.
  devIndicators: false,
  // A second dev server (e.g. a preview pane) can run alongside `npm run dev` by
  // pointing NEXT_DIST_DIR at its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
