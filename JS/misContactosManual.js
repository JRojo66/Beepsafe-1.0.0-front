import {
  showToast,
  esTelefonoValido
} from './utils.js';

const misContactosList = document.getElementById("mis-contactos-manuales-list");
const toggleContactosManual = document.getElementById("toggleContactosManual");

// Función para limpiar el formulario
function limpiarFormulario() {
  document.getElementById("form-agregar-contacto").reset();
  document.getElementById("recibir-mensajes").checked = true;
  document.getElementById("que-me-vea").checked = true;
}

// Función para cerrar el acordeón
function cerrarAcordeonManual() {
  const misContactosList = document.getElementById("mis-contactos-manuales-list");
  const toggleContactosManual = document.getElementById("toggleContactosManual");
  
  misContactosList.style.display = "none";
  
  // Rotar el icono de vuelta
  const icon = toggleContactosManual.querySelector("i");
  if (icon) {
    icon.classList.remove("rotate");
  }
  
  // Limpiar formulario
  limpiarFormulario();
}

// Función para agregar el contacto
async function agregarContactoManual(event) {
  event.preventDefault();
  
  const nombre = document.getElementById("nombre-contacto").value.trim();
  const telefono = document.getElementById("telefono-contacto").value.trim();
  const recibirMensajes = document.getElementById("recibir-mensajes").checked;
  const queMeVea = document.getElementById("que-me-vea").checked;
  
  // Validaciones
  if (!nombre) {
    showToast("El nombre es obligatorio", "error");
    return;
  }
  
  if (!telefono) {
    showToast("El teléfono es obligatorio", "error");
    return;
  }
  
  // Chequeo previo sólo para feedback instantáneo. No sanitizamos acá: el
  // backend es el dueño de la forma canónica del teléfono.
  if (!esTelefonoValido(telefono)) {
    showToast(`El número de teléfono "${telefono}" no es válido`, "error");
    return;
  }
  
  // Preparar payload con lo que escribió el usuario
  const payload = {
    nombre: nombre,
    telefono: telefono,
    mensajes: recibirMensajes,
    visibilidad: queMeVea,
  };
  
  try {
    const response = await fetch(`${ROOT_URL}/api/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      // El 400 del backend trae { error: "..." } con el motivo del rechazo.
      // Si el body no es JSON no queremos caer en el catch de red y perder ese
      // mensaje, así que tolerateamos el parseo.
      let err = {};
      try {
        err = await response.json();
      } catch (parseErr) {
        console.warn("No se pudo leer el error del servidor:", parseErr);
      }
      showToast("Error: " + (err.error || "No se pudo agregar el contacto"), "error");
      return;
    }
    
    showToast("Contacto agregado exitosamente", "success");
    
    // Limpiar formulario pero mantener el acordeón abierto
    limpiarFormulario();
    
    // Enfocar el campo de nombre para agregar otro contacto fácilmente
    document.getElementById("nombre-contacto").focus();
    
    // Refrescar la lista de "Mis Contactos" si existe la función
    if (typeof renderizarMisContactos === "function") {
      const res = await fetch(`${ROOT_URL}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const { contactos: nuevosContactos } = await res.json();
      renderizarMisContactos(nuevosContactos);
    }
    
    // También refrescar contactos de Google si están cargados
    if (typeof refrescarContactosGoogle === "function") {
      refrescarContactosGoogle();
    }
    
  } catch (err) {
    showToast("Error al conectar con el servidor", "error");
    console.error(err);
  }
}

// Event Listeners
toggleContactosManual?.addEventListener("click", async () => {
  
  // Obtener el estado actual
  const isCurrentlyVisible = misContactosList.style.display === "block";
  
  // Alternar visibilidad
  if (isCurrentlyVisible) {
    misContactosList.style.display = "none";
  } else {
    misContactosList.style.display = "block";
  }

  // Rotar el icono de chevron
  const icon = toggleContactosManual.querySelector("i");
  if (icon) {
    if (isCurrentlyVisible) {
      icon.classList.remove("rotate");
    } else {
      icon.classList.add("rotate");
    }
  }
  
  // Si se abre, limpiar formulario y enfocar el nombre
  if (!isCurrentlyVisible) {
    limpiarFormulario();
    setTimeout(() => {
      const nombreInput = document.getElementById("nombre-contacto");
      if (nombreInput) {
        nombreInput.focus();
      }
    }, 100);
  }
});

// Event listeners del formulario
document.addEventListener("DOMContentLoaded", () => {
  // Enviar formulario
  const formAgregar = document.getElementById("form-agregar-contacto");
  if (formAgregar) {
    formAgregar.addEventListener("submit", agregarContactoManual);
  }
  
  // Botón cancelar - cierra el acordeón
  const btnCancelar = document.getElementById("cancelar-agregar-contacto");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", cerrarAcordeonManual);
  }
  
  // Cerrar acordeón con ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const misContactosList = document.getElementById("mis-contactos-manuales-list");
      if (misContactosList && misContactosList.style.display === "block") {
        cerrarAcordeonManual();
      }
    }
  });
});