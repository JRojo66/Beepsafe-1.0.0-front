# NOTAS — Beepsafe front (pantalla Inicio / iniciarDetener)

Repo front estático: `Beepsafe-1.0.0 - front` (HTML + CSS + JS vanilla, sin build).
Back relacionado: `Beepsafe-1.0-0-back` (Express + MongoDB en Atlas, DB `Beepsafe`).

## Estado actual (2026-10-18)

### Hecho y verificado (SIN commitear — working tree con cambios)

Los 4 comportamientos pedidos para la pantalla Inicio (`pages/iniciarDetener.html`),
las correcciones de una revisión de fiabilidad y una segunda ronda de 13 fixes
(REL-101..113). Archivos: `JS/iniciarDetener.js`, `pages/iniciarDetener.html`,
`styles/styles.css`, `tests/iniciarDetener.test.cjs` (nuevo), `.github/workflows/test.yml` (nuevo).

- `JS/iniciarDetener.js` — de 11 líneas (solo guard de login + saludo) a ~565.
- `pages/iniciarDetener.html` — selects con ids, SVG del anillo, `<img id="iconoActividad">`.
- `styles/styles.css` — `.reloj`, `.anilloReloj`, `.anilloProgreso`, `.logoActividad`.

#### Los 4 comportamientos

1. **Prefill con la última sesión**: Actividad/Equipo/Tiempo arrancan con los de la
   última sesión guardada en `localStorage` (clave `beepsafe_ultima_sesion`).
   Si la actividad ya no existe en el usuario → se elige la primera de la lista.
2. **Ícono = actividad**: el ícono de arriba a la derecha (`#iconoActividad`) refleja
   la actividad elegida: mapa actividad → imagen de `imagenes/` (4 PNGs:
   `IlustracionWindsurf.png`, `Surf.png`, `SUP.png`, `Jetski.png`) con fallback
   estable por hash FNV-1a del nombre (mismo nombre → misma imagen). Sin emojis.
   Match en orden: nombre exacto → palabra exacta (la más larga gana:
   "Surf & Windsurf" → windsurf) → prefijo ("Windsurfing" → windsurf) → hash.
3. **Tiempo sincronizado**: el `HH:MM:SS` visible bajo la etiqueta del botón y el
   select Tiempo y el label "elegidos" muestran siempre lo mismo.
4. **Cuenta regresiva + anillo rojo**: al apretar INICIAR corre un countdown y el
   anillo SVG alrededor del botón se va pintando de rojo (`#ff3b30`); al llegar a 0
   queda FINALIZADO con el anillo completo en rojo. DETENER = resetea (no pausa).

#### Hallazgos de la revisión de fiabilidad: corregidos (REL-001..008)

Revisión con lens `review-reliability`: 0 BLOCKER / 0 CRITICAL, 8 WARNING/SUGGESTION.
**Todos resueltos** (REL-005 → suite propia; REL-008 recuperado en re-review como
candidatos REL-105/106, ambos corregidos en esta ronda).

| ID | Problema | Corrección |
|----|----------|------------|
| REL-001 | Tras FINALIZADO, cambiar un select dejaba tiempo/label stale | `reiniciarSiFinalizado()` en los 3 handlers de cambio |
| REL-002 | Countdown por ticks de `setInterval` → drift con pestaña en background | Wall-clock: `Date.now() − inicioContadorMs` |
| REL-003 | El guard de `inicializarUI` no chequeaba los 11 nodos; `cargarActividades` corría igual | Guard completo + `if (!uiLista) return` antes de fetch |
| REL-004 | Si faltaba `#nombre`, un TypeError forzaba logout | Saludo con chequeo de nodo y de `usuarioJWT.name` |
| REL-005 | El repo no tenía suite de tests | `tests/iniciarDetener.test.cjs` + CI `.github/workflows/test.yml` |
| REL-006 | `formatearTiempo(NaN)` → `00:00:00` raro | Validación `Number.isFinite`, floor y clamp a ≥ 0 |
| REL-007 | Duración 0 se persistía en localStorage como basura | `minutosValidos()` filtra antes de restaurar |
| REL-008 | Última sesión perdía/isqueaba al recargar (revisitar) | Recuperado como REL-105 (sesión en curso) y REL-106 (namespace) — ambos corregidos |

