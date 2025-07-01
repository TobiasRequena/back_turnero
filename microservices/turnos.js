require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Horario = require('../models/Horario');
const Turno = require('../models/Turno');
const Servicio = require('../models/Servicios');
const Empleado = require('../models/Empleado');

const authenticateJWT = require('../middleware/authenticateJWT');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[turnos] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// ==============================
// 📌 Crear Turno (manual o cliente)
// ==============================
app.post('/api/turnos', async (req, res) => {
  try {
    const {
      fecha,
      horaInicio,
      clienteNombre,
      clienteTelefono,
      servicioId,
      empleadoId,
      prestadorId
    } = req.body;

    if (!fecha || !horaInicio || !clienteNombre || !clienteTelefono || !servicioId || !prestadorId) {
      return res.status(400).json({ msg: 'Faltan datos obligatorios' });
    }

    const servicio = await Servicio.findById(servicioId);
    if (!servicio) return res.status(404).json({ msg: 'Servicio no encontrado' });

    // ⏰ Calcular hora de fin
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMin = h * 60 + m + servicio.duracionMinutos;
    const horaFin = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

    // *** MODIFICACIÓN CLAVE AQUÍ: Preparar rango de fecha para la verificación de superposición ***
    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);
    // ******************************************************************************************

    // ❌ Verificar superposición usando el rango de fecha
    const existe = await Turno.findOne({
      fecha: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      empleadoId: empleadoId || null,
      prestadorId: prestadorId, // Asegurarse de filtrar por prestadorId también
      horaInicio: { $lt: horaFin },
      horaFin: { $gt: horaInicio },
      eliminado: false,
      estado: { $ne: 'cancelado' }
    });

    if (existe) {
      return res.status(409).json({ msg: 'Ya hay un turno en ese horario' });
    }

    const turno = await Turno.create({
      // *** MODIFICACIÓN CLAVE AQUÍ: Almacenar la fecha como el inicio del día para consistencia ***
      fecha: startOfDay, // Guardar como Date object al inicio del día
      // ******************************************************************************************
      horaInicio,
      horaFin,
      clienteNombre,
      clienteTelefono,
      prestadorId,
      empleadoId: empleadoId || null,
      servicioId,
      origen: 'cliente',
      duracionFinal: servicio.duracionMinutos, // Usar duracionMinutos consistentemente
      precioFinal: servicio.precio,
      estado: 'pendiente' // Establecer un estado inicial si no viene en el body
    });

    res.status(201).json({
      msg: 'Turno creado correctamente',
      turno: {
        _id: turno._id,
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        clienteNombre: turno.clienteNombre,
        clienteTelefono: turno.clienteTelefono,
        empleadoId: turno.empleadoId,
        prestadorId: turno.prestadorId,
        servicio: {
          _id: servicio._id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          duracion: servicio.duracionMinutos,
          precio: servicio.precio
        },
        estado: turno.estado
      }
    });

  } catch (err) {
    console.error('Error al crear turno:', err);
    res.status(500).json({ msg: 'Error al crear turno', error: err.message });
  }
});

// Función auxiliar para convertir una cadena de tiempo "HH:MM" a minutos desde la medianoche
function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return 0; // O lanzar un error, dependiendo de la tolerancia a datos inválidos
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Función auxiliar para convertir minutos a una cadena de tiempo "HH:MM"
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

