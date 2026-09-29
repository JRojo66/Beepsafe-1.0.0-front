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

// Chequeo previo (pre-flight) del teléfono: cuenta dígitos y nada más.
// NO valida formato ni arma un E.164, el prefijo y la forma canónica los
// decide el backend con su propia normalización y su regex /^\+\d{10,15}$/.
// Acá se manda el número tal cual lo tipeó el usuario.
function isValidLocalPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
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
  } else if (!isValidLocalPhone(phone)) {
    document.getElementById("phoneError").textContent =
      "Ingresá los 10 u 11 dígitos de tu número con código de área, sin el +54.";
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
      }),
    })
      .then((response) => {
        if (!response.ok) {
          // El backend de registro responde { payload } en los 400 de validación
          // (nombre, email, teléfono, contraseña y duplicados) y { error } en el
          // 500. Si el body no viene en JSON no queremos que el error de parseo
          // tape el motivo real del rechazo, así que toleramos el parseo.
          return response
            .json()
            .catch((parseErr) => {
              console.warn(
                "No se pudo leer el error del servidor:",
                parseErr
              );
              return {};
            })
            .then((errData) => {
              const errorMessage =
                errData.payload ||
                errData.error ||
                "Algo salió mal, contacte al administrador."; // Obtener el mensaje del backend
              throw new Error(errorMessage);
            });
        }
        return response.json();
      })
      .then(() => {
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
