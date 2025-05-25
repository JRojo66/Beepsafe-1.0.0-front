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

  try {
    // Obtener email del usuario desde JWT
    const resUser = await fetch(`${ROOT_URL}/api/sessions/current`, {
      // credentials: "include",                                            windows - android
      headers: {          
         "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
        }

    });
    const { userJWT } = await resUser.json();
    const email = userJWT.email;

    // Obtener actividades desde la DB usando el email

    const res = await fetch(`${ROOT_URL}/api/activities/${email}`, {
      // credentials: "include",                                            windows - android
      headers: {          
         "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
        }
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
      accordion.classList.add("accordion");

      accordion.innerHTML = `
                <div class="accordion-header">
                    <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    <span>${activity.name}</span>
                    <button class="delete-btn" data-id="${activity._id}" title="Eliminar actividad">🗑️</button>
                </div>
            <div class="accordion-body">
              ${activity.equipment
                .map(
                  (eq) => `
                  <div class="equipment-item">
                    <div class="equipment-text">
                      <strong>${eq.name}</strong>
                      <span>${eq.description}</span>
                    </div>
                      ${eq.photo?.trim()? `<img class="equipment-photo" src="${encodeURI(eq.photo.trim())}" alt="${eq.name}" />`:""}
                      <button class="delete-equipment-btn" data-activity="${activity.name}" data-eq-name="${eq.name}" title="Eliminar equipo">🗑️</button>
                  </div>`
                )
                .join("")}
                <button class="toggle-add-equipment botonActividad">Agregar equipo</button>
                <div class="add-equipment-form" style="display:none;">
                    <input type="text" placeholder="Nombre equipo" class="input-name" />
                    <input type="text" placeholder="Descripción" class="input-desc" />
                    <!--<input type="text" placeholder="URL foto" class="input-photo" />-->
                  <div class="upload-buttons">
                    <button class="upload-btn camera-btn">📷 Cámara</button>
                    <button class="upload-btn gallery-btn">🖼️ Galería</button>
                    <input type="file" accept="image/*" capture="environment" class="camera-input" style="display:none;" />
                    <input type="file" accept="image/*" class="gallery-input" style="display:none;" />
                  </div>


                    
                    <button class="add-equipment-btn">Guardar Equipo</button>
                </div>
            </div>
          `;

      // Delete equipment
      accordion.querySelectorAll(".delete-equipment-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const eqName = btn.dataset.eqName;
          const actName = btn.dataset.activity;

          const confirmDelete = confirm(
            `¿Eliminar el equipo "${eqName}" de la actividad "${actName}"?`
          );
          if (!confirmDelete) return;

          try {
            const res = await fetch(`${ROOT_URL}/api/activities/equipment`, {
              method: "DELETE",
              //credentials: "include",                                   windows - android
              headers: {          
              "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
              },

              body: JSON.stringify({
                email,
                activity: actName,
                equipmentName: eqName,
              }),
            });

            if (!res.ok) throw new Error("Error al eliminar equipo.");
            
            // alert("Equipo eliminado");
            const prevState = getAccordionState();
            const prevScrollY = window.scrollY;
            fetchUserActivities(prevState, prevScrollY);
          } catch (err) {
            alert(err.message);
          }
        });
      });

      // Delete activities
      accordion
        .querySelector(".delete-btn")
        .addEventListener("click", async (e) => {
          e.stopPropagation(); // para que no se abra/cierre el acordeón al hacer click

          //const id = e.target.dataset.id;
          const confirmDelete = confirm(
            "¿Estás seguro de que querés eliminar esta actividad? Se borraran los equipos de esta actividad también"
          );
          if (!confirmDelete) return;

          try {
            const res = await fetch(`${ROOT_URL}/api/activities`, {
              method: "DELETE",
              //credentials: "include",                                         windows - android
              headers: {
              "Content-Type": "application/json",               
              "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
              },

              body: JSON.stringify({ email, activity: activity.name }),
            });

            if (!res.ok) throw new Error("Error al eliminar actividad.");

            // alert("Actividad eliminada");
            const prevState = getAccordionState();
            const prevScrollY = window.scrollY;
            fetchUserActivities(prevState, prevScrollY);
          } catch (err) {
            alert(err.message);
          }
        });

      // Add equipment
      // Mostrar/ocultar formulario de agregar equipo

      accordion
        .querySelector(".toggle-add-equipment")
        .addEventListener("click", () => {
          const form = accordion.querySelector(".add-equipment-form");
          form.style.display = form.style.display === "none" ? "block" : "none";
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

          const name = accordion.querySelector(".input-name").value.trim();
          const description = accordion
            .querySelector(".input-desc")
            .value.trim();
          const fileInput = accordion.querySelector(".camera-input").files[0]
            ? accordion.querySelector(".camera-input")
            : accordion.querySelector(".gallery-input");
          const photoFile = fileInput?.files[0];

          if (!name || !description) {
            alert(
              "Por favor completá al menos el nombre y la descripción del equipo."
            );
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
             "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
              },

              body: formData, // no se necesita Content-Type, el navegador lo pone solo
            });

            // if (!res.ok) throw new Error("Error al agregar equipo *** ");
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error("Error al agregar equipo: " + errorText);
            }

            const prevState = getAccordionState();
            const prevScrollY = window.scrollY;
            fetchUserActivities(prevState, prevScrollY);
          } catch (err) {
            alert(err.message);
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
}

document.addEventListener("DOMContentLoaded", () => fetchUserActivities([]));

// Despliega el formulario para agregar Actividades
const mostrarBtn = document.getElementById("mostrarFormularioActividad");
const formContainer = document.getElementById("actividadFormContainer");
const actividadForm = document.getElementById("actividadForm");
const errorDiv = document.getElementById("actividadError");

formContainer.style.display = "none";

mostrarBtn.addEventListener("click", () => {
  const toggleIcon = document.querySelector(".accordion-header-activity .toggle-icon i");

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
        "Content-Type": "application/json",                             //iOS
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      // credentials: "include",                                            windows - android
      body: JSON.stringify({ activity: actividad }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Error al guardar actividad.");
    }

    // alert("Actividad agregada");
    formContainer.style.display = "none";
    actividadForm.reset();
    const prevState = getAccordionState();
    const prevScrollY = window.scrollY;
    fetchUserActivities(prevState, prevScrollY);
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});
