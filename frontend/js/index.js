// -------------------- FUNCIONES PARA CARGAR KPIs --------------------
async function cargarKPIs() {
  try {
    console.log("Cargando KPIs del dashboard...");
    
    // Cargar contadores de cada entidad
    const [vehiculos, conductores, pasajeros] = await Promise.all([
      fetchAPI('vehiculos'),
      fetchAPI('conductores'),
      fetchAPI('pasajeros')
    ]);

    // Actualizar los valores en el DOM
    document.getElementById('vehiculosRegistrados').textContent = vehiculos.length;
    document.getElementById('conductoresRegistrados').textContent = conductores.length;
    document.getElementById('pasajerosRegistrados').textContent = pasajeros.length;

    console.log("KPIs actualizados:", {
      vehiculos: vehiculos.length,
      conductores: conductores.length,
      pasajeros: pasajeros.length
    });

  } catch (error) {
    console.error("Error al cargar KPIs:", error);
    // Mostrar valores de error en caso de fallo
    document.getElementById('vehiculosRegistrados').textContent = 'Error';
    document.getElementById('conductoresRegistrados').textContent = 'Error';
    document.getElementById('pasajerosRegistrados').textContent = 'Error';
  }
}



async function cargarVencimientos() {
  try {
    console.log("Cargando próximos vencimientos...");
    
    const [vehiculos, conductores] = await Promise.all([
      fetchAPI('vehiculos'),
      fetchAPI('conductores')
    ]);

    const vencimientosContainer = document.getElementById('vencimientosContainer');
    let alertasHTML = '';

    // Verificar vencimientos de RTO de vehículos
    vehiculos.forEach(vehiculo => {
      if (vehiculo.rto) {
        const diasRestantes = calcularDiasRestantes(vehiculo.rto);
        
        if (diasRestantes !== null) {
          let status = 'status-ok';
          let mensaje = `RTO del vehículo ${vehiculo.patente}`;
          
          if (diasRestantes < 0) {
            status = 'status-expired';
            mensaje += ` - Vencida hace ${Math.abs(diasRestantes)} días`;
          } else if (diasRestantes <= 30) {
            status = 'status-warning';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else if (diasRestantes <= 90) {
            status = 'status-ok';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else {
            return; // No mostrar si faltan más de 90 días
          }

          alertasHTML += `
            <div class="alert-item">
              <div class="alert-status ${status}"></div>
              <div class="alert-info">${mensaje}</div>
            </div>
          `;
        }
      }
    });

    // Verificar vencimientos de licencias de conductores
    conductores.forEach(conductor => {
      if (conductor.vencimientoLic) {
        const diasRestantes = calcularDiasRestantes(conductor.vencimientoLic);
        
        if (diasRestantes !== null) {
          let status = 'status-ok';
          let mensaje = `Licencia de ${conductor.nombreCompleto}`;
          
          if (diasRestantes < 0) {
            status = 'status-expired';
            mensaje += ` - Vencida hace ${Math.abs(diasRestantes)} días`;
          } else if (diasRestantes <= 30) {
            status = 'status-warning';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else if (diasRestantes <= 90) {
            status = 'status-ok';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else {
            return; // No mostrar si faltan más de 90 días
          }

          alertasHTML += `
            <div class="alert-item">
              <div class="alert-status ${status}"></div>
              <div class="alert-info">${mensaje}</div>
            </div>
          `;
        }
      }
    });

    if (alertasHTML === '') {
      alertasHTML = '<div class="alert-info">No hay vencimientos próximos</div>';
    }

    vencimientosContainer.innerHTML = alertasHTML;
    console.log("Vencimientos cargados correctamente");

  } catch (error) {
    console.error("Error al cargar vencimientos:", error);
    document.getElementById('vencimientosContainer').innerHTML = 
      '<div class="alert-info">Error al cargar vencimientos</div>';
  }
}


// -------------------- FUNCIÓN PARA MOSTRAR ÚLTIMA CONEXIÓN --------------------
function mostrarUltimaConexion() {
  const ultimaConexion = localStorage.getItem('ultimaConexion');
  const elementoUltimaConexion = document.getElementById('ultimaConexion');
  
  if (ultimaConexion && elementoUltimaConexion) {
    const fecha = new Date(ultimaConexion);
    elementoUltimaConexion.textContent = fecha.toLocaleString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (elementoUltimaConexion) {
    elementoUltimaConexion.textContent = 'Primera conexión';
  }

  // Actualizar la fecha de última conexión para la próxima vez
  localStorage.setItem('ultimaConexion', new Date().toISOString());
}

// -------------------- FUNCIÓN PARA REFRESCAR DATOS --------------------
async function refrescarDashboard() {
  console.log("Refrescando datos del dashboard...");
  
  try {
    await Promise.all([
      cargarKPIs(),
      cargarVencimientos(),
    ]);
    
    cargarActividadReciente();
    console.log("Dashboard refrescado correctamente");
  } catch (error) {
    console.error("Error al refrescar dashboard:", error);
  }
}

// -------------------- INICIALIZACIÓN --------------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log("Inicializando dashboard...");
  
  // Verificar acceso antes de cargar cualquier cosa
  verificarAcceso();
  
  // Configurar evento del botón cerrar sesión
  const btnCerrarSesion = document.getElementById('CerrarSesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', cerrarSesion);
    console.log("Botón de cerrar sesión configurado");
  }

  // Mostrar última conexión
  mostrarUltimaConexion();

  // Cargar todos los datos del dashboard
  await refrescarDashboard();

  // Configurar auto-refresh cada 5 minutos para mantener los datos actualizados
  setInterval(refrescarDashboard, 5 * 60 * 1000);

  console.log("Dashboard inicializado correctamente");
});