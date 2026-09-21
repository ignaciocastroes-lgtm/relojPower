import type { MetadataRoute } from "next"

/** Manifiesto de la app instalable (PWA). Next lo sirve en /manifest.webmanifest y lo enlaza solo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "POWERLOCK Timer",
    short_name: "POWERLOCK",
    description: "Temporizador de entrenamiento: Tabata, EMOM, FGB, rutinas propias, historial y pulso por Bluetooth.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
