const urlParams = new URLSearchParams(window.location.search);
const unblockTime = parseInt(urlParams.get("unblockTime"), 10);
const errorDisplay = document.getElementById("errorMessageDisplay");

if (unblockTime && Date.now() < unblockTime) {
  const tiempoRestante = unblockTime - Date.now();
  mostrarCuentaRegresiva(tiempoRestante);
}

function mostrarCuentaRegresiva(tiempoRestante) {
  const intervalo = setInterval(() => {
    const ahora = Date.now();
    const diferencia = unblockTime - ahora;

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
