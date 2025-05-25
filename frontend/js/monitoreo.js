
let map;
let conductoresActivos = new Map();
let markersMap = new Map();
let updateInterval;
let searchTimeout;

// Variables para manejo de rutas
let directionsService;
let directionsRenderer;
let routeMarkersMap = new Map(); // Para almacenar marcadores de rutas por conductor
let currentRouteShowing = null; // DNI del conductor cuya ruta se está mostrando

// Función para inicializar Google Maps
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -32.964494, lng: -68.706340 },
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        gestureHandling: 'greedy'
    });

    crearMarcadorEmpresa();

    // Inicializar servicios de direcciones
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#0d6efd',
            strokeWeight: 5,
            strokeOpacity: 0.7
        }
    });

    console.log('Mapa inicializado');
    inicializarMonitoreo();
}

// Actualizar la hora actual
function actualizarHora() {
    const ahora = new Date();
    const horaFormateada = ahora.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const elementoHora = document.getElementById('currentTime');
    if (elementoHora) {
        elementoHora.textContent = horaFormateada;
    }
}

// Obtener conductores activos desde la API
async function obtenerConductoresActivos() {
    try {
        const response = await fetch(`${API_URL}/conductores/activo`);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const conductores = await response.json();
        const ahora = new Date();

        const activos = conductores.filter(conductor => {
            const lat = parseFloat(conductor.latitud);
            const lng = parseFloat(conductor.longitud);
            const ultima = new Date(conductor.ultimaActualizacion);
            const diferenciaMin = (ahora - ultima) / 1000;

            return (
                conductor.activo === true &&
                conductor.compartiendo === true &&
                !isNaN(lat) &&
                !isNaN(lng) &&
                diferenciaMin <= 15
            );
        });

        console.log(`Conductores activos: ${activos.length}`);
        return activos;
    } catch (error) {
        console.error('Error obteniendo conductores:', error);
        return [];
    }
}

// Obtener pasajeros asignados a un vehículo
async function obtenerPasajerosPorVehiculo(patente) {
    try {
        const response = await fetch(`${API_URL}/pasajeros`);
        if (!response.ok) {
            throw new Error('Error al obtener pasajeros');
        }

        const pasajeros = await response.json();

        // Filtrar pasajeros por la patente del vehículo
        const pasajerosFiltrados = pasajeros.filter(p => {
            const patenteAsig = typeof p.vehiculoasignado === 'object'
                ? p.vehiculoasignado?.patente?.trim()
                : p.vehiculoasignado?.trim();
            return patenteAsig === patente;
        });

        // Geocodificar direcciones de pasajeros que no tienen coordenadas
        const pasajerosConCoordenadas = await Promise.all(
            pasajerosFiltrados.map(async (pasajero) => {
                if (!pasajero.latitud || !pasajero.longitud) {
                    try {
                        const geocoder = new google.maps.Geocoder();
                        const direccionCompleta = `${pasajero.domicilio}, ${pasajero.codigoPostal}, Mendoza, Argentina`;

                        return new Promise((resolve) => {
                            geocoder.geocode({ address: direccionCompleta }, (results, status) => {
                                if (status === "OK" && results[0]) {
                                    const coords = results[0].geometry.location;
                                    pasajero.latitud = coords.lat();
                                    pasajero.longitud = coords.lng();
                                }
                                resolve(pasajero);
                            });
                        });
                    } catch (error) {
                        console.error("Error geocodificando pasajero:", error);
                        return pasajero;
                    }
                }
                return pasajero;
            })
        );

        return pasajerosConCoordenadas.filter(p => p.latitud && p.longitud);
    } catch (error) {
        console.error('Error obteniendo pasajeros:', error);
        return [];
    }
}

