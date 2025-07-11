const API_URL = 'https://sistema-de-rastreo-de-flotas.onrender.com/api';

let map, directionsService, directionsRenderer;
let markerConductor;
let watchId;
let deferredPrompt;
let updateInterval;
let currentPositionCoords = null;
let recorridoPolyline = null;  // Nueva variable para el recorrido real
let recorridoCoordinates = []; // Nueva variable para almacenar las coordenadas del recorrido real
let modoNavegacionActiva = true;


// Registrar el service worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration.scope);
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });
    });
}

// Evento para instalar la aplicación como PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstalar = document.getElementById('instalarApp');
    btnInstalar.style.display = 'block';

    btnInstalar.addEventListener('click', () => {
        btnInstalar.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Usuario aceptó instalar la app');
            } else {
                console.log('Usuario rechazó instalar la app');
            }
            deferredPrompt = null;
        });
    });
});

// Obtener el DNI de la URL
const dni = new URLSearchParams(window.location.search).get('dni');
if (!dni) {
    document.getElementById('estado').classList.replace('alert-info', 'alert-danger');
    document.getElementById('estado').textContent = 'Acceso inválido: falta el DNI en la URL.';
    throw new Error("Falta DNI en la URL");
}

// Inicializar el mapa de Google Maps
function initMap() {
    directionsService = new google.maps.DirectionsService();
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -32.8894587, lng: -68.8458386 },
        zoom: 13,
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: false,
        gestureHandling: 'greedy'
    });

    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#0d6efd',
            strokeWeight: 5,
            strokeOpacity: 0.7
        }
    });

    directionsRenderer.setPanel(document.getElementById('indicaciones'));

    // Inicializar la polilínea para el recorrido real
    recorridoPolyline = new google.maps.Polyline({
        map: map,
        strokeColor: '#888888',
        strokeWeight: 5,
        strokeOpacity: 0.8
    });
}

