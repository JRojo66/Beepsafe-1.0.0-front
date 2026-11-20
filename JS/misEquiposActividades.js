// Obtiene todas las actividades de todos los usuarios
// fetch(`${ROOT_URL}/api/activities`)
//   .then((res) => {
//     if (!res.ok) throw new Error("Respuesta no satisfactoria");
//     return res.json();
//   })
//   .then((data) => {
//     console.log("Actividades de todos los usuarios:", data); // array de strings
//   })
//   .catch((error) => {
//     console.error("Error al obtener actividades del usuario:", error);
//   });
import { showToast } from "./utils.js";

let visorFotoEquipo = null;
let imagenVisorFotoEquipo = null;
let botonCerrarVisorFoto = null;
let disparadorVisorFoto = null;
let scrollPrevioVisorFoto = "";

function abrirVisorFotoEquipo(foto, nombre, disparador) {
  if (!foto || !visorFotoEquipo || !imagenVisorFotoEquipo) return;
  const etiqueta = `Foto de ${nombre}`;
  imagenVisorFotoEquipo.src = foto;
  imagenVisorFotoEquipo.alt = etiqueta;
  visorFotoEquipo.setAttribute("aria-label", etiqueta);
  disparadorVisorFoto = disparador || null;
  if (document.body && document.body.style) {
    scrollPrevioVisorFoto = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }
  visorFotoEquipo.classList.remove("hidden");
  if (botonCerrarVisorFoto && typeof botonCerrarVisorFoto.focus === "function") {
    botonCerrarVisorFoto.focus();
  }
}

function cerrarVisorFotoEquipo() {
  if (!visorFotoEquipo) return;
  visorFotoEquipo.classList.add("hidden");
  if (imagenVisorFotoEquipo) {
    imagenVisorFotoEquipo.src = "";
    imagenVisorFotoEquipo.alt = "";
  }
  if (document.body && document.body.style) {
    document.body.style.overflow = scrollPrevioVisorFoto || "";
  }
  if (disparadorVisorFoto && typeof disparadorVisorFoto.focus === "function") {
    disparadorVisorFoto.focus();
  }
  disparadorVisorFoto = null;
}

function conectarBotonFotoEquipo(boton) {
  if (!boton || typeof boton.addEventListener !== "function") return;
  boton.addEventListener("click", (evento) => {
    if (evento && typeof evento.stopPropagation === "function") {
      evento.stopPropagation();
    }
    const imagen =
      typeof boton.querySelector === "function"
        ? boton.querySelector(".equipment-photo")
        : null;
    if (!imagen) return;
    const foto = imagen.src || imagen.getAttribute("src");
    abrirVisorFotoEquipo(foto, imagen.alt || "", boton);
  });
}

function inicializarVisorFotoEquipo() {
  visorFotoEquipo = document.getElementById("visorFotoEquipo");
  imagenVisorFotoEquipo = document.getElementById("imagenVisorFotoEquipo");
  botonCerrarVisorFoto = document.getElementById("cerrarVisorFotoEquipo");
  if (!visorFotoEquipo || !imagenVisorFotoEquipo) return;
  if (botonCerrarVisorFoto) {
    botonCerrarVisorFoto.addEventListener("click", cerrarVisorFotoEquipo);
  }
  visorFotoEquipo.addEventListener("click", (evento) => {
    if (evento && evento.target === visorFotoEquipo) cerrarVisorFotoEquipo();
  });
  document.addEventListener("keydown", (evento) => {
    if (!evento || evento.key !== "Escape") return;
    if (!visorFotoEquipo.classList.contains("hidden")) cerrarVisorFotoEquipo();
  });
}

function crearHTMLFotoEquipo(equipo) {
  if (!equipo || !equipo.photo?.trim()) return "";
  const foto = encodeURI(equipo.photo.trim());
  return `<button type="button" class="equipment-photo-boton" aria-label="Ver foto de ${
    equipo.name
  }"><img class="equipment-photo" src="${foto}" alt="${equipo.name}" /></button>`;
}