// Función para crear el marcador fijo de la empresa
function crearMarcadorEmpresa() {
    // Coordenadas de la empresa GeoBuild S.A.
    const empresaPosition = { lat: -32.962028, lng: -68.718583 };

    // Crear el marcador de la empresa
    const empresaMarker = new google.maps.Marker({
        position: empresaPosition,
        map: map,
        title: 'GeoBuild S.A. - Sede Principal',
        icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 12,
            fillColor: '#DC3545', // Rojo corporativo
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#FFFFFF'
        },
        zIndex: 1000 // Para que esté siempre visible encima de otros marcadores
    });

    // Crear InfoWindow para la empresa
    const empresaInfoWindow = new google.maps.InfoWindow({
        content: `
      <div style="padding: 12px; max-width: 280px; text-align: center;">
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
          <img src="../img/iconoSF.png" alt="Logo GeoBuild" style="width: 40px; height: 40px; margin-right: 10px;">
          <h5 style="margin: 0; color: #DC3545; font-weight: bold;">GeoBuild S.A.</h5>
        </div>
        <hr style="margin: 8px 0; border-color: #DC3545;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>🏢 Sede Principal</strong></p>
        <div style="margin-top: 10px; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #DC3545;">
          <p style="margin: 0; font-size: 12px; color: #666;">
            <strong>Destino final</strong> de todas las rutas de transporte
          </p>
        </div>
      </div>
    `,
        pixelOffset: new google.maps.Size(0, -10)
    });

    // Event listener para mostrar InfoWindow al hacer clic
    empresaMarker.addListener('click', () => {
        // Cerrar otros InfoWindows abiertos (opcional)
        // Puedes comentar estas líneas si quieres que se mantengan abiertos múltiples InfoWindows
        markersMap.forEach((marker) => {
            if (marker.infoWindow && marker.infoWindow.close) {
                marker.infoWindow.close();
            }
        });

        // Abrir InfoWindow de la empresa
        empresaInfoWindow.open(map, empresaMarker);

        // Centrar un poco el mapa en la empresa (opcional)
        map.panTo(empresaPosition);
    });

    // Event listener para hover (opcional - mostrar tooltip)
    empresaMarker.addListener('mouseover', () => {
        empresaMarker.setTitle('🏢 GeoBuild S.A. - Haz clic para más información');
    });

    empresaMarker.addListener('mouseout', () => {
        empresaMarker.setTitle('GeoBuild S.A. - Sede Principal');
    });

    // Guardar referencia del marcador para uso posterior
    window.empresaMarker = empresaMarker;
    window.empresaInfoWindow = empresaInfoWindow;

    console.log('Marcador de empresa creado en:', empresaPosition);

    return empresaMarker;
}



