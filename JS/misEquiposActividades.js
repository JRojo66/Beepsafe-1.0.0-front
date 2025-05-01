const mostrarBtn = document.getElementById("mostrarFormularioActividad");
const formContainer = document.getElementById("actividadFormContainer");
const actividadForm = document.getElementById("actividadForm");
const errorDiv = document.getElementById("actividadError");

// Simulamos obtener el email del usuario logueado (idealmente viene de sesión o JWT)
const emailUsuario = "jrojo66@gmail.com";

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

console.log(JSON.stringify({
           email: emailUsuario,
           activity: actividad,
         }));

//   fetch(`${ROOT_URL}/api/activities`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       email: emailUsuario,
//       activity: actividad,
//     }),
//   })
//     .then((res) => {
//       if (!res.ok) {
//         return res.json().then((data) => {
//           throw new Error(data.message || "Error al guardar actividad.");
//         });
//       }
//       return res.json();
//     })
//     .then((data) => {
//       alert("Actividad agregada con éxito.");
//       formContainer.style.display = "none";
//       actividadForm.reset();
//     })
//     .catch((err) => {
//       errorDiv.textContent = err.message;
//     });
});