app.post('/api/turnos/disponibilidad', async (req, res) => {
  try {
    // 1. Obtener y validar los datos de entrada
    const { fecha, servicioId, prestadorId, empleadoId } = req.body;

    console.log('--- Iniciando cálculo de disponibilidad ---');
    console.log('Request body recibido:', { fecha, servicioId, prestadorId, empleadoId });

    // Verificar si faltan datos obligatorios (fecha, servicioId y prestadorId son requeridos)
    if (!fecha || !servicioId || !prestadorId) {
      console.log('Error: Faltan datos obligatorios. Se requieren fecha, servicioId y prestadorId.');
      return res.status(400).json({ msg: 'Faltan datos obligatorios: fecha, servicioId y prestadorId son requeridos.' });
    }

    // 2. Obtener detalles del servicio
    const servicio = await Servicio.findById(servicioId);
    console.log('Servicio encontrado:', servicio ? servicio.nombre : 'No encontrado');

    if (!servicio || typeof servicio.duracionMinutos !== 'number' || servicio.duracionMinutos <= 0) {
      console.log('Error: Servicio no encontrado o duración inválida.');
      return res.status(404).json({ msg: 'Servicio no encontrado o duración inválida. La duración debe ser un número positivo.' });
    }

    const duracionServicioMinutos = servicio.duracionMinutos;
    console.log('Duración del servicio (minutos):', duracionServicioMinutos);

    // 3. Determinar el día de la semana y rango de fechas para la consulta
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    // Usar el mediodía local para obtener el día de la semana correcto
    const fechaTurnoParaDiaSemana = new Date(fecha + 'T12:00:00');
    if (isNaN(fechaTurnoParaDiaSemana.getTime())) {
      console.log('Error: Formato de fecha inválido.');
      return res.status(400).json({ msg: 'Formato de fecha inválido. Por favor, use un formato de fecha reconocido.' });
    }
    const diaSemana = dias[fechaTurnoParaDiaSemana.getDay()];
    console.log('Fecha del turno (Date object para día de semana):', fechaTurnoParaDiaSemana);
    console.log('Día de la semana calculado:', diaSemana);

    // *** NUEVA LÓGICA PARA RANGO DE FECHAS DEL DÍA ***
    // Crear Date objects para el inicio y fin del día, para consultas de rango
    // Esto asegura que se capturen todos los turnos del día, sin importar la hora específica guardada.
    const startOfDay = new Date(fecha); // Medianoche UTC de la fecha especificada
    startOfDay.setUTCHours(0, 0, 0, 0); // Ajustar a medianoche UTC
    
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999); // Ajustar a casi final del día UTC

    // Si tu MongoDB o tu aplicación funcionan con un desfase horario y guardan las fechas en UTC
    // pero tu `fecha` de entrada es local, deberías ajustar:
    // const startOfDay = new Date(fecha + 'T00:00:00'); // Tratar la entrada como hora local
    // const endOfDay = new Date(fecha + 'T23:59:59'); // Tratar la entrada como hora local
    // O si quieres ser exacto al día calendario del usuario, usa librerías como `date-fns-tz`

    // Para este ejemplo, asumimos que los horarios son consistentes o que la fecha se almacena en UTC de forma simple.
    // La clave es que `startOfDay` y `endOfDay` definan el día calendario claramente.
    // Puedes verificar el valor UTC de estas fechas con `startOfDay.toISOString()` y `endOfDay.toISOString()`.
    // *************************************************

    // 4. Obtener los horarios de trabajo disponibles
    const queryHorario = {
      prestadorId,
      diaSemana,
      eliminado: false,
      ...(empleadoId ? { empleadoId } : { empleadoId: null })
    };
    console.log('Consulta a la base de datos para Horarios:', JSON.stringify(queryHorario, null, 2));
    const horariosDisponibles = await Horario.find(queryHorario);
    console.log('Horarios disponibles encontrados (cantidad):', horariosDisponibles.length);
    if (horariosDisponibles.length > 0) {
      console.log('Detalle de horarios disponibles (primeros 5):', horariosDisponibles.slice(0, 5).map(h => ({ _id: h._id, bloques: h.bloques, prestadorId: h.prestadorId, empleadoId: h.empleadoId })));
    }


    // Si no se encuentran horarios para el día y prestador/empleado, se devuelve disponibilidad vacía
    if (!horariosDisponibles.length) {
      console.log('No se encontraron horarios de trabajo que coincidan con la consulta. Devolviendo disponibilidad vacía.');
      return res.json({
        servicio: {
          id: servicio._id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          duracionMinutos: servicio.duracionMinutos,
          precio: servicio.precio
        },
        fecha: fecha,
        empleado: null,
        disponibilidad: []
      });
    }

    // 5. Obtener los turnos ya existentes para la fecha y prestador/empleado
    const queryTurnosExistentes = {
      // *** MODIFICACIÓN CLAVE AQUÍ: Buscar por rango de fecha para el día completo ***
      fecha: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      // **************************************************************************
      prestadorId,
      eliminado: false,
      estado: { $ne: 'cancelado' },
      ...(empleadoId ? { empleadoId } : { empleadoId: null })
    };
    console.log('Consulta a la base de datos para Turnos existentes:', JSON.stringify(queryTurnosExistentes, null, 2));
    const turnosExistentes = await Turno.find(queryTurnosExistentes);
    console.log('Turnos existentes encontrados (cantidad):', turnosExistentes.length);
    if (turnosExistentes.length > 0) {
      console.log('Detalle de turnos existentes (RAW, primeros 5):', JSON.stringify(turnosExistentes.slice(0, 5).map(t => ({ _id: t._id, horaInicio: t.horaInicio, horaFin: t.horaFin, prestadorId: t.prestadorId, empleadoId: t.empleadoId, fecha: t.fecha })), null, 2));
    }


    // Convertir los turnos existentes a un formato de minutos para facilitar la comparación
    const turnosOcupadosMinutos = turnosExistentes.map(t => ({
      inicioMin: timeToMinutes(t.horaInicio),
      finMin: timeToMinutes(t.horaFin)
    }));
    console.log('Turnos ocupados convertidos a minutos:', turnosOcupadosMinutos);

    // 6. Calcular los bloques de tiempo disponibles
    const bloquesDisponibles = [];

    for (const horario of horariosDisponibles) {
      for (const bloqueHorario of horario.bloques) {
        let inicioBloqueTrabajoMin = timeToMinutes(bloqueHorario.desde);
        const finBloqueTrabajoMin = timeToMinutes(bloqueHorario.hasta);

        console.log(`Procesando bloque de horario: ${bloqueHorario.desde}-${bloqueHorario.hasta} (minutos ${inicioBloqueTrabajoMin}-${finBloqueTrabajoMin}) para prestador ${horario.prestadorId} y empleado ${horario.empleadoId || 'N/A'}`);

        while (inicioBloqueTrabajoMin + duracionServicioMinutos <= finBloqueTrabajoMin) {
          const finPosibleTurnoMin = inicioBloqueTrabajoMin + duracionServicioMinutos;
          const horaInicioPosible = minutesToTime(inicioBloqueTrabajoMin);
          const horaFinPosible = minutesToTime(finPosibleTurnoMin);

          console.log(`  Intentando slot: ${horaInicioPosible}-${horaFinPosible} (minutos ${inicioBloqueTrabajoMin}-${finPosibleTurnoMin})`);

          const estaSuperpuesto = turnosOcupadosMinutos.some(turnoOcupado => {
            const superposicion = inicioBloqueTrabajoMin < turnoOcupado.finMin && finPosibleTurnoMin > turnoOcupado.inicioMin;
            if (superposicion) {
              console.log(`    Superpuesto con turno existente: ${minutesToTime(turnoOcupado.inicioMin)}-${minutesToTime(turnoOcupado.finMin)}`);
            }
            return superposicion;
          });

          if (!estaSuperpuesto) {
            bloquesDisponibles.push({ horaInicio: horaInicioPosible, horaFin: horaFinPosible });
            console.log('    ¡Slot DISPONIBLE añadido!');
          }

          inicioBloqueTrabajoMin += duracionServicioMinutos;
        }
      }
    }

    console.log('Bloques disponibles finales encontrados:', bloquesDisponibles.length);
    if (bloquesDisponibles.length > 0) {
      console.log('Lista de bloques disponibles:', bloquesDisponibles);
    }

    let empleadoInfo = null;
    if (empleadoId) {
      const empleado = await Empleado.findById(empleadoId);
      if (empleado) {
        empleadoInfo = { id: empleado._id, nombre: empleado.nombre };
        console.log('Información del empleado:', empleadoInfo);
      } else {
        console.log('Empleado no encontrado con ID:', empleadoId);
      }
    }

    res.json({
      servicio: {
        id: servicio._id,
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        duracionMinutos: servicio.duracionMinutos,
        precio: servicio.precio
      },
      fecha: fecha,
      empleado: empleadoInfo,
      disponibilidad: bloquesDisponibles
    });
    console.log('--- Cálculo de disponibilidad finalizado ---');

  } catch (err) {
    console.error('Error interno del servidor al calcular disponibilidad:', err);
    res.status(500).json({ msg: 'Error interno del servidor al calcular disponibilidad', error: err.message });
  }
});

