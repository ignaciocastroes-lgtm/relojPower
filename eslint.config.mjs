import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**"]),
  {
    rules: {
      // Los hooks (use-settings, use-routines, use-sessions) leen localStorage DESPUÉS de montar
      // y guardan el resultado en estado. Es intencional: leerlo durante el render rompería la
      // hidratación (el servidor no tiene localStorage). Ver el comentario en cada hook.
      "react-hooks/set-state-in-effect": "off",
      // Las imágenes del catálogo son URLs externas pequeñas con su propio respaldo (ExerciseThumb);
      // next/image no aporta nada aquí.
      "@next/next/no-img-element": "off",
    },
  },
])
