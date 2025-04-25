// 
window.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('http://localhost:8080/api/sessions/current', {
        method: 'GET',
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error('Token inválido');
      }
  
      const data = await response.json();
      const nombreElemento = document.getElementById('nombre');
      nombreElemento.innerHTML = `<strong>${data.userJWT.name.toUpperCase()}!</strong>`;
      // Podés usar data.user para personalizar la vista
    } catch (err) {
      console.warn('No autenticado, redirigiendo...');
      window.location.href = '/pages/IniciarSesion.html';
    }
  });
  