// ==============================
// 📋 Obtener Turnos
// ==============================
app.get('/api/turnos', authenticateJWT, async (req, res) => {
  try {
    const filtros = {
      eliminado: false,
      prestadorId: req.user.tipo === 'prestador' ? req.user.id : req.user.prestadorId
    };

    console.log('--- Iniciando obtención de turnos ---');
    console.log('req.user:', req.user); // Para depurar el usuario autenticado
    
    // *** MODIFICACIÓN CLAVE AQUÍ: Aplicar rango de fecha para la consulta GET ***
    if (req.query.fecha) {
      const queryDate = req.query.fecha;
      const startOfDay = new Date(queryDate);
      startOfDay.setUTCHours(0, 0, 0, 0); // Medianoche UTC
      
      const endOfDay = new Date(queryDate);
      endOfDay.setUTCHours(23, 59, 59, 999); // Fin del día UTC (casi medianoche del día siguiente)

      filtros.fecha = {
        $gte: startOfDay,
        $lt: endOfDay
      };
      console.log(`Filtro de fecha aplicado: desde ${startOfDay.toISOString()} hasta ${endOfDay.toISOString()}`);
    }
    // **************************************************************************
    
    if (req.query.empleadoId) {
      filtros.empleadoId = req.query.empleadoId;
      console.log('Filtro de empleadoId aplicado:', filtros.empleadoId);
    }

    console.log('Consulta de filtros para /turnos:', JSON.stringify(filtros, null, 2));

    const turnos = await Turno.find(filtros).sort({ fecha: 1, horaInicio: 1 });
    console.log('Turnos encontrados (cantidad):', turnos.length);
    if (turnos.length > 0) {
      console.log('Detalle de turnos encontrados (primeros 5):', JSON.stringify(turnos.slice(0, 5), null, 2));
    } else {
      console.log('No se encontraron turnos con los filtros especificados.');
    }

    res.json({ total: turnos.length, turnos });
    console.log('--- Obtención de turnos finalizada ---');

  } catch (err) {
    console.error('Error al obtener turnos:', err);
    res.status(500).json({ msg: 'Error al obtener turnos', error: err.message });
  }
});

