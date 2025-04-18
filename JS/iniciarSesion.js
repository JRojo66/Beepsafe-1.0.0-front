// Muestra/oculta las contraseñas al hacer click en el ojito

function togglePassword(id, icon) {
  let input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

// Validación de email
function isValidEmail(email) {
  // Expresión regular para validar un formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const form = document.getElementById("iniciarSesionForm");

form.addEventListener("submit", function (event) {
  event.preventDefault(); // Evita el envío del formulario por defecto

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  let isValid = true;

  // Limpiar mensajes de error previos
  document.getElementById("emailError").textContent = "";
  document.getElementById("passwordError").textContent = "";

  // Validar Email
  if (!email.trim()) {
    document.getElementById("emailError").textContent =
      "Por favor, ingresa tu email.";
    isValid = false;
  } else if (!isValidEmail(email)) {
    document.getElementById("emailError").textContent =
      "Por favor, ingresa un email válido.";
    isValid = false;
  }

  // Validar la longitud de la contraseña
  if (password.length < 6) {
    passwordError.textContent =
      "La contraseña debe tener al menos 6 caracteres.";
    return; // Detiene la ejecución de la función y no hace el fetch
  }
  if (isValid) {
    fetch("http://localhost:8080/api/sessions/login", {
      method: "POST",
      credentials: "include", // 👈 NECESARIO PARA ENVIAR COOKIES
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    })
    .then((response) => {
      console.log("THEN EJECUTADO:", response);
      if (!response.ok) {
        console.log("Respuesta no OK:", response.status);
        return response.json().then((errData) => {
          const errorMessage =
            errData.error || "Algo salió mal, contacte al administrador."; // Obtener el mensaje del backend
          throw new Error(errorMessage);
        });
      }
      return response.json();
    })
    .then((data) => {
      console.log("DATA EN THEN:", data);
      window.location.href = "IniciarDetener.html";
    })
    .catch((error) => {
      console.error("CATCH EJECUTADO:", error);
      // Redirigir a la página de error y pasar el mensaje como parámetro en la URL
      //window.location.href = `errorIniciarSesion.html?error=${encodeURIComponent(error.message)}`;
    });
}
});