// Obtener datos del conductor desde la API
async function obtenerConductor(dni) {
    try {
        document.getElementById('estado').textContent = 'Obteniendo información del conductor...';

        const res = await fetch(`${API_URL}/conductores/${dni}`);
        if (!res.ok) {
            throw new Error('Conductor no encontrado');
        }
        const conductor = await res.json();

        // Marcar al conductor como activo y compartiendo ubicación
        await fetch(`${API_URL}/conductores/${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...conductor,
                activo: true,
                compartiendo: true
            })
        });

        // Actualizar la interfaz con los datos del conductor
        const infoConductor = document.getElementById('infoConductor');
        infoConductor.innerHTML = `
            <h5>Conductor: ${conductor.nombreCompleto}</h5>
            <p><strong>DNI:</strong> ${conductor.dni}</p>
            <p><strong>Vehículo asignado:</strong> ${typeof conductor.vehiculo === 'object'
                ? conductor.vehiculo?.patente
                : conductor.vehiculo || 'No asignado'
            }</p>
        `;

        return conductor;
    } catch (error) {
        document.getElementById('estado').classList.replace('alert-info', 'alert-danger');
        document.getElementById('estado').textContent = 'Error: ' + error.message;
        throw error;
    }
}

// Obtener los pasajeros asignados al vehículo
async function obtenerPasajeros(patente) {
    try {
        document.getElementById('estado').textContent = 'Buscando pasajeros asignados...';

        const res = await fetch(`${API_URL}/pasajeros`);
        if (!res.ok) {
            throw new Error('Error al obtener pasajeros');
        }

        const pasajeros = await res.json();

        // Filtrar pasajeros por la patente del vehículo
        const pasajerosFiltrados = pasajeros.filter(p => {
            const patenteAsig = typeof p.vehiculoasignado === 'object'
                ? p.vehiculoasignado?.patente?.trim()
                : p.vehiculoasignado?.trim();
            return patenteAsig === patente;
        });

        // Obtener coordenadas para cada pasajero mediante geocodificación
        const pasajerosConCoordenadas = await Promise.all(
            pasajerosFiltrados.map(async (pasajero) => {
                try {
                    if (!pasajero.latitud || !pasajero.longitud) {
                        // Si no tiene coordenadas, intentar geocodificar
                        const geocoder = new google.maps.Geocoder();
                        const direccionCompleta = `${pasajero.domicilio}, ${pasajero.codigoPostal}, Mendoza, Argentina`;

                        return new Promise((resolve) => {
                            geocoder.geocode({ address: direccionCompleta }, (results, status) => {
                                if (status === "OK" && results[0]) {
                                    const coords = results[0].geometry.location;
                                    pasajero.latitud = coords.lat();
                                    pasajero.longitud = coords.lng();
                                    resolve(pasajero);
                                } else {
                                    // Si falla la geocodificación, mantenemos el pasajero sin coordenadas
                                    console.warn(`No se pudo geocodificar: ${direccionCompleta}`);
                                    resolve(pasajero);
                                }
                            });
                        });
                    }
                    return pasajero;
                } catch (error) {
                    console.error("Error geocodificando pasajero:", error);
                    return pasajero;
                }
            })
        );

        const rutaInfo = document.getElementById('rutaInfo');
        if (pasajerosFiltrados.length > 0) {
            let pasajerosHTML = '<h6>Pasajeros a recoger:</h6><ul class="list-group">';
            pasajerosConCoordenadas.forEach(p => {
                pasajerosHTML += `<li class="list-group-item">${p.nombreCompleto} - ${p.domicilio}</li>`;
            });
            pasajerosHTML += '</ul>';
            rutaInfo.innerHTML = pasajerosHTML;
        } else {
            rutaInfo.innerHTML = '<div class="alert alert-warning">No hay pasajeros asignados a este vehículo.</div>';
        }

        return pasajerosConCoordenadas;
    } catch (error) {
        console.error("Error al obtener pasajeros:", error);
        document.getElementById('rutaInfo').innerHTML = '<div class="alert alert-danger">Error al obtener pasajeros: ' + error.message + '</div>';
        return [];
    }
}

// Trazar la ruta en el mapa
function trazarRuta(origen, paradas, destino) {
    // Primero, limpiamos cualquier ruta anterior
    directionsRenderer.setMap(null);
    directionsRenderer.setMap(map);

    // Convertir las paradas a waypoints para la API de Google Maps
    const waypoints = paradas
        .filter(p => p.latitud && p.longitud && !isNaN(p.latitud) && !isNaN(p.longitud))
        .map(p => ({
            location: { lat: parseFloat(p.latitud), lng: parseFloat(p.longitud) },
            stopover: true
        }));

    // Crear la solicitud de ruta
    const request = {
        origin: origen,
        destination: destino,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true // Optimizar el orden de las paradas
    };

    // Marcador de origen (conductor)
    new google.maps.Marker({
        position: origen,
        map: map,
        title: 'Tu ubicación'
    });

    // Marcador de destino
    new google.maps.Marker({
        position: destino,
        map: map,
        title: 'Destino: GeoBuild S.A.'
    });

    // Marcadores para cada parada (pasajeros)
    waypoints.forEach((waypoint, index) => {
        new google.maps.Marker({
            position: waypoint.location,
            map: map,
            label: {
                text: (index + 1).toString(),
                color: 'white'
            },
            title: `Parada ${index + 1}: ${paradas[index].nombreCompleto}`
        });
    });

    // Obtener la ruta con el servicio de direcciones
    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            // Mostrar la ruta en el mapa
            directionsRenderer.setDirections(result);

            // Actualizar la información de la ruta
            const ruta = result.routes[0];
            let distanciaTotal = 0;
            let tiempoTotal = 0;

            ruta.legs.forEach(leg => {
                distanciaTotal += leg.distance.value;
                tiempoTotal += leg.duration.value;
            });

            // Convertir a formato legible
            const distanciaKm = (distanciaTotal / 1000).toFixed(1);
            const tiempoHoras = Math.floor(tiempoTotal / 3600);
            const tiempoMinutos = Math.floor((tiempoTotal % 3600) / 60);

            const rutaInfo = document.getElementById('rutaInfo');
            rutaInfo.innerHTML += `
                <div class="mt-3 card">
                    <div class="card-body">
                        <h6 class="card-title">Detalles de la ruta:</h6>
                        <p class="card-text"><strong>Distancia total:</strong> ${distanciaKm} km</p>
                        <p class="card-text"><strong>Tiempo estimado:</strong> ${tiempoHoras > 0 ? tiempoHoras + ' h ' : ''}${tiempoMinutos} min</p>
                        <p class="card-text small text-muted">Ruta optimizada para minimizar tiempo de viaje</p>
                    </div>
                </div>
            `;

            document.getElementById('estado').classList.replace('alert-info', 'alert-success');
            document.getElementById('estado').textContent = 'Ruta trazada correctamente. Siguiendo tu ubicación.';
        } else {
            document.getElementById('estado').classList.replace('alert-info', 'alert-danger');
            document.getElementById('estado').textContent = 'Error al trazar la ruta: ' + status;
            console.error('Error al trazar ruta:', status);
        }
    });
}

// Actualizar la ubicación del conductor
function actualizarUbicacion(posicion) {
    const lat = posicion.coords.latitude;
    const lng = posicion.coords.longitude;

    // Si hay error de precisión significativo, intentar mejorar usando watchPosition con alta precisión
    if (posicion.coords.accuracy > 30) { // Si la precisión es peor que 30 metros
        console.log("Precisión insuficiente:", posicion.coords.accuracy, "metros. Intentando mejorar...");
        document.getElementById('estado').textContent = `Mejorando precisión de ubicación (${Math.round(posicion.coords.accuracy)}m)...`;

        // Si ya estamos siguiendo con alta precisión, no hacer nada más
        if (!window.highAccuracyWatchActive) {
            // Detener seguimiento normal y activar seguimiento de alta precisión
            if (watchId) navigator.geolocation.clearWatch(watchId);

            watchId = navigator.geolocation.watchPosition(
                actualizarUbicacion,
                (error) => console.error('Error de geolocalización:', error),
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );

            window.highAccuracyWatchActive = true;
        }

        // Si la precisión es muy mala, no actualizar la posición
        /*  if (posicion.coords.accuracy > 100) {
             console.log("Precisión demasiado mala para actualizar posición:", posicion.coords.accuracy);
             return;
         } */
    }

    // Continuar con la actualización si la precisión es aceptable
    currentPositionCoords = { lat, lng };

    if (modoNavegacionActiva) {
        map.panTo({ lat, lng }); // Seguir al conductor
    }

    // Agregar punto al recorrido real
    recorridoCoordinates.push(currentPositionCoords);

    // Actualizar la polilínea del recorrido real
    recorridoPolyline.setPath(recorridoCoordinates);

    // Si ya existe un marcador, actualizar su posición
    if (markerConductor) {
        markerConductor.setPosition({ lat, lng });
    } else {
        // Crear un nuevo marcador para el conductor
        markerConductor = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: 'Tu ubicación actual',
            zIndex: 999,
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
                rotation: 0 // fijo, sin rotación
            }
        });

    }

    // Centrar el mapa en la posición actual si es la primera vez
    if (!map.get('initializedWithPosition')) {
        map.setCenter({ lat, lng });
        map.set('initializedWithPosition', true);
    }

    // Geocodificar la posición actual para mostrar la calle
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
            document.getElementById('estado').classList.replace('alert-warning', 'alert-success');
            document.getElementById('estado').textContent = `En ruta: ${results[0].formatted_address}`;
        }
    });

    // Enviar la ubicación al backend
    const dni = new URLSearchParams(window.location.search).get('dni');
    const timestamp = new Date().toISOString();

    fetch(`${API_URL}/ubicacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dni,
            latitud: lat,
            longitud: lng,
            timestamp
        })
    })
        .then(res => {
            if (!res.ok) throw new Error(`Error al guardar ubicación: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log(`✅ Ubicación enviada correctamente: ${lat}, ${lng}`);
        })
        .catch(error => {
            console.error('❌ Error enviando ubicación:', error);
        });

}

//PROBAR
async function enviarUbicacion(latitud, longitud) {
    try {
        const timestamp = new Date().toISOString();

        // Enviar ubicación como nuevo registro
        await fetch(`${API_URL}/ubicacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dni: dni,
                latitud: latitud,
                longitud: longitud,
                timestamp: timestamp
            })
        });

    } catch (err) {
        console.error('Error enviando ubicación:', err);
    }
}

