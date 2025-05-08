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


// Obtiene las actividades de un usuario 
fetch(`${ROOT_URL}/api/activities/cata@gmail.com`)
  .then((res) => {
    if (!res.ok) throw new Error("Respuesta no satisfactoria");
    return res.json();
  })
  .then((data) => {
    console.log("Actividades de todos los usuarios:", data); // array de strings
  })
  .catch((error) => {
    console.error("Error al obtener actividades del usuario:", error);
  });


// Despliega el formulario para agregar Actividades
const mostrarBtn = document.getElementById("mostrarFormularioActividad");
const formContainer = document.getElementById("actividadFormContainer");
const actividadForm = document.getElementById("actividadForm");
const errorDiv = document.getElementById("actividadError");

formContainer.style.display = "none"

mostrarBtn.addEventListener("click", () => {
  formContainer.style.display =
    formContainer.style.display === "none" ? "block" : "none";
});

actividadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const actividad = document.getElementById("nuevaActividad").value.trim();

  if (!actividad) {
    errorDiv.textContent = "La actividad no puede estar vacía.";
    return;
  }

  fetch(`${ROOT_URL}/api/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
       activity: actividad,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((data) => {
          throw new Error(data.message || "Error al guardar actividad.");
        });
      }
      return res.json();
    })
    .then((data) => {
      alert("Actividad agregada con éxito.");
      formContainer.style.display = "none";
      actividadForm.reset();
    })
    .catch((err) => {
      errorDiv.textContent = err.message;
    });
});

// Despliega el formulario para agregar Equipos
const mostrarBtnEquipo = document.getElementById("mostrarFormularioEquipo");
const formContainerEquipo = document.getElementById("equipoFormContainer");
const actividadFormEquipo = document.getElementById("equipoForm");
const errorDivEquipo = document.getElementById("equipoError");

formContainerEquipo.style.display = "none"

mostrarBtnEquipo.addEventListener("click", () => {
  formContainerEquipo.style.display =
    formContainerEquipo.style.display === "none" ? "block" : "none";
});

equipoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const equipo = document.getElementById("nuevoEquipoTipo").value.trim();
  const descripcion = document.getElementById("nuevoEquipoDescripcion").value.trim();
  const foto = document.getElementById("nuevoEquipoFoto").value.trim();

  if (!equipo) {
    errorDiv.textContent = "Equipo no puede estar vacío.";
    return;
  }

  fetch(`${ROOT_URL}/api/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
       activity: actividad,                                           // ** Que venga actividad ** //
       equipment: equipo,
       description: descripcion,
       photo: foto,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((data) => {
          throw new Error(data.message || "Error al guardar equipo.");
        });
      }
      return res.json();
    })
    .then((data) => {
      alert("Equipo agregado con éxito.");
      formContainer.style.display = "none";
      actividadForm.reset();
    })
    .catch((err) => {
      errorDiv.textContent = err.message;
    });
});
