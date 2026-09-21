/**
 * Estado de instalación de la app (PWA). PURO: quien llama lee el navegador y pasa los hechos.
 *  - installed: ya se abre como app instalada (pantalla completa).
 *  - available: Chrome ofreció instalarla y hay un botón real que lo dispara.
 *  - manual: el navegador no la ofreció (todavía); se puede instalar desde su menú.
 *  - unavailable: la página no es segura (https), así que no se puede instalar.
 */
export type InstallState = "installed" | "available" | "manual" | "unavailable"

export function installState(facts: { standalone: boolean; hasPrompt: boolean; secure: boolean }): InstallState {
  if (facts.standalone) return "installed"
  if (!facts.secure) return "unavailable"
  return facts.hasPrompt ? "available" : "manual"
}
