require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Horario = require('../models/Horario');
const Turno = require('../models/Turno');
const Servicio = require('../models/Servicios');
const Empleado = require('../models/Empleado');
const Prestador = require('../models/Prestador')

const authenticateJWT = require('../middleware/authenticateJWT');
const cargarEmpleado = require('../middleware/cargarEmpleado');
const verificarPrestadorExiste = require('../middleware/existingPrestador');
const verificarEmpleadoExiste = require('../middleware/existingEmpleado');
const verificarServicioExiste = require('../middleware/existingServicio');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[turnos] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// ==============================
// 📌 Crear Turno (manual o cliente)
// ==============================
app.post('/api/turnos', cargarEmpleado, async (req, res) => {
  try {
    const {
      fecha,
      horaInicio,
      clienteNombre,
      clienteTelefono,
      servicioId,
      prestadorId
    } = req.body;

    let empleadoAsignadoId = req.body.empleadoId || null;

    if (!fecha || !horaInicio || !clienteNombre || !clienteTelefono || !servicioId || !prestadorId) {
      return res.status(400).json({ msg: 'Faltan datos obligatorios' });
    }

    const fechaTurno = new Date(fecha);
    fechaTurno.setUTCHours(0, 0, 0, 0);

    const servicio = await Servicio.findById(servicioId);
    if (!servicio) return res.status(404).json({ msg: 'Servicio no encontrado' });

    // ⏰ Calcular hora de fin
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMin = h * 60 + m + servicio.duracionMinutos;
    const horaFin = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

    if (!empleadoAsignadoId) { 
      const diaSemana = new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long' }); // Obtener el día de la semana
      
      const horariosDisponibles = await Horario.find({
        prestadorId: prestadorId,
        diaSemana: diaSemana,
        empleadoId: { $ne: null }, 
        eliminado: false
      }).lean();

      let empleadoEncontrado = null;

      for (const horarioEmpleado of horariosDisponibles) {
        const empleadoIdActual = horarioEmpleado.empleadoId.toString();

        const cubreBloque = horarioEmpleado.bloques.some(bloque => {
          return horaInicio >= bloque.desde && horaFin <= bloque.hasta;
        });

        if (cubreBloque) {
          const turnoSobresaliente = await Turno.findOne({
            fecha: fechaTurno, // Fecha ya estandarizada
            empleadoId: empleadoIdActual,
            prestadorId: prestadorId,
            horaInicio: { $lt: horaFin }, 
            horaFin: { $gt: horaInicio },
            eliminado: false,
            estado: { $ne: 'cancelado' } 
          });

          if (!turnoSobresaliente) {
            empleadoEncontrado = empleadoIdActual;
            break;
          }
        }
      }

      if (!empleadoEncontrado) {
        return res.status(409).json({ msg: 'No se encontró un empleado disponible para ese horario.' });
      }
      empleadoAsignadoId = empleadoEncontrado;
    }

    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existe = await Turno.findOne({
      fecha: fechaTurno,
      empleadoId: empleadoAsignadoId || null,
      prestadorId: prestadorId,
      horaInicio: { $lt: horaFin },
      horaFin: { $gt: horaInicio },
      eliminado: false,
      estado: { $ne: 'cancelado' }
    });

    if (existe) {
      return res.status(409).json({ msg: 'Ya hay un turno en ese horario (después de la asignación de empleado).' });
    }

    const turno = await Turno.create({
      fecha: fechaTurno, 
      horaInicio,
      horaFin,
      clienteNombre,
      clienteTelefono,
      prestadorId,
      empleadoId: empleadoAsignadoId, 
      servicioId,
      origen: 'cliente',
      duracionFinal: servicio.duracionMinutos,
      precioFinal: servicio.precio,
      estado: 'pendiente'
    });

    let empleadoInfoRespuesta = null;
    if (empleadoAsignadoId) {
        empleadoInfoRespuesta = await Empleado.findById(empleadoAsignadoId).select('nombre email telefono');
    }

    res.status(201).json({
      msg: 'Turno creado correctamente',
      turno: {
        _id: turno._id,
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        clienteNombre: turno.clienteNombre,
        clienteTelefono: turno.clienteTelefono,
        empleado: empleadoInfoRespuesta, 
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

function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return 0; 
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

app.post('/api/turnos/disponibilidad', async (req, res) => {
  try {
    const { fecha, servicioId, prestadorId, empleadoId } = req.body;

    console.log('--- Iniciando cálculo de disponibilidad ---');
    console.log('Request body recibido:', { fecha, servicioId, prestadorId, empleadoId });

    if (!fecha || !servicioId || !prestadorId) {
      console.log('Error: Faltan datos obligatorios. Se requieren fecha, servicioId y prestadorId.');
      return res.status(400).json({ msg: 'Faltan datos obligatorios: fecha, servicioId y prestadorId son requeridos.' });
    }

    const servicio = await Servicio.findById(servicioId);
    console.log('Servicio encontrado:', servicio ? servicio.nombre : 'No encontrado');

    if (!servicio || typeof servicio.duracionMinutos !== 'number' || servicio.duracionMinutos <= 0) {
      console.log('Error: Servicio no encontrado o duración inválida.');
      return res.status(404).json({ msg: 'Servicio no encontrado o duración inválida. La duración debe ser un número positivo.' });
    }

    const duracionServicioMinutos = servicio.duracionMinutos;
    console.log('Duración del servicio (minutos):', duracionServicioMinutos);

    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    const fechaTurnoParaDiaSemana = new Date(fecha + 'T12:00:00'); 
    if (isNaN(fechaTurnoParaDiaSemana.getTime())) {
      console.log('Error: Formato de fecha inválido.');
      return res.status(400).json({ msg: 'Formato de fecha inválido. Por favor, use un formato de fecha reconocido.' });
    }
    const diaSemana = dias[fechaTurnoParaDiaSemana.getDay()];
    console.log('Día de la semana calculado:', diaSemana);

    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const queryHorario = {
      prestadorId,
      diaSemana,
      eliminado: false,
      ...(empleadoId && { empleadoId }) 
    };

    console.log('Consulta a la base de datos para Horarios:', JSON.stringify(queryHorario, null, 2));

    let horariosDisponibles;
    if (empleadoId) {
        horariosDisponibles = await Horario.find({ ...queryHorario, empleadoId });
    } else {
        horariosDisponibles = await Horario.find({
            prestadorId,
            diaSemana,
            eliminado: false,
            $or: [
                { empleadoId: null },
                { empleadoId: { $exists: true, $ne: null } }
            ]
        });
    }

    console.log('Horarios disponibles encontrados (cantidad):', horariosDisponibles.length);
    if (horariosDisponibles.length > 0) {
      console.log('Detalle de horarios disponibles (primeros 5):', horariosDisponibles.slice(0, 5).map(h => ({ _id: h._id, bloques: h.bloques, prestadorId: h.prestadorId, empleadoId: h.empleadoId })));
    }

    if (!horariosDisponibles.length) {
      console.log('No se encontraron horarios de trabajo que coincidan con la consulta. Devolviendo disponibilidad vacía.');
      let empleadoInfo = null;
      if (empleadoId) {
        const empleado = await Empleado.findById(empleadoId);
        if (empleado) {
          empleadoInfo = { id: empleado._id, nombre: empleado.nombre };
        }
      }
      return res.json({
        servicio: {
          id: servicio._id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          duracionMinutos: servicio.duracionMinutos,
          precio: servicio.precio
        },
        fecha: fecha,
        empleado: empleadoInfo,
        disponibilidad: []
      });
    }

    const queryTurnosExistentes = {
      fecha: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      prestadorId,
      eliminado: false,
      estado: { $ne: 'cancelado' },
      ...(empleadoId ? { empleadoId } : {}) 
    };
    console.log('Consulta a la base de datos para Turnos existentes:', JSON.stringify(queryTurnosExistentes, null, 2));
    const turnosExistentes = await Turno.find(queryTurnosExistentes);
    console.log('Turnos existentes encontrados (cantidad):', turnosExistentes.length);
    if (turnosExistentes.length > 0) {
      console.log('Detalle de turnos existentes (RAW, primeros 5):', JSON.stringify(turnosExistentes.slice(0, 5).map(t => ({ _id: t._id, horaInicio: t.horaInicio, horaFin: t.horaFin, prestadorId: t.prestadorId, empleadoId: t.empleadoId, fecha: t.fecha })), null, 2));
    }

    const turnosOcupadosMinutos = turnosExistentes.map(t => ({
      inicioMin: timeToMinutes(t.horaInicio),
      finMin: timeToMinutes(t.horaFin)
    }));
    console.log('Turnos ocupados convertidos a minutos:', turnosOcupadosMinutos);

    const posiblesBloquesDeTrabajo = new Set();

    for (const horario of horariosDisponibles) {
        for (const bloqueHorario of horario.bloques) {
            posiblesBloquesDeTrabajo.add(`${bloqueHorario.desde}-${bloqueHorario.hasta}`);
        }
    }

    const bloquesDisponibles = [];
    const slotsGenerados = new Set();

    const sortedTrabajoMinutos = Array.from(posiblesBloquesDeTrabajo)
        .map(b => {
            const [desde, hasta] = b.split('-');
            return {
                desdeMin: timeToMinutes(desde),
                hastaMin: timeToMinutes(hasta)
            };
        })
        .sort((a, b) => a.desdeMin - b.desdeMin); 

    for (const bloqueTrabajo of sortedTrabajoMinutos) {
        let inicioBloqueActualMin = bloqueTrabajo.desdeMin;
        const finBloqueActualMin = bloqueTrabajo.hastaMin;

        while (inicioBloqueActualMin + duracionServicioMinutos <= finBloqueActualMin) {
            const finPosibleTurnoMin = inicioBloqueActualMin + duracionServicioMinutos;
            const horaInicioPosible = minutesToTime(inicioBloqueActualMin);
            const horaFinPosible = minutesToTime(finPosibleTurnoMin);
            const slotKey = `${horaInicioPosible}-${horaFinPosible}`;

            if (!slotsGenerados.has(slotKey)) {
                const estaSuperpuesto = turnosOcupadosMinutos.some(turnoOcupado => {
                    return inicioBloqueActualMin < turnoOcupado.finMin && finPosibleTurnoMin > turnoOcupado.inicioMin;
                });

                if (!estaSuperpuesto) {
                    bloquesDisponibles.push({ horaInicio: horaInicioPosible, horaFin: horaFinPosible });
                    slotsGenerados.add(slotKey); // Añadir a los slots ya generados
                }
            }

            inicioBloqueActualMin += duracionServicioMinutos;
        }
    }

    bloquesDisponibles.sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));

    console.log('Bloques disponibles finales encontrados:', bloquesDisponibles.length);
    if (bloquesDisponibles.length > 0) {
      console.log('Lista de bloques disponibles:', bloquesDisponibles);
    }

    let empleadoInfo = null;
    if (empleadoId) {
      const empleado = await Empleado.findById(empleadoId);
      if (empleado) {
        empleadoInfo = { id: empleado._id, nombre: empleado.nombre };
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

    const turnos = await Turno.find(filtros).sort({ fecha: 1, horaInicio: 1 })
      .populate('servicioId', 'nombre descripcion duracionMinutos precio')
      .populate('empleadoId', 'nombre')
      .populate('prestadorId', 'nombreComercial telefono direccion');
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