#### Segunda ronda de fiabilidad: REL-101..113, todos corregidos

| ID | Problema | Corrección |
|----|----------|------------|
| REL-101 (CRITICAL) | INICIAR antes de cargar pisaba la última sesión con `{actividad:''}` | Guard `cargaCompleta` en `iniciarContador` + guard `!estadoSesion.actividad` en `guardarUltimaSesion` |
| REL-102 (CRITICAL) | Assets de ícono sin trackear ni testear | Test de existencia en `imagenes/` + fallback vía listener `error` del `<img>` |
| REL-103 (WARNING) | Cambiar selects durante la cuenta contradecía la UI | Los 3 selects se bloquean en `corriendo` y se liberan al DETENER/FINALIZADO/reinicio |
| REL-104 (WARNING) | Cualquier fallo de `/api/sessions/current` forzaba logout | Timeout 8 s con `AbortController`; redirect solo en 401/403; JSON y red degradan sin redirect |
| REL-105 (WARNING) | La sesión en curso se perdía al recargar | Clave `beepsafe_sesion_en_curso` + `reanudarSesionEnCurso()` (wall-clock; si venció, se descarta sin saltar a FINALIZADO) |
| REL-106 (WARNING) | La última sesión no estaba namespaceada por usuario | Claves `base:email` vía `claveConUsuario()` + migración única de la clave legada |
| REL-107 (WARNING) | Tests sin runner ni CI | `.github/workflows/test.yml` (Node 20, `node tests/iniciarDetener.test.cjs`) |
| REL-108 (WARNING) | Sin cobertura del anillo, saludo, selects, resume, etc. | 12 tests nuevos: anillo (reposo/medio/final), saludo, selects, REL-101, REL-104, reinicio, namespace, migración, resume |
| REL-109 (WARNING) | Select Equipo vacío en modo degradado | Placeholder deshabilitado `Sin actividad` |
| REL-110 (SUGGESTION) | Fallas de init silenciosas | `console.error('[iniciarDetener] nodos faltantes:', faltantes)` |
| REL-111 (SUGGESTION) | Comando de test mal escrito en el header (`.js`) | Corregido a `node tests/iniciarDetener.test.cjs` |
| REL-112 (SUGGESTION) | Declaración CSS inválida `padding-top: 5x` en `.logoActividad` | Eliminada (era no-op) + comentario de que la clase es compartida con perfil.html |
| REL-113 (SUGGESTION) | NOTAS.md desactualizado | Este parche |

Verificación: `node --check JS/iniciarDetener.js` OK;
`node tests/iniciarDetener.test.cjs` → **32/32** (20 previos + 12 nuevos).
**NO verificado**: render visual (tamaño/centrado del ícono, alineación del anillo) —
requiere abrir la página en un navegador.

### Pendiente

- [ ] Commit de todo lo anterior. **Importante**: los 4 PNGs de `imagenes/`
  (`IlustracionWindsurf.png`, `Surf.png`, `SUP.png`, `Jetski.png`) siguen sin trackear
  y hay que hacer `git add` junto con el código: el test de assets corre en CI y falla
  si al commitear no se incluyen.

## Decisiones técnicas

- **"Equipo" = `equipment` de la actividad** (NO grupos). Viene de
  `GET /api/activities/<email>` → `[{ name, equipment?: [{ name, ... }] }]`.
- **Ícono = mapa actividad → imagen** (hecho): `IMAGEN_POR_ACTIVIDAD` con los 4 PNGs
  de `imagenes/` + fallback estable por hash FNV-1a del nombre. Sin emojis.
