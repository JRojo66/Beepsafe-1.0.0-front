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

function isValidArgentinePhoneStrictNoSeparators(phone) {
  // Expresión regular estricta para validar un número de teléfono argentino
  // sin el cero inicial del código de área ni el prefijo "15" de celular,
  // y SIN permitir espacios ni guiones.
  // Requiere un código de área de 2 a 4 dígitos (comenzando generalmente con 2, 3, 4, 5, 6, 7, 8 o 9)
  // seguido directamente por un número local de 6 a 8 dígitos.
  const phoneRegexStrictNoSeparators = /^([1-9]\d{1,3})\d{6,8}$/;
  return phoneRegexStrictNoSeparators.test(phone);
}

const form = document.getElementById("registroForm");

// Hace el POST del formulario
form.addEventListener("submit", function (event) {
  event.preventDefault(); // Evita el envío del formulario por defecto

  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const password2 = document.getElementById("password2").value;

  let isValid = true;

  // Limpiar mensajes de error previos
  document.getElementById("nameError").textContent = "";
  document.getElementById("emailError").textContent = "";
  document.getElementById("phoneError").textContent = "";
  document.getElementById("passwordError").textContent = "";
  document.getElementById("password2Error").textContent = "";

  // Validar nombre
  if (!name.trim()) {
    document.getElementById("nameError").textContent =
      "Por favor, ingresa tu nombre.";
    isValid = false;
  }

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

  // Validar Teléfono
  if (!phone.trim()) {
    document.getElementById("phoneError").textContent =
      "Por favor, ingresa tu número de teléfono.";
    isValid = false;
  } else if (!isValidArgentinePhoneStrictNoSeparators(phone)) {
    document.getElementById("phoneError").textContent =
      "Por favor, ingresa un número de teléfono válido (sin 0, sin 15, sin espacios ni guiones).";
    isValid = false;
  }

  // Validar Contraseña
  if (!password) {
    document.getElementById("passwordError").textContent =
      "Por favor, ingresa una contraseña.";
    isValid = false;
  } else if (password.length < 6) {
    document.getElementById("passwordError").textContent =
      "La contraseña debe tener al menos 6 caracteres.";
    isValid = false;
  }

  // Validar Repetir Contraseña
  if (password !== password2) {
    document.getElementById("password2Error").textContent =
      "Las contraseñas no coinciden.";
    isValid = false;
  }
  
  if (isValid) {
    fetch(`${ROOT_URL}/api/sessions/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: phone,
        password: password,
        password2: password2,
      }),
    })
      .then((response) => {
        console.log("THEN EJECUTADO:", response);
        if (!response.ok) {
          console.log("Respuesta no OK:", response.status);
          return response.json().then((errData) => {
            const errorMessage =
              errData.payload || "Algo salió mal, contacte al administrador."; // Obtener el mensaje del backend
            throw new Error(errorMessage);
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("DATA EN THEN:", data);
        window.location.href = "cuentaCreadaExitosamente.html";
      })
      .catch((error) => {
        console.error("CATCH EJECUTADO:", error);
        // Redirigir a la página de error y pasar el mensaje como parámetro en la URL
        window.location.href = `errorCrearCuenta.html?error=${encodeURIComponent(
          error.message
        )}`;
      });
  }
});
