const blockedUntil = parseInt(localStorage.getItem("blockedUntil"));

if (blockedUntil && Date.now() < blockedUntil) {
  const tiempoRestante = blockedUntil - Date.now();
  mostrarCuentaRegresiva(tiempoRestante);
}

// Obtener el mensaje de error de la URL
const urlParams = new URLSearchParams(window.location.search);
const errorMessage = urlParams.get("error");
const errorDisplay = document.getElementById("errorMessageDisplay");

// Mostrar el mensaje de error si está presente
if (errorMessage) {
  errorDisplay.textContent = decodeURIComponent(errorMessage);
}

function mostrarCuentaRegresiva(tiempoRestante) {
 
  const intervalo = setInterval(() => {
    const ahora = Date.now();
    const diferencia =
      parseInt(localStorage.getItem("blockedUntil")) - ahora;

    if (diferencia <= 0) {
      clearInterval(intervalo);
      localStorage.removeItem("blockedUntil");
      localStorage.removeItem("intentosFallidos");
      errorDisplay.textContent = "Ya puedes volver a intentar iniciar sesión.";
      return;
    }

    const minutos = Math.floor(diferencia / 60000);
    const segundos = Math.floor((diferencia % 60000) / 1000);
    
    errorDisplay.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutos}m ${segundos}s.`;
  }, 1000);
}