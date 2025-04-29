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
const spinner = document.getElementById("spinner"); // debajo del form = document.getElementById...

let intentosFallidos = parseInt(localStorage.getItem("intentosFallidos")) || 0;
let MAX_INTENTOS_FALLIDOS = 3; // Default max intentos fallidos hasta que cargue del backend
let BLOCK_TIME_MINUTES = 60; // Default tiempo de bloqueo entre intentos hasta que cargue del backend

// Fetchear config apenas carga la página
fetch("http://localhost:8080/api/config")
  .then((response) => response.json())
  .then((config) => {
    MAX_INTENTOS_FALLIDOS = config.maxLoginAttempts;
    BLOCK_TIME_MINUTES = config.blockTimeMinutes;
  })
  .catch((error) => {
    console.error("❌ Error cargando config del backend:", error);
  });

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
    spinner.style.display = "block";
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
        if (!response.ok) {
          return response.json().then((errData) => {
            throw { status: response.status, ...errData };
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("DATA EN THEN:", data);
        localStorage.removeItem("intentosFallidos");
        window.location.href = "IniciarDetener.html";
      })
      .catch((error) => {
        console.error("CATCH EJECUTADO:", error);
        const passwordErrorDiv = document.getElementById("passwordError");
        if (error.status === 401) {
          // Credenciales inválidas
          intentosFallidos++;
          localStorage.setItem("intentosFallidos", intentosFallidos); // 👉 Guarda en localStorage
          
          if (intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
            localStorage.removeItem("intentosFallidos"); // 👉 Reseteamos los intentos al bloquear
            const now = Date.now();
            const unblockTime = now + BLOCK_TIME_MINUTES * 60 * 1000; // tiempo futuro en ms
            localStorage.setItem("blockedUntil", unblockTime);
            const minutosRestantes = error.retryAfter || BLOCK_TIME_MINUTES; // por si no viene retryAfter
            // Redirigir a la página de error y pasar el mensaje como parámetro en la URL
            //passwordErrorDiv.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
            let messageErrorTime = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
            window.location.href = `errorIniciarSesion.html?error=${encodeURIComponent(
              messageErrorTime
            )}`;
          } else {
            passwordErrorDiv.textContent = `Credenciales inválidas. Intento ${intentosFallidos} de ${MAX_INTENTOS_FALLIDOS}.`;
          } 
        } else if (error.status === 429) {
          // Ratelimit excedido
          const now = Date.now();
          //const unblockTime = now + BLOCK_TIME_MINUTES * 60 * 1000; // tiempo futuro en ms
          //localStorage.setItem("blockedUntil", unblockTime);
          //const minutosRestantes = error.retryAfter || BLOCK_TIME_MINUTES; // por si no viene retryAfter
          // Redirigir a la página de error y pasar el mensaje como parámetro en la URL
          //passwordErrorDiv.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
          //let messageErrorTime = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutosRestantes} minutos.`;
          //window.location.href = `errorIniciarSesion.html?error=${encodeURIComponent(messageErrorTime)}`;
          window.location.href = "errorIniciarSesion.html"
        } else {
          // Otro error
          passwordErrorDiv.textContent =
            error.error || "Algo salió mal, intentalo nuevamente.";
        }
      })
      .finally(() => {
        spinner.style.display = "none";
      });
  }
});

// Olvidó su contraseña
document
  .getElementById("resetPasswordLink")
  .addEventListener("click", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();

    // Validar email antes de enviar
    if (!email) {
      document.getElementById("emailError").textContent =
        "Por favor, ingresa tu email para resetear la contraseña.";
      return;
    }
    if (!isValidEmail(email)) {
      document.getElementById("emailError").textContent =
        "Por favor, ingresa un email válido.";
      return;
    }

    // Enviar fetch POST a /api/sessions/passwordReset
    // spinner
    spinner.style.display = "block";
    // desabilita el boton despues de enviar la solicitud
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    fetch("http://localhost:8080/api/sessions/passwordReset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(
              err.error || "No se pudo iniciar el proceso de reseteo."
            );
          });
        }
        return response.json();
      })
      .then((data) => {
        alert(
          "Si el email está registrado, recibirás instrucciones para resetear tu contraseña."
        );
      })
      .catch((error) => {
        console.error("Error en reset de contraseña:", error);
        alert(error.message);
      })
      .finally(() => {
        spinner.style.display = "none"; //spinner
        submitBtn.disabled = false; // vuelve a habilitar el boton de send
      });
  });
