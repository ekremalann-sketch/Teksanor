// Bindings are narrowed at each use site; this declaration does not grant capabilities.
declare module "cloudflare:workers" { export const env: Record<string, unknown>; }

declare module "qrcode/lib/browser.js" { import QRCode from "qrcode"; export default QRCode; }
