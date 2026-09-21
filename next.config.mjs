/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Versión del despliegue: cada commit tiene su propia caché del service worker (y borra las anteriores).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
}

export default nextConfig
