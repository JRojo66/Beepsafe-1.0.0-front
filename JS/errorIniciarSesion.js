
const urlParams = new URLSearchParams(window.location.search);
const unblockTime = urlParams.get("unblockTime");
const retryAfter = urlParams.get("retryAfter")

if (unblockTime && Date.now() < unblockTime) {
  const tiempoRestante = unblockTime - Date.now();
  mostrarCuentaRegresiva(tiempoRestante);
}

// Obtener el mensaje de error de la URL
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
      unblockTime - ahora;

    if (diferencia <= 0) {
      clearInterval(intervalo);
      errorDisplay.textContent = "Ya puedes volver a intentar iniciar sesión.";
      return;
    }

    const minutos = Math.floor(diferencia / 60000);
    const segundos = Math.floor((diferencia % 60000) / 1000);

    errorDisplay.textContent = `Has excedido el número máximo de intentos. Podrás intentar nuevamente en ${minutos}m ${segundos}s.`;
  }, 1000);
}
