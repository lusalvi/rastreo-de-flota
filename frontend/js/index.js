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


function calcularDiasRestantes(fecha, tipo) {
  try {
    const hoy = new Date();
    let fechaVencimiento;

    if (tipo === 'RTO') {
      let fechaRealizacion;

      if (fecha.includes('/')) {
        // Formato: DD/MM/YYYY
        const partes = fecha.split('/');
        if (partes.length !== 3) return null;
        fechaRealizacion = new Date(partes[2], partes[1] - 1, partes[0]);
      } else if (fecha.includes('-')) {
        // Formato: YYYY-MM-DD
        const partes = fecha.split('-');
        if (partes.length !== 3) return null;
        fechaRealizacion = new Date(partes[0], partes[1] - 1, partes[2]);
      } else {
        return null; // Formato no reconocido
      }

      // Sumar 2 años a la fecha de realización para obtener el vencimiento
      fechaVencimiento = new Date(fechaRealizacion);
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 2);
    } else {
      // Para licencias
      fechaVencimiento = new Date(fecha);
    }

    const diferencia = fechaVencimiento - hoy;
    return Math.floor(diferencia / (1000 * 60 * 60 * 24)); // días restantes
  } catch (error) {
    console.error("Error al calcular días restantes:", error);
    return null;
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
        const diasRestantes = calcularDiasRestantes(vehiculo.rto, 'RTO');

        if (diasRestantes !== null) {
          let status = '';
          let mensaje = `RTO del vehículo ${vehiculo.patente}`;

          if (diasRestantes < 0) {
            status = 'status-expired';
            mensaje += ` - Vencida hace ${Math.abs(diasRestantes)} días`;
          } else if (diasRestantes <= 50) {
            status = 'status-warning';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else if (diasRestantes <= 200) {
            status = 'status-ok';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else {
            return; // no mostrar si faltan más de 200 días
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
          let status = '';
          let mensaje = `Licencia de ${conductor.nombreCompleto}`;

          if (diasRestantes < 0) {
            status = 'status-expired';
            mensaje += ` - Vencida hace ${Math.abs(diasRestantes)} días`;
          } else if (diasRestantes <= 30) {
            status = 'status-warning';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else if (diasRestantes <= 200) {
            status = 'status-ok';
            mensaje += ` - Vence en ${diasRestantes} días`;
          } else {
            return; // Ignorar si falta más de 200 días
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

// -------------------- FUNCIÓN PARA AGREGAR ACTIVIDADES RECIENTES  --------------------
async function cargarActividadReciente() {
  try {
    const [vehiculos, conductores, pasajeros] = await Promise.all([
      fetchAPI('vehiculos'),
      fetchAPI('conductores'),
      fetchAPI('pasajeros')
    ]);

    const actividades = [];

    const ahora = new Date();

    const calcularHaceCuanto = (fechaStr) => {
      const fecha = new Date(fechaStr);
      const diffMs = ahora - fecha;
      const minutos = Math.floor(diffMs / 60000);
      if (minutos < 1) return "Hace menos de 1 minuto";
      if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
      const horas = Math.floor(minutos / 60);
      if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`;
      const dias = Math.floor(horas / 24);
      return `Hace ${dias} día${dias !== 1 ? 's' : ''}`;
    };

    vehiculos.forEach(v => {
      if (v.created_at) {
        actividades.push({
          tipo: 'vehículo',
          mensaje: `Nuevo vehículo registrado`,
          fecha: v.created_at,
          status: 'status-new'
        });
      }
    });

    conductores.forEach(c => {
      if (c.created_at) {
        actividades.push({
          tipo: 'conductor',
          mensaje: `Nuevo conductor registrado`,
          fecha: c.created_at,
          status: 'status-new'
        });
      }
    });

    pasajeros.forEach(p => {
      if (p.created_at) {
        actividades.push({
          tipo: 'pasajero',
          mensaje: `Nuevo pasajero registrado`,
          fecha: p.created_at,
          status: 'status-new'
        });
      }
    });

    // Ordenar por fecha (más reciente primero)
    const actividadesLimitadas = actividades
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 7);

    const contenedor = document.getElementById('actividadContainer');

    if (actividadesLimitadas.length === 0) {
      contenedor.innerHTML = '<div class="alert-info">No hay actividad reciente</div>';
    } else {
      contenedor.innerHTML = actividadesLimitadas.map(act => `
    <div class="alert-item">
      <div class="alert-status ${act.status}"></div>
      <div class="alert-info">${act.mensaje} – ${calcularHaceCuanto(act.fecha)}</div>
    </div>
  `).join('');
    }


  } catch (error) {
    console.error("Error al cargar actividad reciente:", error);
    document.getElementById('actividadContainer').innerHTML =
      '<div class="alert-info">Error al cargar actividad reciente</div>';
  }
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

  // Mostrar última conexión
  mostrarUltimaConexion();

  // Cargar todos los datos del dashboard
  await refrescarDashboard();

  // Configurar auto-refresh cada 5 minutos para mantener los datos actualizados
  setInterval(refrescarDashboard, 5 * 60 * 1000);

  console.log("Dashboard inicializado correctamente");
});