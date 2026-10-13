// whatsapp.js
//
// Shared front module for phone normalization and WhatsApp click-to-send links.
//
// It owns the phone helpers that used to live as a private copy inside
// misGrupos.js, plus the builders for the wa.me destination:
//   - normalizarTelefonoE164(input)  -> canonical E.164 string (or null)
//   - esTelefonoE164Valido(phone)    -> is `phone` a valid E.164 value?
//   - telefonoNacionalAr(phone)      -> AR national significant number (digits)
//   - construirWaMeUrl(telefono, texto) -> https://wa.me/<digits>?text=<encoded>
//
// The normalization criterion MUST stay identical to the backend
// (src/utils.js `normalizarTelefonoE164`): members are stored normalized, so
// the front has to compare and build links with the same rule. The backend
// remains the authority and re-normalizes everything it receives.
//
// No browser globals are touched here, so the module is safe to import from
// any page (CSP-friendly: pure functions, no DOM, no fetch).

/**
 * Normalizes a phone number to canonical E.164 for the AR numbering plan.
 * Non-digit characters are stripped first, so any input format is accepted.
 * Returns null for empty input, otherwise a `+`-prefixed string.
 */
export function normalizarTelefonoE164(input) {
  if (!input) return null;
  let tel = String(input).replace(/\D/g, "");
  if (tel.startsWith("0")) tel = tel.slice(1);
  if (tel.startsWith("549")) return `+${tel}`;
  if (tel.startsWith("54")) return `+549${tel.slice(2)}`;
  if (tel.startsWith("9")) return `+54${tel}`;
  return `+549${tel}`;
}

/**
 * True when `phone` is a syntactically valid E.164 value: a leading `+`,
 * a non-zero leading digit and 8 to 15 digits in total (E.164 max length).
 * Used to block the invite before opening anything.
 */
export function esTelefonoE164Valido(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || ""));
}

/**
 * Extracts the AR national significant number (the digits a local form
 * expects) from a normalized E.164 phone: strips the `+`, then the `54`
 * country code, then a leading `9` (mobile prefix). Landlines without the
 * mobile prefix are returned as-is. Returns "" for empty input.
 */
export function telefonoNacionalAr(phone) {
  if (!phone) return "";
  let tel = String(phone).replace(/\D/g, "");
  if (tel.startsWith("54")) tel = tel.slice(2);
  if (tel.startsWith("9")) tel = tel.slice(1);
  return tel;
}

/**
 * Builds a WhatsApp click-to-send URL. `<digits>` is the phone with every
 * non-digit removed (the leading `+` of E.164 is dropped) and `<text>` is the
 * message URL-encoded. Opening this URL is a browser navigation, never fetch.
 */
export function construirWaMeUrl(telefono, texto) {
  const digits = String(telefono || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(
    texto === null || texto === undefined ? "" : String(texto)
  )}`;
}
