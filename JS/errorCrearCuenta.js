// Lee el mensaje de error desde la query string (?error=...) y lo muestra en pantalla.
const urlParams = new URLSearchParams(window.location.search);
const errorMessage = urlParams.get("error");

// Mostrar el mensaje de error si esta presente.
// urlParams.get() ya devuelve el valor decodificado, no hay que decodificar de nuevo.
if (errorMessage) {
  document.getElementById("errorMessageDisplay").textContent = errorMessage;
}
