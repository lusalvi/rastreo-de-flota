require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Inicializar express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev')); // Logging
app.use(express.json()); // Para parsear JSON en las peticiones
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios

// Configuración de CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['*']; // Evitás errores por espacios accidentales

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como las de curl o Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log(`CORS bloqueado para origen: ${origin}`);
      return callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));


// Inicializar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan variables de entorno para Supabase');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Rutas para la API

// Autenticación
/* app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}); */

// Conductores
app.get('/api/conductores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*, vehiculo(patente)');
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Búsqueda de conductores
app.get('/api/conductores/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*, vehiculo(patente)')
      .ilike('nombreCompleto', `%${q}%`)
      .or(`dni.ilike.%${q}%`);
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un conductor específico
app.get('/api/conductores/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .eq('dni', dni)
      .single();
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conductores', async (req, res) => {
  try {
    const { error } = await supabase
      .from('conductores')
      .upsert([req.body]);
    
    if (error) throw error;
    res.status(201).json({ message: 'Conductor creado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conductores/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { error } = await supabase
      .from('conductores')
      .update(req.body)
      .eq('dni', dni);
    
    if (error) throw error;
    res.status(200).json({ message: 'Conductor actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/conductores/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { error } = await supabase
      .from('conductores')
      .delete()
      .eq('dni', dni);
    
    if (error) throw error;
    res.status(200).json({ message: 'Conductor eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pasajeros
app.get('/api/pasajeros', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pasajeros')
      .select('*, vehiculoasignado(patente)');
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Búsqueda de pasajeros
app.get('/api/pasajeros/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    const { data, error } = await supabase
      .from('pasajeros')
      .select('*, vehiculoasignado(patente)')
      .ilike('nombreCompleto', `%${q}%`)
      .or(`dni.ilike.%${q}%`);
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un pasajero específico
app.get('/api/pasajeros/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { data, error } = await supabase
      .from('pasajeros')
      .select('*')
      .eq('dni', dni)
      .single();
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pasajeros', async (req, res) => {
  try {
    const { error } = await supabase
      .from('pasajeros')
      .upsert([req.body]);
    
    if (error) throw error;
    res.status(201).json({ message: 'Pasajero creado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pasajeros/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { error } = await supabase
      .from('pasajeros')
      .update(req.body)
      .eq('dni', dni);
    
    if (error) throw error;
    res.status(200).json({ message: 'Pasajero actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pasajeros/:dni', async (req, res) => {
  const { dni } = req.params;
  try {
    const { error } = await supabase
      .from('pasajeros')
      .delete()
      .eq('dni', dni);
    
    if (error) throw error;
    res.status(200).json({ message: 'Pasajero eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vehículos
app.get('/api/vehiculos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*, conductores(dni)');
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Búsqueda de vehículos
app.get('/api/vehiculos/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*, conductores(dni)')
      .ilike('patente', `%${q}%`)
      .or(`marca.ilike.%${q}%`)
      .or(`modelo.ilike.%${q}%`);
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener listado de patentes para selects
app.get('/api/vehiculos/patentes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('patente, marca');
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un vehículo específico
app.get('/api/vehiculos/:patente', async (req, res) => {
  const { patente } = req.params;
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('patente', patente)
      .single();
    
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehiculos', async (req, res) => {
  try {
    const { error } = await supabase
      .from('vehiculos')
      .upsert([req.body]);
    
    if (error) throw error;
    res.status(201).json({ message: 'Vehículo creado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vehiculos/:patente', async (req, res) => {
  const { patente } = req.params;
  try {
    const { error } = await supabase
      .from('vehiculos')
      .update(req.body)
      .eq('patente', patente);
    
    if (error) throw error;
    res.status(200).json({ message: 'Vehículo actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehiculos/:patente', async (req, res) => {
  const { patente } = req.params;
  try {
    const { error } = await supabase
      .from('vehiculos')
      .delete()
      .eq('patente', patente);
    
    if (error) throw error;
    res.status(200).json({ message: 'Vehículo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar ubicación enviada por seguimiento.html
app.post('/api/ubicacion', async (req, res) => {
  const { dni, latitud, longitud, timestamp } = req.body;

  // Validación rápida
  if (!dni || !latitud || !longitud) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const { error } = await supabase
      .from('ubicaciones')
      .insert([{ dni, latitud, longitud, timestamp }]);

    if (error) {
      console.error('❌ Error al guardar ubicación:', error);
      return res.status(500).json({ error: 'Error al guardar ubicación' });
    }

    console.log(`📍 Ubicación registrada para DNI ${dni}: (${latitud}, ${longitud})`);
    res.status(200).json({ mensaje: 'Ubicación registrada correctamente' });

  } catch (err) {
    console.error('❌ Error inesperado al guardar ubicación:', err);
    res.status(500).json({ error: 'Error inesperado del servidor' });
  }
});

// Obtener todas las ubicaciones de un conductor
app.get('/api/ubicaciones/:dni', async (req, res) => {
  const { dni } = req.params;

  if (!dni) {
    return res.status(400).json({ error: 'DNI no proporcionado' });
  }

  try {
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('*')
      .eq('dni', dni)
      .order('timestamp', { ascending: true }); // Opcional: ordena por fecha

    if (error) {
      console.error('❌ Error al traer ubicaciones:', error);
      return res.status(500).json({ error: 'Error al obtener ubicaciones' });
    }

    res.status(200).json(data);

  } catch (err) {
    console.error('❌ Error inesperado en /ubicaciones:', err);
    res.status(500).json({ error: 'Error inesperado del servidor' });
  }
});


// Ruta para verificar el estado del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

app.get('/', (req, res) => {
  res.send('Servidor de rastreo de flotas funcionando 🚛📍');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app; // Para testing