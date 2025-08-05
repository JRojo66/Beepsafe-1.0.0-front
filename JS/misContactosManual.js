const misContactosList = document.getElementById("mis-contactos-manuales-list");
const toggleContactosManual = document.getElementById("toggleContactosManual");

// Función para sanitizar teléfono (reutilizamos la misma del archivo Google)
function sanitizarTelefonoE164(input) {
  const limpio = input.trim().replace(/[^\d+]/g, ""); // Elimina todo excepto dígitos y "+"
  const soloNumeros = limpio.replace(/\D/g, ""); // solo números

  // Si empieza con 00 → internacional
  if (soloNumeros.startsWith("00")) {
    return "+" + soloNumeros.slice(2);
  }

  // Si empieza con +54 (Argentina), forzamos +549...
  if (limpio.startsWith("+54")) {
    const sinMas = soloNumeros; // Ej: "541134560947" o "5491151227864"
    if (sinMas.startsWith("54") && !sinMas.startsWith("549")) {
      return "+549" + sinMas.slice(2); // fuerza el 9 después de 54
    }
    return "+" + sinMas;
  }

  // Si empieza con 15 y tiene 11 dígitos → +549...
  if (soloNumeros.startsWith("15") && soloNumeros.length === 11) {
    return "+549" + soloNumeros.slice(2);
  }

  // Si empieza con 9 y tiene 11 dígitos → ya está bien
  if (soloNumeros.startsWith("9") && soloNumeros.length === 11) {
    return "+54" + soloNumeros;
  }

  // Si empieza con 0 y tiene 11 dígitos → forzamos +549...
  if (soloNumeros.startsWith("0") && soloNumeros.length === 11) {
    return "+549" + soloNumeros.slice(1);
  }

  // Si tiene 10 dígitos → asumimos móvil sin 0 ni 9 → le agregamos ambos
  if (soloNumeros.length === 10) {
    return "+549" + soloNumeros;
  }

  // Fallback genérico (último recurso)
  return "+" + soloNumeros;
}

function esTelefonoValido(numero) {
  // Debe empezar con + y tener entre 10 y 15 dígitos
  return /^\+\d{10,15}$/.test(numero);
}

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
  
  // Sanitizar y validar teléfono
  const telefonoSanitizado = sanitizarTelefonoE164(telefono);
  
  if (!esTelefonoValido(telefonoSanitizado)) {
    showToast(`El número de teléfono "${telefono}" no es válido`, "error");
    return;
  }
  
  // Preparar payload
  const payload = {
    nombre: nombre,
    telefono: telefonoSanitizado,
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
      const err = await response.json();
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