function showConfirm(mensaje, titulo = "Confirmar eliminación") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const tituloElemento = document.getElementById("confirm-title");
    const messageElement = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-delete");
    const btnNo = document.getElementById("confirm-cancel");
    const btnClose = document.getElementById("confirm-close");

    if (!modal || !messageElement || !btnYes || !btnNo) {
      resolve(false);
      return;
    }

    if (tituloElemento) tituloElemento.textContent = titulo;
    messageElement.textContent = mensaje;
    modal.classList.remove("hidden");

    let resuelto = false;
    const cleanup = () => {
      modal.classList.add("hidden");
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
      if (btnClose) btnClose.removeEventListener("click", onClose);
      document.removeEventListener("keydown", onKeydown);
    };
    const terminar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      cleanup();
      resolve(valor);
    };
    const onYes = () => terminar(true);
    const onNo = () => terminar(false);
    const onClose = () => terminar(false);
    const onKeydown = (evento) => {
      if (evento && evento.key === "Escape") terminar(false);
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
    if (btnClose) btnClose.addEventListener("click", onClose);
    document.addEventListener("keydown", onKeydown);
    if (typeof btnYes.focus === "function") btnYes.focus();
  });
}

async function eliminarEquipoConConfirmacion(email, actName, eqName) {
  const confirmed = await showConfirm("¿Eliminar este equipo?", "Eliminar equipo");
  if (!confirmed) return false;

  try {
    const res = await fetch(`${ROOT_URL}/api/activities/equipment`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        email,
        activity: actName,
        equipmentName: eqName,
      }),
    });

    if (!res.ok) throw new Error("Error al eliminar equipo.");

    showToast("Equipo eliminado", "success");
    const prevState = getAccordionState();
    const prevScrollY = window.scrollY;
    fetchUserActivities(prevState, prevScrollY);
    return true;
  } catch (err) {
    showToast(`error al eliminar el equipo ${err.message}`, "error");
    return false;
  }
}

async function eliminarActividadConConfirmacion(email, actName) {
  const confirmed = await showConfirm(
    "¿Estás seguro de que querés eliminar esta actividad? Se borrarán los equipos de esta actividad también.",
    "Eliminar actividad"
  );
  if (!confirmed) return false;

  try {
    const res = await fetch(`${ROOT_URL}/api/activities`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ email, activity: actName }),
    });

    if (!res.ok) throw new Error("Error al eliminar actividad.");

    showToast("Actividad eliminada", "success");
    const prevState = getAccordionState();
    const prevScrollY = window.scrollY;
    fetchUserActivities(prevState, prevScrollY);
    return true;
  } catch (err) {
    showToast(`error al eliminar la actividad ${err.message}`, "error");
    return false;
  }
}

// Verifica que esté logueado
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
      method: "GET",
      // credentials: 'include',                                            windows - android
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // iOS
      },
    });
    if (!response.ok) {
      throw new Error("Token inválido");
    }
  } catch (err) {
    window.location.href = "iniciarSesion.html";
  }
});

// spinner
const spinner = document.getElementById("spinner");

// Guardar el estado de los acordeones antes de recargar
function getAccordionState() {
  const accordions = document.querySelectorAll(".accordion");
  const state = [];
  accordions.forEach((acc) => {
    const activityName = acc
      .querySelector(".accordion-header span:nth-child(2)")
      ?.textContent.trim();
    const isOpen = acc.classList.contains("open");
    const isFormVisible =
      acc.querySelector(".add-equipment-form")?.style.display !== "none";
    if (activityName) {
      state.push({ activityName, isOpen, isFormVisible });
    }
  });
  return state;
}

