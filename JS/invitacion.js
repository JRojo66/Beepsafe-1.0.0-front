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

function pintarPlantillas(templates) {
  if (txtRegistered) txtRegistered.value = templates.registered;
  if (txtNotRegistered) txtNotRegistered.value = templates.notRegistered;
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

if (btnGuardar) {
  btnGuardar.addEventListener("click", onGuardar);
}

init();
