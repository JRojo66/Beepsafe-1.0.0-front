// inviteTemplates.js
//
// Shared front module for the per-user invite message templates.
//
// It owns three responsibilities:
//   1. DEFAULT_INVITE_TEMPLATES — the built-in Spanish copy. It MUST mirror the
//      backend defaults (src/controller/InviteTemplatesController.js) verbatim.
//   2. renderMensaje(template, ctx) — deterministic token substitution. Tokens
//      are only replaced when a message is built, never when a template is
//      persisted.
//   3. cargarPlantillas() / guardarPlantillas() — GET/PUT to the authenticated
//      templates endpoint, with a localStorage fallback so the editor still
//      works while the backend is unavailable.
//
// ROOT_URL is provided globally by JS/config.js (loaded as a classic script
// before this module, same as the other pages).

// Kept in sync manually with the backend DEFAULT_INVITE_TEMPLATES.
export const DEFAULT_INVITE_TEMPLATES = {
  registered:
    "¡Hola {nombre}! Te sumé al grupo {grupo} ({actividad}) en Beepsafe. Entrá a tu cuenta y aceptá la invitación acá: {link}",
  notRegistered:
    "¡Hola {nombre}! Te invité al grupo {grupo} ({actividad}) en Beepsafe. Creá tu cuenta y aceptá la invitación acá: {link}",
};

// Fallback values for empty context, per the design's deterministic rules.
const FALLBACK_GRUPO = "el grupo";
const FALLBACK_ACTIVIDAD = "nuestra actividad";

// localStorage key used as a degradation store while the backend is unreachable.
const LS_KEY = "beepsafe.inviteTemplates";

function toText(value) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Replaces every token in a single template with its context value.
 *
 * Deterministic fallbacks (design "Empty-value fallbacks"):
 *   {nombre}    -> member name, or the member phone when the name is empty
 *   {grupo}     -> "el grupo" when empty
 *   {actividad} -> "nuestra actividad" when empty
 *   {link}      -> the account-aware destination URL (empty string when absent)
 *
 * Substitution is literal (no regex), so braces in template text are safe.
 * URL-encoding of the final message is the caller's job when building wa.me.
 */
export function renderMensaje(template, ctx = {}) {
  const nombre =
    toText(ctx.nombre).trim() || toText(ctx.telefono).trim() || "";
  const grupo = toText(ctx.grupo).trim() || FALLBACK_GRUPO;
  const actividad = toText(ctx.actividad).trim() || FALLBACK_ACTIVIDAD;
  const link = toText(ctx.link);

  const base = toText(template);
  return base
    .split("{nombre}").join(nombre)
    .split("{grupo}").join(grupo)
    .split("{actividad}").join(actividad)
    .split("{link}").join(link);
}

/**
 * Resolves stored templates to a full object, falling back to the defaults per
 * field whenever a value is missing or empty (mirrors the backend resolver).
 */
function resolverPlantillas(almacenadas) {
  const origen = almacenadas || {};
  return {
    registered: origen.registered || DEFAULT_INVITE_TEMPLATES.registered,
    notRegistered:
      origen.notRegistered || DEFAULT_INVITE_TEMPLATES.notRegistered,
  };
}

function esValorDefault(plantillas) {
  return (
    plantillas.registered === DEFAULT_INVITE_TEMPLATES.registered &&
    plantillas.notRegistered === DEFAULT_INVITE_TEMPLATES.notRegistered
  );
}

function leerPlantillasLocales() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const entrada = {
      registered: toText(parsed.registered),
      notRegistered: toText(parsed.notRegistered),
    };
    // Legacy entries (written before this marker existed) carry no flag; leaving
    // `pendingSync` undefined keeps the migration path able to recognize them.
    if (typeof parsed.pendingSync === "boolean") {
      entrada.pendingSync = parsed.pendingSync;
    }
    return entrada;
  } catch {
    return null;
  }
}

function escribirPlantillasLocales(plantillas, pendingSync) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        registered: plantillas.registered,
        notRegistered: plantillas.notRegistered,
        pendingSync: pendingSync === true,
      })
    );
  } catch {
    // Storage might be full or blocked; degrade silently.
  }
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

/**
 * Low-level PUT. Returns true on HTTP 2xx, false on any failure (network,
 * non-2xx). Never throws — callers decide how to surface the failure.
 */
async function subirPlantillas(plantillas) {
  try {
    const res = await fetch(`${ROOT_URL}/api/invite-templates`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        registered: plantillas.registered,
        notRegistered: plantillas.notRegistered,
      }),
    });
    if (!res.ok) throw new Error(`PUT /api/invite-templates -> ${res.status}`);
    return true;
  } catch (err) {
    console.error("No se pudieron guardar las plantillas en el servidor", err);
    return false;
  }
}

/**
 * Loads the caller's templates from the backend.
 *
 * Success -> { ok: true, source: "server" | "local", templates }
 * Failure -> { ok: false, source: "local" | "default", templates }
 *
 * Resolution order:
 *   1. Local copy marked `pendingSync` (a previous PUT degraded): push it and
 *      clear the flag on success. Unsynced edits always win over the server.
 *   2. Legacy local copy (no flag) while the server still holds defaults: push
 *      it, then mark it synced (migration from the transitional store).
 *   3. Otherwise the server value is authoritative, so a deliberate server-side
 *      reset to defaults is NOT resurrected by a stale local copy.
 *
 * Local values always pass through resolverPlantillas() so missing/empty fields
 * fall back to the built-in defaults instead of rendering empty editors.
 */
export async function cargarPlantillas() {
  try {
    const res = await fetch(`${ROOT_URL}/api/invite-templates`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`GET /api/invite-templates -> ${res.status}`);

    const data = await res.json();
    const plantillas = resolverPlantillas(data?.templates);

    const locales = leerPlantillasLocales();

    if (locales && locales.pendingSync === true) {
      const subido = await subirPlantillas(locales);
      if (subido) escribirPlantillasLocales(locales, false);
      return {
        ok: true,
        source: "local",
        templates: resolverPlantillas(locales),
      };
    }

    if (locales && locales.pendingSync === undefined && esValorDefault(plantillas)) {
      const subido = await subirPlantillas(locales);
      if (subido) escribirPlantillasLocales(locales, false);
      return {
        ok: true,
        source: "local",
        templates: resolverPlantillas(locales),
      };
    }

    return { ok: true, source: "server", templates: plantillas };
  } catch (err) {
    console.error("No se pudieron cargar las plantillas desde el servidor", err);
    const locales = leerPlantillasLocales();
    if (locales) {
      return {
        ok: false,
        source: "local",
        templates: resolverPlantillas(locales),
      };
    }
    return {
      ok: false,
      source: "default",
      templates: { ...DEFAULT_INVITE_TEMPLATES },
    };
  }
}

/**
 * Persists the templates. The local copy is always mirrored with an explicit
 * `pendingSync` marker: false after a successful PUT (server is authoritative),
 * true after a degraded one (the edits are unsynced and must be pushed by the
 * next load instead of trusting a stale server value).
 *
 * Returns { ok, degraded, templates }.
 */
export async function guardarPlantillas(plantillas) {
  const limpias = {
    registered: toText(plantillas?.registered),
    notRegistered: toText(plantillas?.notRegistered),
  };

  const ok = await subirPlantillas(limpias);
  escribirPlantillasLocales(limpias, !ok);

  return { ok, degraded: !ok, templates: limpias };
}
