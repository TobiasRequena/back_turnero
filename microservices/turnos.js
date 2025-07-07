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

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[turnos] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// ==============================
// 📌 Crear Turno (manual o cliente)
// ==============================
app.post('/api/turnos', cargarEmpleado, verificarPrestadorExiste, verificarEmpleadoExiste, async (req, res) => {
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

    const empleadoInfo = req.empleadoInfo ? {
      _id: req.empleadoInfo._id,
      nombre: req.empleadoInfo.nombre,
      email: req.empleadoInfo.email,
      telefono: req.empleadoInfo.telefono
    } : null;

    res.status(201).json({
      msg: 'Turno creado correctamente',
      turno: {
        _id: turno._id,
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        clienteNombre: turno.clienteNombre,
        clienteTelefono: turno.clienteTelefono,
        empleado: empleadoInfo,
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

app.post('/api/turnos/disponibilidad', verificarPrestadorExiste, verificarEmpleadoExiste, async (req, res) => {
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

    const fechaTurnoParaDiaSemana = new Date(fecha + 'T12:00:00'); // Usar mediodía local
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

    // 4. Obtener los horarios de trabajo disponibles
    // Se ajusta la consulta para que, si no se especifica empleadoId, busque tanto
    // horarios asignados a null (generales) como a cualquier empleado del prestador.
    // Esto se manejará mejor en el paso 6.
    const queryHorario = {
      prestadorId,
      diaSemana,
      eliminado: false,
      // Si empleadoId no se proporciona, no se agrega un filtro por empleadoId
      ...(empleadoId && { empleadoId }) // Agrega empleadoId solo si está presente
    };

    console.log('Consulta a la base de datos para Horarios:', JSON.stringify(queryHorario, null, 2));

    let horariosDisponibles;
    if (empleadoId) {
        // Si se especificó un empleado, buscar solo sus horarios
        horariosDisponibles = await Horario.find({ ...queryHorario, empleadoId });
    } else {
        // Si no se especificó un empleado, buscar todos los horarios del prestador para ese día,
        // incluyendo los que tienen empleadoId: null (horarios generales del prestador)
        // y los de empleados específicos.
        horariosDisponibles = await Horario.find({
            prestadorId,
            diaSemana,
            eliminado: false,
            // Aquí es donde se maneja la lógica para incluir horarios generales y de empleados
            // Asumiendo que `empleadoId` en Horario puede ser `null` para horarios generales
            $or: [
                { empleadoId: null }, // Horarios generales del prestador
                { empleadoId: { $exists: true, $ne: null } } // Horarios de cualquier empleado
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

    // 5. Obtener los turnos ya existentes para la fecha
    // Ajustamos la consulta para que, si no se envía empleadoId, busque turnos de *todos* los empleados del prestador
    const queryTurnosExistentes = {
      fecha: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      prestadorId,
      eliminado: false,
      estado: { $ne: 'cancelado' },
      ...(empleadoId ? { empleadoId } : {}) // Solo añade el filtro por empleadoId si se especifica
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

    // 6. Consolidar y calcular los bloques de tiempo disponibles sin duplicados
    const posiblesBloquesDeTrabajo = new Set(); // Usamos un Set para almacenar bloques únicos como strings "desde-hasta"

    for (const horario of horariosDisponibles) {
        // Si no se especificó empleadoId, y el horario tiene un empleado asignado (no null),
        // y ese empleado no está entre los empleados del prestador (esto es más una validación de datos),
        // podríamos necesitar filtrar aquí si hay horarios de empleados "huérfanos".
        // Sin embargo, la lógica de `queryHorario` ya debería traer solo lo relevante.
        // La clave es que si `empleadoId` NO se envía, queremos que *todos* los bloques de trabajo
        // aplicables (tanto generales del prestador como de sus empleados) se consideren.
        // Aquí no necesitamos diferenciar por empleado, solo recolectar los bloques de tiempo.
        for (const bloqueHorario of horario.bloques) {
            posiblesBloquesDeTrabajo.add(`${bloqueHorario.desde}-${bloqueHorario.hasta}`);
        }
    }

    const bloquesDisponibles = [];
    const slotsGenerados = new Set(); // Para evitar slots duplicados (ej: "09:00-09:20")

    // Convertir los bloques únicos a un formato de minutos y ordenarlos para procesamiento
    const sortedTrabajoMinutos = Array.from(posiblesBloquesDeTrabajo)
        .map(b => {
            const [desde, hasta] = b.split('-');
            return {
                desdeMin: timeToMinutes(desde),
                hastaMin: timeToMinutes(hasta)
            };
        })
        .sort((a, b) => a.desdeMin - b.desdeMin); // Ordenar por hora de inicio

    for (const bloqueTrabajo of sortedTrabajoMinutos) {
        let inicioBloqueActualMin = bloqueTrabajo.desdeMin;
        const finBloqueActualMin = bloqueTrabajo.hastaMin;

        while (inicioBloqueActualMin + duracionServicioMinutos <= finBloqueActualMin) {
            const finPosibleTurnoMin = inicioBloqueActualMin + duracionServicioMinutos;
            const horaInicioPosible = minutesToTime(inicioBloqueActualMin);
            const horaFinPosible = minutesToTime(finPosibleTurnoMin);
            const slotKey = `${horaInicioPosible}-${horaFinPosible}`; // Clave única para el slot

            // Solo si este slot no ha sido ya añadido
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

    // Opcional: Ordenar los bloques disponibles por hora de inicio
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
app.get('/api/turnos', authenticateJWT, verificarEmpleadoExiste, async (req, res) => {
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