// Mostrar ruta del conductor
async function mostrarRutaConductor(conductor) {
    try {
        // Limpiar ruta anterior si existe
        limpiarRutas();

        const vehiculo = typeof conductor.vehiculo === 'object'
            ? conductor.vehiculo?.patente
            : conductor.vehiculo;

        if (!vehiculo) {
            console.log('Conductor sin vehículo asignado');
            return;
        }

        // Obtener pasajeros asignados al vehículo
        const pasajeros = await obtenerPasajerosPorVehiculo(vehiculo);

        if (pasajeros.length === 0) {
            console.log('No hay pasajeros asignados a este vehículo');
            return;
        }

        // Posición actual del conductor
        const origenConductor = {
            lat: parseFloat(conductor.latitud),
            lng: parseFloat(conductor.longitud)
        };

        // Destino (empresa)
        const destino = { lat: -32.962028, lng: -68.718583 };

        // Crear waypoints para los pasajeros
        const waypoints = pasajeros
            .filter(p => p.latitud && p.longitud && !isNaN(p.latitud) && !isNaN(p.longitud))
            .map(p => ({
                location: { lat: parseFloat(p.latitud), lng: parseFloat(p.longitud) },
                stopover: true
            }));

        // Crear marcadores para las paradas
        const routeMarkers = [];

        // Marcador de destino
        const destinoMarker = new google.maps.Marker({
            position: destino,
            map: map,
            title: 'Destino: GeoBuild S.A.',
            icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 8,
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF'
            }
        });
        routeMarkers.push(destinoMarker);

        // Marcadores para cada pasajero
        waypoints.forEach((waypoint, index) => {
            const pasajero = pasajeros[index];
            const marker = new google.maps.Marker({
                position: waypoint.location,
                map: map,
                label: {
                    text: (index + 1).toString(),
                    color: 'white'
                },
                title: `Parada ${index + 1}: ${pasajero.nombreCompleto}`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: '#FFA500',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#FFFFFF'
                }
            });

            // InfoWindow para el pasajero
            const infoWindow = new google.maps.InfoWindow({
                content: `
              <div style="padding: 8px; max-width: 200px;">
                <h6 style="margin: 0 0 8px 0;">Parada ${index + 1}</h6>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Pasajero:</strong> ${pasajero.nombreCompleto}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Dirección:</strong> ${pasajero.domicilio}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>Código Postal:</strong> ${pasajero.codigoPostal}</p>
              </div>
            `
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            routeMarkers.push(marker);
        });

        // Guardar los marcadores de la ruta
        routeMarkersMap.set(conductor.dni, routeMarkers);

        // Crear la solicitud de ruta
        const request = {
            origin: origenConductor,
            destination: destino,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: true
        };

        // Obtener y mostrar la ruta
        directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);

                // Actualizar el marcador del conductor con información de ruta
                const marker = markersMap.get(conductor.dni);
                if (marker && marker.infoWindow) {
                    const ruta = result.routes[0];
                    let distanciaTotal = 0;
                    let tiempoTotal = 0;

                    ruta.legs.forEach(leg => {
                        distanciaTotal += leg.distance.value;
                        tiempoTotal += leg.duration.value;
                    });

                    const distanciaKm = (distanciaTotal / 1000).toFixed(1);
                    const tiempoHoras = Math.floor(tiempoTotal / 3600);
                    const tiempoMinutos = Math.floor((tiempoTotal % 3600) / 60);

                    const ultimaActualizacion = conductor.ultimaActualizacion
                        ? new Date(conductor.ultimaActualizacion).toLocaleString('es-AR')
                        : 'No disponible';

                    marker.infoWindow.setContent(`
                <div style="padding: 8px; max-width: 300px;">
                  <h6 style="margin: 0 0 8px 0;">${conductor.nombreCompleto}</h6>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>DNI:</strong> ${conductor.dni}</p>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>Vehículo:</strong> ${vehiculo}</p>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>Actualizado:</strong> ${ultimaActualizacion}</p>
                  <hr style="margin: 8px 0;">
                  <h6 style="margin: 0 0 4px 0; color: #0d6efd;">Ruta Asignada</h6>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>Paradas:</strong> ${pasajeros.length}</p>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>Distancia:</strong> ${distanciaKm} km</p>
                  <p style="margin: 2px 0; font-size: 13px;"><strong>Tiempo estimado:</strong> ${tiempoHoras > 0 ? tiempoHoras + ' h ' : ''}${tiempoMinutos} min</p>
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: green;">🟢 En línea</p>
                </div>
              `);
                }

                currentRouteShowing = conductor.dni;
                document.getElementById('clearRoutes').style.display = 'inline-block';

                console.log(`Ruta mostrada para conductor ${conductor.nombreCompleto}`);
            } else {
                console.error('Error al obtener ruta:', status);
            }
        });

    } catch (error) {
        console.error('Error mostrando ruta del conductor:', error);
    }
}

// Limpiar rutas del mapa
function limpiarRutas() {
    console.log('Limpiando rutas...');
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections({ routes: [] });
    }

    // Limpiar marcadores de rutas
    routeMarkersMap.forEach((markers, dni) => {
        markers.forEach(marker => marker.setMap(null));
    });
    routeMarkersMap.clear();

    currentRouteShowing = null;
    document.getElementById('clearRoutes').style.display = 'none';

    console.log('Rutas limpiadas');
}

