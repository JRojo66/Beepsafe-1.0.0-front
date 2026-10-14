// invitacion.js
//
// Page logic for pages/invitacion.html. Loads the authenticated user's invite
// templates, populates the two editors, and saves edits back through
// guardarPlantillas() (PUT /api/invite-templates).
//
// No inline handlers: everything is wired with addEventListener here.

import { cargarPlantillas, guardarPlantillas } from "./inviteTemplates.js";
import { showToast } from "./utils.js";

const txtRegistered = document.getElementById("plantilla-registered");
const txtNotRegistered = document.getElementById("plantilla-notRegistered");
const btnGuardar = document.getElementById("guardar-plantillas-btn");

// Fields the user has already edited. The async load MUST NOT clobber these.
const camposTocados = new Set();

// Guards saving until the initial load settles, so a click during the GET never
// persists half-loaded (empty) textareas.
let cargado = false;

function pintarPlantillas(templates) {
  if (txtRegistered && !camposTocados.has(txtRegistered)) {
    txtRegistered.value = templates.registered;
  }
  if (txtNotRegistered && !camposTocados.has(txtNotRegistered)) {
    txtNotRegistered.value = templates.notRegistered;
  }
}

function leerFormulario() {
  return {
    registered: txtRegistered ? txtRegistered.value : "",
    notRegistered: txtNotRegistered ? txtNotRegistered.value : "",
  };
}

async function init() {
  const resultado = await cargarPlantillas();
  pintarPlantillas(resultado.templates);

  if (!resultado.ok && resultado.source === "local") {
    showToast(
      "No se pudieron cargar tus plantillas. Se usan las guardadas en este dispositivo.",
      "error"
    );
  } else if (!resultado.ok) {
    showToast(
      "No se pudieron cargar tus plantillas. Se muestran las predeterminadas.",
      "error"
    );
  }
}

async function onGuardar() {
  if (!cargado) return;
  if (btnGuardar) btnGuardar.disabled = true;
  try {
    const resultado = await guardarPlantillas(leerFormulario());
    if (resultado.ok) {
      showToast("Plantillas guardadas", "success");
    } else {
      showToast(
        "No se pudieron guardar en el servidor. Se guardaron en este dispositivo.",
        "error"
      );
    }
  } finally {
    if (btnGuardar) btnGuardar.disabled = false;
  }
}

if (txtRegistered) {
  txtRegistered.addEventListener("input", () => camposTocados.add(txtRegistered));
}
if (txtNotRegistered) {
  txtNotRegistered.addEventListener("input", () =>
    camposTocados.add(txtNotRegistered)
  );
}

if (btnGuardar) {
  // Disabled until init() settles: no saving against a half-loaded editor.
  btnGuardar.disabled = true;
  btnGuardar.addEventListener("click", onGuardar);
}

// Enable Guardar only once the load has finished (success or failure), and mark
// the editor as ready so a stray click cannot persist empty defaults.
init().finally(() => {
  cargado = true;
  if (btnGuardar) btnGuardar.disabled = false;
});