async function fetchUserActivities(
  previousState = [],
  scrollYToRestore = null
) {
  const container = document.getElementById("accordion-container");
  container.innerHTML = ""; // Limpiar actividades anteriores

  spinner.style.display = "block"; // ⬅️ Mostrar spinner al comenzar

  try {
    // Obtener email del usuario desde JWT
    const resUser = await fetch(`${ROOT_URL}/api/sessions/current`, {
      // credentials: "include",                                            windows - android
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // iOS
      },
    });
    const { userJWT } = await resUser.json();
    const email = userJWT.email;

    // Obtener actividades desde la DB usando el email

    const res = await fetch(`${ROOT_URL}/api/activities/${email}`, {
      // credentials: "include",                                            windows - android
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // iOS
      },
    });

    if (!res.ok) throw new Error("Respuesta no satisfactoria");

    const activities = await res.json(); // 👈 es un array, no un objeto

    if (!activities || activities.length === 0) {
      container.innerHTML = "<p>No hay actividades cargadas.</p>";
      return;
    }

    // Crear los elementos del acordeón
    activities.forEach((activity) => {
      const accordion = document.createElement("div");
      accordion.classList.add("accordion", "fila-ancho-completo");

      accordion.innerHTML = `
                <div class="accordion-header">
                    <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    <span>${activity.name}</span>
                    <button class="delete-btn" data-id="${
                      activity._id
                    }" title="Eliminar actividad">🗑️</button>
                </div>
            <div class="accordion-body">
              ${activity.equipment
                .map(
                  (eq) => `
                  <div class="equipment-item fila-ancho-completo">
                    <div class="equipment-text">
                      <strong>${eq.name}</strong>
                      <span>${eq.description}</span>
                    </div>
                      ${crearHTMLFotoEquipo(eq)}
                      <button class="delete-equipment-btn" data-activity="${
                        activity.name
                      }" data-eq-name="${
                    eq.name
                  }" title="Eliminar equipo">🗑️</button>
                  </div>`
                )
                .join("")}
                <span class="toggle-add-equipment botonActividad fila-ancho-completo">
                <i class="fas fa-chevron-down toggle-icon"></i>Agregar equipo</span>
                <div class="add-equipment-form hidden">
                    <input type="text" placeholder="Nombre equipo" class="input-name" />
                    <input type="text" placeholder="Descripción" class="input-desc" />
                    <!--<input type="text" placeholder="URL foto" class="input-photo" />-->
                  <div class="upload-buttons">
                    <button class="upload-btn camera-btn">📷 Cámara</button>
                    <button class="upload-btn gallery-btn">🖼️ Galería</button>
                    <input type="file" accept="image/*" capture="environment" class="camera-input hidden" />
                    <input type="file" accept="image/*" class="gallery-input hidden" />
                  </div>                    
                    <button class="add-equipment-btn">Guardar Equipo</button>
                </div>
            </div>
          `;

      accordion
        .querySelectorAll(".equipment-photo-boton")
        .forEach((btn) => conectarBotonFotoEquipo(btn));

      // Delete equipment
      accordion.querySelectorAll(".delete-equipment-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const eqName = btn.dataset.eqName;
          const actName = btn.dataset.activity;
          await eliminarEquipoConConfirmacion(email, actName, eqName);
        });
      });

      // Delete activities
      accordion
        .querySelector(".delete-btn")
        .addEventListener("click", async (e) => {
          e.stopPropagation(); // para que no se abra/cierre el acordeón al hacer click
          await eliminarActividadConConfirmacion(email, activity.name);
        });

      // Add equipment
      // Mostrar/ocultar formulario de agregar equipo

      accordion
        .querySelector(".toggle-add-equipment")
        .addEventListener("click", () => {
          const form = accordion.querySelector(".add-equipment-form");
          const toggleIcon = accordion.querySelector(
            ".toggle-add-equipment .toggle-icon"
          );

          const isVisible = form.style.display === "block";
          form.style.display = isVisible ? "none" : "block";

          if (toggleIcon) {
            toggleIcon.classList.toggle("rotate", !isVisible);
          }
        });

      // Activar botones de subir foto desde cámara o galería
      const form = accordion.querySelector(".add-equipment-form");
      const cameraBtn = form.querySelector(".camera-btn");
      const galleryBtn = form.querySelector(".gallery-btn");
      const cameraInput = form.querySelector(".camera-input");
      const galleryInput = form.querySelector(".gallery-input");

      cameraBtn.addEventListener("click", (e) => {
        e.preventDefault();
        cameraInput.click();
      });
      galleryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        galleryInput.click();
      });

      accordion
        .querySelector(".add-equipment-btn")
        .addEventListener("click", async (e) => {
          e.stopPropagation();

          spinner.style.display = "block"; // ⬅️ Mostrar spinner

          const sanitize = (str) => str.replace(/[<>"'\/]/g, "");

          const name = sanitize(
            accordion.querySelector(".input-name").value.trim()
          );
          const description = sanitize(
            accordion.querySelector(".input-desc").value.trim()
          );
          const fileInput = accordion.querySelector(".camera-input").files[0]
            ? accordion.querySelector(".camera-input")
            : accordion.querySelector(".gallery-input");
          const photoFile = fileInput?.files[0];

          if (!name) {
            showToast(
              "Por favor completá el nombre del equipo.",
              "error"
            );
            spinner.style.display = "none"; // ⬅️ Ocultarlo si hay error de validación
            return;
          }

          const formData = new FormData();
          formData.append("email", email);
          formData.append("activity", activity.name);
          formData.append("equipment", JSON.stringify({ name, description }));
          if (photoFile) {
            formData.append("photo", photoFile);
          }

          try {
            const res = await fetch(`${ROOT_URL}/api/activities/equipment`, {
              method: "POST",
              //credentials: "include",                                         windows - android
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`, // iOS
              },

              body: formData, // no se necesita Content-Type, el navegador lo pone solo
            });

            if (!res.ok) {
              const errorText = await res.text();
              throw new Error("Error al agregar equipo: " + errorText);
            }

            const prevState = getAccordionState();
            const prevScrollY = window.scrollY;
            fetchUserActivities(prevState, prevScrollY);
            showToast("Equipo Agregado", "success");
          } catch (err) {
            showToast(`error al agregar el equipo ${err.message}`, "error");
          } finally {
            spinner.style.display = "none"; // ⬅️ Ocultar spinner
          }
        });

      // Hacer que se abra/cierre el menú al hacer click
      accordion
        .querySelector(".accordion-header")
        .addEventListener("click", () => {
          accordion.classList.toggle("open");
        });

      // Restaurar estado previo del acordeón y formulario
      const prev = previousState.find((p) => p.activityName === activity.name);
      if (prev?.isOpen) {
        accordion.classList.add("open");
      }
      container.appendChild(accordion);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error al cargar las actividades.</p>";
  }

  if (scrollYToRestore !== null) {
    window.scrollTo(0, scrollYToRestore);
  }
    spinner.style.display = "none"; // ⬅️ Ocultar spinner
}

document.addEventListener("DOMContentLoaded", () => fetchUserActivities([]));

// Despliega el formulario para agregar Actividades
const mostrarControl = document.querySelector(".accordion-header-activity");
const formContainer = document.getElementById("actividadFormContainer");
const actividadForm = document.getElementById("actividadForm");
const errorDiv = document.getElementById("actividadError");

formContainer.style.display = "none";

mostrarControl.addEventListener("click", () => {
  const toggleIcon = document.querySelector(
    ".accordion-header-activity .toggle-icon i"
  );

  const isVisible = formContainer.style.display === "block";
  formContainer.style.display = isVisible ? "none" : "block";

  console.log("isVisible: ", isVisible);
  console.log("toggleIcon: ", toggleIcon);

  if (toggleIcon) {
    toggleIcon.classList.toggle("rotate", !isVisible);
  }
});

actividadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const actividad = document.getElementById("nuevaActividad").value.trim();

  if (!actividad) {
    errorDiv.textContent = "La actividad no puede estar vacía.";
    return;
  }

  try {
    const res = await fetch(`${ROOT_URL}/api/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", //iOS
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      // credentials: "include",                                            windows - android
      body: JSON.stringify({ activity: actividad }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Error al guardar actividad.");
    }

    showToast("Actividad agregada", "success");
    formContainer.style.display = "none";
    actividadForm.reset();
    const prevState = getAccordionState();
    const prevScrollY = window.scrollY;
    fetchUserActivities(prevState, prevScrollY);
  } catch (err) {
    showToast(`error al agregar la actividad ${err.message}`, "error");
  }
});

inicializarVisorFotoEquipo();