- **Persistencia de la última sesión = localStorage** (sin backend). El back NO
  tiene modelo de sesión de entrenamiento; "Sessions" en la API = auth
  (`/api/sessions`: register/login/logout/current). No inventar endpoint.
- **Duraciones fijas**: `[15, 30, 45, 60, 90, 120, 180]` minutos, default 180.
- **Anillo = SVG inline** (`#anilloProgreso`, r=145, stroke-width=20,
  C = 2π·145 ≈ 911.06, `rotate(-90deg)` para arrancar a las 12 en punto).
  El botón perdió su `border: 20px` (era la misma huella visual); contenedor
  `.reloj` 310×310 = 270 botón + 20 anillo, así no se mueve el layout.
- **CSP estricta** (igual que el resto de las páginas): sin `unsafe-inline`.
  Por eso el progreso del anillo se setea con **CSSOM** (`el.style.strokeDashoffset`)
  y NO con `<style>` inyectado ni atributo `style=`. Datos del usuario
  (actividad/equipo) van por `textContent` / `new Option`, nunca `innerHTML`.
- **`.logoActividad` es compartida con perfil.html** (`<img class="logoActividad">`);
  el bloque CSS debe seguir funcionando para ambos usos (por eso solo se eliminó
  la declaración inválida `padding-top: 5x`, sin reemplazarla: REL-112).
- **Contador**: estados `detenido | corriendo | finalizado`; 2º click = DETENER.
  Se escribe la última sesión al apretar INICIAR (no al cambiar los selects).
  Mientras corre, los 3 selects quedan bloqueados (REL-103).
- **Degradación segura**: 401/403 de `/api/sessions/current` → redirect a
  `iniciarSesion.html`; cualquier otro fallo (red, timeout de 8 s, 500, JSON ilegible)
  → la página sigue sin saludo y sin redirect (REL-104). Sin actividades o sin red,
  funciona con "Sin actividades" / "Sin equipo" / "Sin actividad".
- **Claves de localStorage namespaceadas por usuario** (`base:email`) con migración
  única de `beepsafe_ultima_sesion` legada (REL-106); la sesión en curso
  (`beepsafe_sesion_en_curso`) también se reanuda tras un reload con reloj de pared
  (REL-105).
- **Normalización de nombres de actividad** (para el match del ícono): NFD sin
  diacríticos → minúsculas → match exacto y después por token.

## Estructura relevante del repo front

```
index.html            # landing pre-login (NO es Inicio)
pages/iniciarDetener.html   # ← la pantalla Inicio
JS/iniciarDetener.js        # ← toda la lógica de Inicio
JS/config.js                # define ROOT_URL
JS/cerrarSesion.js
styles/styles.css
imagenes/                   # assets; los 4 PNGs del ícono aún sin trackear
tests/iniciarDetener.test.cjs  # suite: node tests/iniciarDetener.test.cjs (32 tests)
.github/workflows/test.yml  # CI: corre la suite en cada push/PR (Node 20)
openspec/                   # SDD (specs + changes/archive)
```

Rutas API usadas: `GET /api/sessions/current` (JWT en localStorage, header
`Authorization: Bearer`), `GET /api/activities/<email>`.
Backs permitidos por CSP: `localhost:8080`, Render, Railway.

## Últimos commits (main)

```
928f757 fix(phones): drop the Argentine local mobile prefix 15 when normalizing
ea891cb feat(invites): update default invite message for invitees without an account
7da3e2f chore(sdd): archive group-invite-message change
c27b457 Merge PR #6 feat/crear-cuenta-prefill
e73ccd2 Merge PR #4 feat/whatsapp-invite-badge
```

## Pendientes del usuario (aparte de Inicio)

- Revisar el check de número en la registración para usuarios NO registrados
  (sospecha de comportamiento distinto según el contacto esté registrado o no).
