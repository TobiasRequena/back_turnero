require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Horario = require('../models/Horario');
const Empleado = require ('../models/Empleado')
const Prestador = require('../models/Prestador')
const authenticateJWT = require('../middleware/authenticateJWT');
const verificarEmpleadoExiste = require('../middleware/existingEmpleado');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[horarios] Mongo conectado'))
  .catch(err => console.error('Mongo error:', err));

// 📌 Crear uno o varios horarios disponibles (con verificación de duplicados)
app.post('/api/horarios', authenticateJWT, async (req, res) => {
  try {
    const horariosData = req.body;

    if (!Array.isArray(horariosData) || horariosData.length === 0) {
      return res.status(400).json({ msg: 'El cuerpo de la solicitud debe ser un array de horarios no vacío.' });
    }

    const prestadorId = req.user.tipo === 'empleado' ? req.user.prestadorId : req.user.id;
    const creados = [];
    const errores = [];

    for (const horario of horariosData) {
      const { diaSemana, bloques, empleadoId } = horario;

      if (empleadoId) {
        if (!mongoose.Types.ObjectId.isValid(empleadoId)) {
          errores.push({
            horario: horario,
            msg: `ID de empleado inválido para el día ${diaSemana}: ${empleadoId}`
          });
          continue;
        }
        try {
          const empleado = await Empleado.findById(empleadoId);
          if (!empleado || empleado.eliminado) {
            errores.push({
              horario: horario,
              msg: `Empleado no encontrado o eliminado para el ID: ${empleadoId}`
            });
            continue;
          }
        } catch (empleadoErr) {
          console.error('Error al verificar empleado en lote:', empleadoErr);
          errores.push({
            horario: horario,
            msg: `Error interno al verificar empleado ${empleadoId}: ${empleadoErr.message}`
          });
          continue;
        }
      }

      const query = {
        prestadorId: prestadorId,
        diaSemana: diaSemana,
        eliminado: false
      };

      if (empleadoId) {
        query.empleadoId = empleadoId;
      } else {
        query.empleadoId = null;
      }

      try {
        const horarioExistente = await Horario.findOne(query);

        if (horarioExistente) {
          errores.push({
            horario: horario,
            msg: `Ya existe un horario para el ${diaSemana} ${empleadoId ? 'con este empleado' : 'general'} para tu negocio.`
          });
          continue; 
        }

        const nuevo = await Horario.create({
          prestadorId: prestadorId,
          empleadoId: empleadoId || null,
          diaSemana,
          bloques
        });
        creados.push(nuevo);

      } catch (creationErr) {
        console.error('Error al crear o verificar horario individual:', creationErr);
        errores.push({
          horario: horario,
          msg: `Error al procesar el horario para ${diaSemana}: ${creationErr.message}`
        });
      }
    }

    if (creados.length > 0 && errores.length === 0) {
      return res.status(201).json({ msg: 'Horarios creados exitosamente.', horariosCreados: creados });
    } else if (creados.length > 0 && errores.length > 0) {
      return res.status(207).json({
        msg: 'Algunos horarios fueron creados, pero hubo problemas con otros.',
        horariosCreados: creados,
        errores: errores
      });
    } else {
      return res.status(400).json({ msg: 'No se pudo crear ningún horario.', errores: errores });
    }

  } catch (err) {
    console.error('Error general en /api/horarios:', err);
    res.status(500).json({ msg: 'Hubo un error inesperado al procesar los horarios.', error: err.message });
  }
});

// 📌 Obtener horarios con estructura simplificada
app.get('/api/horarios', authenticateJWT, async (req, res) => {
  try {
    const filtros = { prestadorId: req.user.id, eliminado: false };
    let empleadoInfo = null;

    const prestadorInfo = {
      _id: req.user.id,
      nombre: req.user.nombre || 'Nombre Prestador Desconocido',
      email: req.user.email,
      telefono: req.user.telefono
    };

    if (req.query.empleadoId) {
      const empleadoId = req.query.empleadoId;

      if (!mongoose.Types.ObjectId.isValid(empleadoId)) {
        return res.status(400).json({ msg: 'ID de empleado inválido proporcionado en la consulta.' });
      }

      filtros.empleadoId = empleadoId;

      empleadoInfo = await Empleado.findById(empleadoId).select('nombre email telefono');

      if (!empleadoInfo || empleadoInfo.eliminado) {
        return res.status(404).json({ msg: 'Empleado especificado no encontrado o eliminado.' });
      }
    }
    const horarios = await Horario.find(filtros).lean();

    const respuesta = {
      total: horarios.length,
      prestador: prestadorInfo,
      ...(empleadoInfo && { empleado: empleadoInfo }),
      horarios: horarios.map(h => {
        const { prestadorId, empleadoId, ...rest } = h;
        return rest;
      })
    };

    res.json(respuesta);

  } catch (err) {
    console.error('Error al obtener horarios con estructura simplificada:', err);
    res.status(500).json({ msg: 'Error al obtener horarios', error: err.message });
  }
});

// 📌 Editar horario
app.patch('/api/horaios/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;

    const horario = await Horario.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      actualizaciones,
      { new: true }
    );

    if (!horario) return res.status(404).json({ msg: 'Horario no encontrado' });

    res.json({ msg: 'Horario actualizado', horario });
  } catch (err) {
    res.status(500).json({ msg: 'Error al editar horario', error: err.message });
  }
});

// 📌 Eliminar (soft delete)
app.delete('/api/horaios/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const horario = await Horario.findOneAndUpdate(
      { _id: id, prestadorId: req.user.id },
      { eliminado: true },
      { new: true }
    );

    if (!horario) return res.status(404).json({ msg: 'Horario no encontrado' });

    res.json({ msg: 'Horario eliminado' });
  } catch (err) {
    res.status(500).json({ msg: 'Error al eliminar horario', error: err.message });
  }
});

// 🔥 Iniciar servicio
const PORT = process.env.PORT_HORARIOS || 3003;
app.listen(PORT, () => {
  console.log(`[horarios] Microservicio corriendo en http://localhost:${PORT}`);
});