// Detener seguimiento de ubicación
function detenerSeguimiento() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    // Marcar conductor como no compartiendo ubicación
    fetch(`${API_URL}/conductores/${dni}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            compartiendo: false,
            activo: false
        })
    }).catch(err => console.error('Error al detener seguimiento:', err));
}

// Función principal
async function main() {
    try {
        // Cargar el mapa
        initMap();

        document.getElementById('estado').textContent = 'Cargando datos...';

        // Obtener datos del conductor
        const conductor = await obtenerConductor(dni);

        // Verificar si tiene vehículo asignado
        if (!conductor.vehiculo) {
            document.getElementById('estado').classList.replace('alert-info', 'alert-warning');
            document.getElementById('estado').textContent = 'No tenés vehículo asignado. Contactá a administración.';
            return;
        }

        // Obtener la patente del vehículo
        const patente = typeof conductor.vehiculo === 'object' ?
            conductor.vehiculo?.patente?.trim() :
            conductor.vehiculo?.trim();

        // Obtener pasajeros asignados al vehículo
        const pasajeros = await obtenerPasajeros(patente);

        // Solicitar acceso a la ubicación
        document.getElementById('estado').textContent = 'Solicitando acceso a tu ubicación...';

        navigator.geolocation.getCurrentPosition(
            async (posicion) => {
                const origen = {
                    lat: posicion.coords.latitude,
                    lng: posicion.coords.longitude
                };

                currentPositionCoords = origen;

                // Agregar el punto inicial al recorrido
                recorridoCoordinates.push(origen);

                // Destino (ubicación de la empresa)
                const destino = { lat: -32.962028, lng: -68.718583 }; // El ITU como destino

                // Crear marcador para el conductor
                markerConductor = new google.maps.Marker({
                    position: origen,
                    map: map,
                    title: 'Tu ubicación',
                    zIndex: 999,
                    icon: {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: '#FFFFFF',
                        rotation: 0
                    }
                });



                // Si hay pasajeros, trazar la ruta con paradas
                // Si no, trazar ruta directa a la empresa
                trazarRuta(origen, pasajeros, destino);

                // Iniciar seguimiento de ubicación en tiempo real con alta precisión
                watchId = navigator.geolocation.watchPosition(
                    actualizarUbicacion,
                    (error) => {
                        document.getElementById('estado').classList.replace('alert-success', 'alert-warning');
                        document.getElementById('estado').textContent = 'Error al seguir la ubicación: ' + error.message;
                        console.error('Error al seguir ubicación:', error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );

                window.highAccuracyWatchActive = true;

                // Actualizar la ubicación periódicamente (cada 15 segundos) incluso si no cambia
                updateInterval = setInterval(() => {
                    if (currentPositionCoords) {
                        enviarUbicacion(currentPositionCoords.lat, currentPositionCoords.lng);
                    }
                }, 15000);
            },
            (error) => {
                document.getElementById('estado').classList.replace('alert-info', 'alert-danger');
                document.getElementById('estado').textContent = 'Error al obtener ubicación: ' + error.message;
                console.error('Error al obtener ubicación:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } catch (error) {
        document.getElementById('estado').classList.replace('alert-info', 'alert-danger');
        document.getElementById('estado').textContent = 'Error: ' + error.message;
        console.error('Error en la aplicación:', error);
    }
}

// Limpiar el seguimiento cuando se cierra la página
window.addEventListener('beforeunload', detenerSeguimiento);

// Cargar el script de Google Maps
function loadScript() {
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyArifzqYFkv6deJgQqMAsB2Www-2NnpNVg&callback=main';
    script.defer = true;
    script.async = true;
    document.head.appendChild(script);
}

// Iniciar la carga de scripts cuando la página esté lista
// Iniciar la carga de scripts cuando la página esté lista
window.onload = () => {
    loadScript();

    // Esperar que el DOM esté cargado para asignar el evento al botón
    const btn = document.getElementById('btnIniciar');
    if (btn) {
        btn.addEventListener('click', () => {
            main(); // Inicia la lógica completa
            btn.style.display = 'none'; // Oculta el botón al empezar
        });
    }
};
