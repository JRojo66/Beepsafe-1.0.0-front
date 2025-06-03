const cerrarSesionBtn = document.getElementById('cerrarSesionBtn');

if (cerrarSesionBtn) {
  cerrarSesionBtn.addEventListener('click', function() {
    console.log('Botón de cerrar sesión clickeado'); 
    fetch(`${ROOT_URL}/api/sessions/logout`, {
      method: 'GET',
      // credentials: "include",                                            windows - android
      headers: {          
         "Authorization": `Bearer ${localStorage.getItem("token")}`        // iOS 
        }
    })
    .then(response => {
        console.log(response);
        console.log(response.ok);

      if (response.ok) {
        window.location.href = 'iniciarSesion.html';
      } else {
        console.error('Error al cerrar sesión');
        window.location.href = 'iniciarSesion.html';
      }
    })
    .catch(error => {
      console.error('Error de red al cerrar sesión:', error);
      window.location.href = 'iniciarSesion.html';
    });
  });
}