// ==============================
// ✅ Confirmar turno
// ==============================
app.patch('/api/turnos/:id/confirmar', authenticateJWT, async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(
      req.params.id,
      { estado: 'confirmado' },
      { new: true }
    );
    if (!turno) return res.status(404).json({ msg: 'Turno no encontrado' });
    res.json({ msg: 'Turno confirmado', turno });
  } catch (err) {
    res.status(500).json({ msg: 'Error al confirmar turno', error: err.message });
  }
});

// ==============================
// ❌ Cancelar turno
// ==============================
app.patch('/api/turnos/:id/cancelar', authenticateJWT, async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(
      req.params.id,
      { estado: 'cancelado' },
      { new: true }
    );
    if (!turno) return res.status(404).json({ msg: 'Turno no encontrado' });
    res.json({ msg: 'Turno cancelado', turno });
  } catch (err) {
    res.status(500).json({ msg: 'Error al cancelar turno', error: err.message });
  }
});

// ==============================
// 🗑️ Soft delete
// ==============================
app.delete('/api/turnos/:id', authenticateJWT, async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(
      req.params.id,
      { eliminado: true },
      { new: true }
    );
    if (!turno) return res.status(404).json({ msg: 'Turno no encontrado' });
    res.json({ msg: 'Turno eliminado' });
  } catch (err) {
    res.status(500).json({ msg: 'Error al eliminar turno', error: err.message });
  }
});


// ==============================
// 🚀 Iniciar servicio
// ==============================
const PORT = process.env.PORT_TURNOS || 3004;
app.listen(PORT, () => {
  console.log(`[turnos] Microservicio corriendo en http://localhost:${PORT}`);
});
