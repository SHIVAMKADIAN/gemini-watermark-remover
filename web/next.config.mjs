import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  // Pin the trace root to this app so standalone output isn't nested under the
  // monorepo root (keeps the Dockerfile CMD path simple: server.js at root).
  outputFileTracingRoot: here,
}

export default nextConfig