// Crear o actualizar marcador en el mapa
function actualizarMarcadorConductor(conductor) {
    const lat = parseFloat(conductor.latitud);
    const lng = parseFloat(conductor.longitud);

    if (isNaN(lat) || isNaN(lng)) {
        return;
    }

    const position = { lat, lng };
    const conductorId = conductor.dni;

    const vehiculo = typeof conductor.vehiculo === 'object'
        ? conductor.vehiculo?.patente || 'Sin vehículo'
        : conductor.vehiculo || 'Sin vehículo';

    const ultimaActualizacion = conductor.ultimaActualizacion
        ? new Date(conductor.ultimaActualizacion).toLocaleString('es-AR')
        : 'No disponible';

    if (markersMap.has(conductorId)) {
        // Actualizar marcador existente
        const marker = markersMap.get(conductorId);
        marker.setPosition(position);

        // Actualizar InfoWindow
        const infoWindow = new google.maps.InfoWindow({
            content: `
            <div style="padding: 8px; max-width: 250px;">
              <h6 style="margin: 0 0 8px 0;">${conductor.nombreCompleto}</h6>
              <p style="margin: 2px 0; font-size: 13px;"><strong>DNI:</strong> ${conductor.dni}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Vehículo:</strong> ${vehiculo}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Actualizado:</strong> ${ultimaActualizacion}</p>
              <p style="margin: 6px 0 4px 0; font-size: 12px; color: green;">🟢 En línea</p>
              <button onclick="mostrarRutaConductor(${JSON.stringify(conductor).replace(/"/g, '&quot;')})" 
                      style="background: #0d6efd; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                Ver ruta asignada
              </button>
            </div>
          `
        });

        google.maps.event.clearListeners(marker, 'click');
        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });

        marker.infoWindow = infoWindow;
    } else {
        // Crear nuevo marcador
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: `${conductor.nombreCompleto} - ${vehiculo}`,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#4285F4",
                fillOpacity: 0.9,
                strokeWeight: 3,
                strokeColor: "#FFFFFF"
            }
        });

        const infoWindow = new google.maps.InfoWindow({
            content: `
            <div style="padding: 8px; max-width: 250px;">
              <h6 style="margin: 0 0 8px 0;">${conductor.nombreCompleto}</h6>
              <p style="margin: 2px 0; font-size: 13px;"><strong>DNI:</strong> ${conductor.dni}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Vehículo:</strong> ${vehiculo}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>Actualizado:</strong> ${ultimaActualizacion}</p>
              <p style="margin: 6px 0 4px 0; font-size: 12px; color: green;">🟢 En línea</p>
              <button onclick="mostrarRutaConductor(${JSON.stringify(conductor).replace(/"/g, '&quot;')})" 
                      style="background: #0d6efd; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                Ver ruta asignada
              </button>
            </div>
          `
        });

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });

        marker.infoWindow = infoWindow;
        markersMap.set(conductorId, marker);
    }
}

// Remover marcadores inactivos
function limpiarMarcadoresInactivos(conductoresActivosIds) {
    markersMap.forEach((marker, conductorId) => {
        if (!conductoresActivosIds.includes(conductorId)) {
            marker.setMap(null);
            markersMap.delete(conductorId);

            // Si se está mostrando la ruta de este conductor, limpiarla
            if (currentRouteShowing === conductorId) {
                limpiarRutas();
            }

            const nombre = marker.getTitle()?.split(' - ')[0] || 'Conductor';
            mostrarNotificacionDesconexion(`${nombre} se ha desconectado por inactividad`);
        }
    });
}

// Actualizar lista de conductores
function actualizarListaConductores(conductores) {
    const conductorList = document.getElementById('conductorList');
    if (!conductorList) return;

    if (conductores.length === 0) {
        conductorList.innerHTML = `
          <div style="padding: 10px; text-align: center; color: #666;">
            No hay conductores activos
          </div>
        `;
        return;
    }

    let listHTML = '';
    conductores.forEach(conductor => {
        const vehiculo = typeof conductor.vehiculo === 'object'
            ? conductor.vehiculo?.patente || 'Sin vehículo'
            : conductor.vehiculo || 'Sin vehículo';

        const ultimaActualizacion = conductor.ultimaActualizacion
            ? new Date(conductor.ultimaActualizacion).toLocaleString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
            })
            : '--:--';

        listHTML += `
          <div class="conductor-item" style="padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 6px; cursor: pointer; border: 1px solid #dee2e6;" 
               onclick="centrarEnConductor('${conductor.dni}')">
            <div style="font-weight: bold; margin-bottom: 4px;">${conductor.nombreCompleto}</div>
            <div style="font-size: 12px; color: #6c757d;">
              DNI: ${conductor.dni}<br>
              Vehículo: ${vehiculo}<br>
              Actualizado: ${ultimaActualizacion}
            </div>
            <div style="float: right; margin-top: -40px;">🟢</div>
            <button onclick="event.stopPropagation(); mostrarRutaConductor(${JSON.stringify(conductor).replace(/"/g, '&quot;')})" 
                    style="background: #0d6efd; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-top: 4px;">
              Ver ruta
            </button>
          </div>
        `;
    });

    conductorList.innerHTML = listHTML;
}

