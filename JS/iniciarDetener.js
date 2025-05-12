window.addEventListener('DOMContentLoaded', async () => {
  try {
      const response = await fetch(`${ROOT_URL}/api/sessions/current`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Token inválido');
      }
  console.log("xxx");
      const data = await response.json();
      const nombreElemento = document.getElementById('nombre');
      nombreElemento.innerHTML = `<strong>${data.userJWT.name.toUpperCase()}!</strong>`;
    } catch (err) {
      console.warn('No autenticado, redirigiendo...');
      //window.location.href = 'iniciarSesion.html';
    }
  });
  