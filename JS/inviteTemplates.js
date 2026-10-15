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
    "¡Hola {nombre}! Estoy usando una nueva aplicación llamada Beepsafe, para comunicarnos cuando practiquemos ({actividad}). Te invité al grupo {grupo}, donde estamos todos. Creá tu cuenta y aceptá la invitación acá: {link}",
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
 * Low-level PUT. Returns structured result.
 * - ok: true only on HTTP 2xx
 * - status: HTTP status if available
 * - is4xx: true if response status is 4xx
 * - isTransient: true for network/5xx/timeout errors (retryable)
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
    if (res.ok) {
      return { ok: true, status: res.status, is4xx: false, isTransient: false };
    }
    const status = res.status;
    const is4xx = status >= 400 && status < 500;
    return {
      ok: false,
      status,
      is4xx,
      isTransient: !is4xx, // non-4xx failures (5xx, others) are considered transient
    };
  } catch (err) {
    console.error("No se pudieron guardar las plantillas en el servidor", err);
    return { ok: false, status: undefined, is4xx: false, isTransient: true };
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
      // Defense-in-depth: if pending snapshot is blank, do not retry; clear flag.
      const localesLim = {
        registered: toText(locales.registered),
        notRegistered: toText(locales.notRegistered),
      };
      const pendingBlank =
        localesLim.registered.trim() === "" ||
        localesLim.notRegistered.trim() === "";
      if (pendingBlank) {
        escribirPlantillasLocales(localesLim, false);
        return {
          ok: true,
          source: "local",
          templates: resolverPlantillas(localesLim),
        };
      }
      const subido = await subirPlantillas(localesLim);
      if (subido.ok) {
        escribirPlantillasLocales(localesLim, false);
        return {
          ok: true,
          source: "local",
          templates: resolverPlantillas(localesLim),
        };
      }
      // If rejected (4xx), do not keep pendingSync — do not retry forever.
      if (subido.is4xx) {
        escribirPlantillasLocales(localesLim, false);
        return {
          ok: true,
          source: "local",
          templates: resolverPlantillas(localesLim),
        };
      }
      // Transient failure (5xx/network) — keep pendingSync for later retry.
      escribirPlantillasLocales(localesLim, true);
      return {
        ok: true,
        source: "local",
        templates: resolverPlantillas(localesLim),
      };
    }

    if (locales && locales.pendingSync === undefined && esValorDefault(plantillas)) {
      const localesLim = {
        registered: toText(locales.registered),
        notRegistered: toText(locales.notRegistered),
      };
      const subido = await subirPlantillas(localesLim);
      if (subido.ok) {
        escribirPlantillasLocales(localesLim, false);
        return {
          ok: true,
          source: "local",
          templates: resolverPlantillas(localesLim),
        };
      }
      if (subido.is4xx) {
        escribirPlantillasLocales(localesLim, false);
        return {
          ok: true,
          source: "local",
          templates: resolverPlantillas(localesLim),
        };
      }
      escribirPlantillasLocales(localesLim, true);
      return {
        ok: true,
        source: "local",
        templates: resolverPlantillas(localesLim),
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
 * `pendingSync` marker:
 * - false after a successful PUT (server is authoritative)
 * - true only for transient failures (network/5xx/timeout) so edits are retried
 *   on next load. On 4xx (rejected by server), we do NOT set pendingSync.
 *
 * Returns { ok, degraded, templates, reason? }
 */
export async function guardarPlantillas(plantillas) {
  const limpias = {
    registered: toText(plantillas?.registered),
    notRegistered: toText(plantillas?.notRegistered),
  };

  // A. Block blank before PUT
  const registeredBlank = limpias.registered.trim() === "";
  const notRegisteredBlank = limpias.notRegistered.trim() === "";
  if (registeredBlank || notRegisteredBlank) {
    return {
      ok: false,
      degraded: false,
      reason: "empty",
      templates: limpias,
    };
  }

  const res = await subirPlantillas(limpias);
  if (res.ok) {
    escribirPlantillasLocales(limpias, false);
    return { ok: true, degraded: false, templates: limpias };
  }
  if (res.is4xx) {
    // Rejected by server — do not mark as pending sync; local value is unsatisfiable
    escribirPlantillasLocales(limpias, false);
    return { ok: false, degraded: false, reason: "rejected", templates: limpias };
  }
  // Transient: 5xx/network — mark pending sync for retry
  escribirPlantillasLocales(limpias, true);
  return { ok: false, degraded: true, templates: limpias };
}