function mostrarNotificacionDesconexion(mensaje) {
    const notificacion = document.getElementById('notificacionDesconexion');
    if (!notificacion) return;

    notificacion.textContent = `🔴 ${mensaje}`;
    notificacion.style.display = 'block';

    setTimeout(() => {
        notificacion.style.display = 'none';
    }, 4000);
}

// Centrar mapa en conductor
function centrarEnConductor(dni) {
    const marker = markersMap.get(dni);
    if (marker) {
        map.setCenter(marker.getPosition());
        map.setZoom(16);

        if (marker.infoWindow) {
            marker.infoWindow.open(map, marker);
        }

        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 2000);
    }
}

// Función principal de actualización
async function actualizarMonitoreo() {
    try {
        console.log('Actualizando monitoreo...');

        const conductores = await obtenerConductoresActivos();

        // Actualizar contador
        const conductorCount = document.getElementById('conductorCount');
        if (conductorCount) {
            conductorCount.textContent = conductores.length;
        }

        // Actualizar marcadores
        const conductoresIds = [];
        conductores.forEach(conductor => {
            actualizarMarcadorConductor(conductor);
            conductoresIds.push(conductor.dni);
        });

        // Limpiar marcadores inactivos
        limpiarMarcadoresInactivos(conductoresIds);

        // Actualizar lista
        actualizarListaConductores(conductores);

        console.log(`Monitoreo actualizado: ${conductores.length} conductores`);

    } catch (error) {
        console.error('Error actualizando monitoreo:', error);
        const conductorCount = document.getElementById('conductorCount');
        if (conductorCount) {
            conductorCount.textContent = '0';
        }
    }
}

// Función de búsqueda
function buscarConductores() {
    const searchInput = document.getElementById('searchConductor');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    const conductorItems = document.querySelectorAll('.conductor-item');

    conductorItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Centrar mapa en Mendoza
function centrarMapa() {
    map.setCenter({ lat: -32.964494, lng: -68.706340 });
    map.setZoom(13);
}

// Inicializar monitoreo
function inicializarMonitoreo() {
    console.log('Inicializando monitoreo...');

    // Actualizar hora
    actualizarHora();
    setInterval(actualizarHora, 1000);

    // Primera actualización
    actualizarMonitoreo();

    // Actualización automática cada 10 segundos
    updateInterval = setInterval(actualizarMonitoreo, 10000);

    // Event listeners
    const refreshData = document.getElementById('refreshData');
    if (refreshData) {
        refreshData.addEventListener('click', actualizarMonitoreo);
    }

    const centerMap = document.getElementById('centerMap');
    if (centerMap) {
        centerMap.addEventListener('click', centrarMapa);
    }

    const clearRoutes = document.getElementById('clearRoutes');
    if (clearRoutes) {
        clearRoutes.addEventListener('click', limpiarRutas);
    }

    document.getElementById('refreshData')?.addEventListener('click', function (e) {
        e.preventDefault();
        actualizarMonitoreo();

        // Feedback visual al usuario
        const icon = this.querySelector('svg');
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s ease';

        setTimeout(() => {
            icon.style.transform = 'rotate(0deg)';
        }, 500);
    });

    const searchConductor = document.getElementById('searchConductor');
    if (searchConductor) {
        searchConductor.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(buscarConductores, 300);
        });
    }

    console.log('Monitoreo inicializado');
}

// Hacer funciones globales
window.centrarEnConductor = centrarEnConductor;
window.initMap = initMap;

// Cargar Google Maps
function cargarGoogleMaps() {
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyArifzqYFkv6deJgQqMAsB2Www-2NnpNVg&callback=initMap';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarGoogleMaps);
} else {
    cargarGoogleMaps();
}

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
