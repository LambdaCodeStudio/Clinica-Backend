// src/controllers/citas.js
const Cita = require('../models/cita');
const Paciente = require('../models/paciente');
const User = require('../models/user');
const Tratamiento = require('../models/tratamiento');
const mongoose = require('mongoose');
const moment = require('moment');
const emailService = require('../services/email');
const smsService = require('../services/sms');

/**
 * @desc    Obtener todas las citas (con filtros)
 * @route   GET /api/citas
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.obtenerCitas = async (req, res) => {
  try {
    const { 
      paciente, medico, estado, tratamiento,
      fechaDesde, fechaHasta,
      page = 1, limit = 10,
      ordenarPor = 'fechaInicio', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (paciente) {
      filtro.paciente = paciente;
    }
    
    // Si es médico, mostrar solo sus citas
    if (req.user.rol === 'medico') {
      filtro.medico = req.user.userId;
    } else if (medico) {
      filtro.medico = medico;
    }
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (tratamiento) {
      filtro.tratamiento = tratamiento;
    }
    
    // Filtrar por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.fechaInicio = {};
      
      if (fechaDesde) {
        filtro.fechaInicio.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.fechaInicio.$lte = new Date(fechaHasta);
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar citas con paginación y populate
    const citas = await Cita.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamiento', 'nombre precio duracionEstimada categoria')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de citas para paginación
    const totalCitas = await Cita.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalCitas / parseInt(limit));
    
    res.json({
      status: 'success',
      totalCitas,
      totalPaginas,
      pagina: parseInt(page),
      citas
    });
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de citas'
    });
  }
};

/**
 * @desc    Crear una nueva cita
 * @route   POST /api/citas
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.crearCita = async (req, res) => {
  try {
    const { 
      paciente, medico, tratamiento,
      fechaInicio, fechaFin, notas
    } = req.body;
    
    // Verificar que el paciente exista
    const pacienteExistente = await Paciente.findById(paciente)
      .populate('usuario');
    
    if (!pacienteExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar que el médico exista y esté activo
    const medicoExistente = await User.findOne({ 
      _id: medico, 
      rol: 'medico',
      activo: true
    });
    
    if (!medicoExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Médico no encontrado o no está activo'
      });
    }
    
    // Verificar que el tratamiento exista y esté activo
    const tratamientoExistente = await Tratamiento.findOne({
      _id: tratamiento,
      activo: true
    });
    
    if (!tratamientoExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado o no está activo'
      });
    }
    
    // Verificar que el médico esté habilitado para el tratamiento
    if (tratamientoExistente.profesionalesHabilitados && 
        tratamientoExistente.profesionalesHabilitados.length > 0 &&
        !tratamientoExistente.profesionalesHabilitados.includes(medicoExistente._id)) {
      return res.status(400).json({
        status: 'error',
        message: 'El médico no está habilitado para realizar este tratamiento'
      });
    }
    
    // Verificar que el médico no tenga otra cita en el mismo horario
    const citaSolapada = await Cita.findOne({
      medico,
      estado: { $nin: ['cancelada', 'reprogramada'] },
      $or: [
        { // Cita existente dentro de la nueva cita
          fechaInicio: { $gte: new Date(fechaInicio), $lt: new Date(fechaFin) }
        },
        { // Nueva cita dentro de una cita existente
          fechaFin: { $gt: new Date(fechaInicio), $lte: new Date(fechaFin) }
        },
        { // Nueva cita empieza antes y termina después
          fechaInicio: { $lte: new Date(fechaInicio) },
          fechaFin: { $gte: new Date(fechaFin) }
        }
      ]
    });
    
    if (citaSolapada) {
      return res.status(400).json({
        status: 'error',
        message: 'El médico ya tiene otra cita programada en ese horario'
      });
    }
    
    // Crear nueva cita
    const nuevaCita = new Cita({
      paciente,
      medico,
      tratamiento,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      estado: 'programada',
      notas
    });
    
    await nuevaCita.save();
    
    // Enviar notificación si hay preferencias configuradas
    try {
      if (pacienteExistente.preferencias?.recordatoriosEmail && pacienteExistente.usuario.email) {
        await emailService.enviarConfirmacionCita(
          pacienteExistente.usuario.email,
          pacienteExistente.usuario.nombre,
          {
            fechaInicio: nuevaCita.fechaInicio,
            medico: medicoExistente,
            tratamiento: tratamientoExistente,
            _id: nuevaCita._id
          }
        );
        
        // Registrar envío de recordatorio
        nuevaCita.recordatoriosEnviados.push({
          tipo: 'email',
          fecha: new Date(),
          estado: 'enviado'
        });
        
        await nuevaCita.save();
      }
      
      if (pacienteExistente.preferencias?.recordatoriosSMS && pacienteExistente.usuario.telefono) {
        await smsService.enviarRecordatorioCita(
          pacienteExistente.usuario.telefono,
          pacienteExistente.usuario.nombre,
          {
            fechaInicio: nuevaCita.fechaInicio,
            fechaFin: nuevaCita.fechaFin,
            _id: nuevaCita._id
          }
        );
        
        // Registrar envío de recordatorio
        nuevaCita.recordatoriosEnviados.push({
          tipo: 'sms',
          fecha: new Date(),
          estado: 'enviado'
        });
        
        await nuevaCita.save();
      }
    } catch (notificacionError) {
      console.error('Error al enviar notificaciones de cita:', notificacionError);
      // Continuar el proceso aunque falle la notificación
    }
    
    // Poblar datos para la respuesta
    const citaCreada = await Cita.findById(nuevaCita._id)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamiento', 'nombre precio duracionEstimada categoria');
    
    res.status(201).json({
      status: 'success',
      message: 'Cita creada con éxito',
      cita: citaCreada
    });
  } catch (error) {
    console.error('Error al crear cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear cita'
    });
  }
};

/**
 * @desc    Obtener cita por ID
 * @route   GET /api/citas/:id
 * @access  Privado
 */
exports.obtenerCitaPorId = async (req, res) => {
  try {
    const citaId = req.params.id;
    
    // Buscar cita con populate completo
    const cita = await Cita.findById(citaId)
      .populate('paciente', 'dni fechaNacimiento genero')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad matriculaProfesional')
      .populate('tratamiento', 'nombre descripcion precio duracionEstimada categoria subcategoria')
      .populate('citaOriginal');
    
    if (!cita) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo de la cita
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== cita.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta cita'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== cita.medico._id.toString()) {
      // Si es médico, solo puede ver sus propias citas
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a esta cita'
      });
    }
    
    res.json({
      status: 'success',
      cita
    });
  } catch (error) {
    console.error('Error al obtener cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información de la cita'
    });
  }
};

/**
 * @desc    Actualizar cita
 * @route   PUT /api/citas/:id
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.actualizarCita = async (req, res) => {
  try {
    const citaId = req.params.id;
    const { fechaInicio, fechaFin, notas } = req.body;
    
    // Buscar cita
    const cita = await Cita.findById(citaId);
    
    if (!cita) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que la cita no esté en estado cancelada, completada o no_asistio
    if (['cancelada', 'completada', 'no_asistio'].includes(cita.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede actualizar una cita en estado ${cita.estado}`
      });
    }
    
    // Si se está cambiando la fecha, verificar disponibilidad
    if ((fechaInicio && new Date(fechaInicio).getTime() !== cita.fechaInicio.getTime()) || 
        (fechaFin && new Date(fechaFin).getTime() !== cita.fechaFin.getTime())) {
      
      // Verificar que el médico no tenga otra cita en el mismo horario
      const nuevoInicio = fechaInicio ? new Date(fechaInicio) : cita.fechaInicio;
      const nuevoFin = fechaFin ? new Date(fechaFin) : cita.fechaFin;
      
      const citaSolapada = await Cita.findOne({
        _id: { $ne: citaId },
        medico: cita.medico,
        estado: { $nin: ['cancelada', 'reprogramada'] },
        $or: [
          { // Cita existente dentro de la nueva cita
            fechaInicio: { $gte: nuevoInicio, $lt: nuevoFin }
          },
          { // Nueva cita dentro de una cita existente
            fechaFin: { $gt: nuevoInicio, $lte: nuevoFin }
          },
          { // Nueva cita empieza antes y termina después
            fechaInicio: { $lte: nuevoInicio },
            fechaFin: { $gte: nuevoFin }
          }
        ]
      });
      
      if (citaSolapada) {
        return res.status(400).json({
          status: 'error',
          message: 'El médico ya tiene otra cita programada en ese horario'
        });
      }
      
      // Actualizar fechas
      if (fechaInicio) cita.fechaInicio = new Date(fechaInicio);
      if (fechaFin) cita.fechaFin = new Date(fechaFin);
    }
    
    // Actualizar notas
    if (notas !== undefined) {
      cita.notas = notas;
    }
    
    await cita.save();
    
    // Notificar cambio si hay cambios en la fecha
    if (fechaInicio || fechaFin) {
      try {
        const paciente = await Paciente.findById(cita.paciente).populate('usuario');
        const medico = await User.findById(cita.medico);
        const tratamiento = await Tratamiento.findById(cita.tratamiento);
        
        if (paciente.preferencias?.recordatoriosEmail && paciente.usuario.email) {
          await emailService.enviarConfirmacionCita(
            paciente.usuario.email,
            paciente.usuario.nombre,
            {
              fechaInicio: cita.fechaInicio,
              medico,
              tratamiento,
              _id: cita._id
            }
          );
          
          // Registrar envío de recordatorio
          cita.recordatoriosEnviados.push({
            tipo: 'email',
            fecha: new Date(),
            estado: 'enviado'
          });
          
          await cita.save();
        }
      } catch (notificacionError) {
        console.error('Error al enviar notificación de actualización:', notificacionError);
        // Continuar el proceso aunque falle la notificación
      }
    }
    
    // Poblar datos para la respuesta
    const citaActualizada = await Cita.findById(citaId)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamiento', 'nombre precio duracionEstimada categoria');
    
    res.json({
      status: 'success',
      message: 'Cita actualizada correctamente',
      cita: citaActualizada
    });
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar cita'
    });
  }
};

/**
 * @desc    Cambiar estado de la cita
 * @route   PUT /api/citas/:id/estado
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.cambiarEstadoCita = async (req, res) => {
  try {
    const citaId = req.params.id;
    const { estado, notas } = req.body;
    
    // Validar estado
    const estadosValidos = ['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'reprogramada', 'no_asistio'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        status: 'error',
        message: 'Estado no válido'
      });
    }
    
    // Buscar cita
    const cita = await Cita.findById(citaId);
    
    if (!cita) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que no se intente cambiar de un estado final a otro estado
    const estadosFinales = ['completada', 'cancelada', 'no_asistio'];
    if (estadosFinales.includes(cita.estado) && cita.estado !== estado) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede cambiar el estado de una cita ${cita.estado}`
      });
    }
    
    // Actualizar estado y notas
    cita.estado = estado;
    
    if (notas !== undefined) {
      cita.notas = notas;
    }
    
    // Si cambia a cancelada o no_asistio, registrar información adicional
    if (estado === 'cancelada') {
      cita.canceladoPor = req.user.rol === 'paciente' ? 'paciente' : 'medico';
      cita.motivoCancelacion = notas || 'No se especificó motivo';
    } else if (estado === 'no_asistio') {
      cita.canceladoPor = 'no_aplica';
      cita.motivoCancelacion = 'Paciente no asistió';
    }
    
    await cita.save();
    
    // Si cambia a completada, sugerir crear historia clínica
    let sugerencia = null;
    if (estado === 'completada') {
      sugerencia = {
        mensaje: 'Se recomienda crear una historia clínica para esta cita completada',
        urlCreacion: `/api/historias?cita=${citaId}`
      };
    }
    
    res.json({
      status: 'success',
      message: 'Estado de cita actualizado correctamente',
      cita: {
        _id: cita._id,
        estado: cita.estado,
        fechaInicio: cita.fechaInicio,
        fechaFin: cita.fechaFin,
        notas: cita.notas,
        canceladoPor: cita.canceladoPor,
        motivoCancelacion: cita.motivoCancelacion
      },
      sugerencia
    });
  } catch (error) {
    console.error('Error al cambiar estado de cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cambiar estado de cita'
    });
  }
};

/**
 * @desc    Reprogramar una cita
 * @route   POST /api/citas/:id/reprogramar
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.reprogramarCita = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const citaId = req.params.id;
    const { fechaInicio, fechaFin, motivo } = req.body;
    
    // Buscar cita
    const cita = await Cita.findById(citaId);
    
    if (!cita) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que la cita no esté en estado cancelada, completada o no_asistio
    if (['cancelada', 'completada', 'no_asistio', 'reprogramada'].includes(cita.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede reprogramar una cita en estado ${cita.estado}`
      });
    }
    
    // Verificar disponibilidad para la nueva fecha
    const nuevaFechaInicio = new Date(fechaInicio);
    const nuevaFechaFin = new Date(fechaFin);
    
    const citaSolapada = await Cita.findOne({
      _id: { $ne: citaId },
      medico: cita.medico,
      estado: { $nin: ['cancelada', 'reprogramada'] },
      $or: [
        { // Cita existente dentro de la nueva cita
          fechaInicio: { $gte: nuevaFechaInicio, $lt: nuevaFechaFin }
        },
        { // Nueva cita dentro de una cita existente
          fechaFin: { $gt: nuevaFechaInicio, $lte: nuevaFechaFin }
        },
        { // Nueva cita empieza antes y termina después
          fechaInicio: { $lte: nuevaFechaInicio },
          fechaFin: { $gte: nuevaFechaFin }
        }
      ]
    });
    
    if (citaSolapada) {
      return res.status(400).json({
        status: 'error',
        message: 'El médico ya tiene otra cita programada en ese horario'
      });
    }
    
    // Marcar la cita original como reprogramada
    cita.estado = 'reprogramada';
    cita.motivoCancelacion = motivo || 'Cita reprogramada';
    cita.canceladoPor = req.user.rol === 'paciente' ? 'paciente' : 'medico';
    
    await cita.save({ session });
    
    // Crear nueva cita
    const nuevaCita = new Cita({
      paciente: cita.paciente,
      medico: cita.medico,
      tratamiento: cita.tratamiento,
      fechaInicio: nuevaFechaInicio,
      fechaFin: nuevaFechaFin,
      estado: 'programada',
      notas: cita.notas,
      citaOriginal: cita._id
    });
    
    await nuevaCita.save({ session });
    
    // Notificar reprogramación
    try {
      const paciente = await Paciente.findById(cita.paciente).populate('usuario');
      const medico = await User.findById(cita.medico);
      const tratamiento = await Tratamiento.findById(cita.tratamiento);
      
      if (paciente.preferencias?.recordatoriosEmail && paciente.usuario.email) {
        await emailService.enviarConfirmacionCita(
          paciente.usuario.email,
          paciente.usuario.nombre,
          {
            fechaInicio: nuevaCita.fechaInicio,
            medico,
            tratamiento,
            _id: nuevaCita._id
          }
        );
        
        // Registrar envío de recordatorio
        nuevaCita.recordatoriosEnviados.push({
          tipo: 'email',
          fecha: new Date(),
          estado: 'enviado'
        });
        
        await nuevaCita.save({ session });
      }
    } catch (notificacionError) {
      console.error('Error al enviar notificación de reprogramación:', notificacionError);
      // Continuar el proceso aunque falle la notificación
    }
    
    await session.commitTransaction();
    
    // Poblar datos para la respuesta
    const citaReprogramada = await Cita.findById(nuevaCita._id)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamiento', 'nombre precio duracionEstimada categoria')
      .populate('citaOriginal');
    
    res.json({
      status: 'success',
      message: 'Cita reprogramada correctamente',
      citaOriginal: {
        _id: cita._id,
        estado: cita.estado
      },
      nuevaCita: citaReprogramada
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error al reprogramar cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al reprogramar cita'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cancelar una cita
 * @route   POST /api/citas/:id/cancelar
 * @access  Privado
 */
exports.cancelarCita = async (req, res) => {
  try {
    const citaId = req.params.id;
    const { motivo, canceladoPor } = req.body;
    
    // Buscar cita
    const cita = await Cita.findById(citaId);
    
    if (!cita) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que la cita no esté en estado completada, cancelada o no_asistio
    if (['completada', 'cancelada', 'no_asistio'].includes(cita.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede cancelar una cita en estado ${cita.estado}`
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo de la cita
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== cita.paciente.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para cancelar esta cita'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== cita.medico.toString()) {
      // Si es médico, solo puede cancelar sus propias citas
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para cancelar esta cita'
      });
    }
    
    // Determinar quién cancela
    let origen = canceladoPor || 'sistema';
    if (req.user.rol === 'paciente') {
      origen = 'paciente';
    } else if (req.user.rol === 'medico') {
      origen = 'medico';
    }
    
    // Actualizar cita
    cita.estado = 'cancelada';
    cita.canceladoPor = origen;
    cita.motivoCancelacion = motivo || 'No se especificó motivo';
    
    await cita.save();
    
    res.json({
      status: 'success',
      message: 'Cita cancelada correctamente',
      cita: {
        _id: cita._id,
        estado: cita.estado,
        canceladoPor: cita.canceladoPor,
        motivoCancelacion: cita.motivoCancelacion
      }
    });
  } catch (error) {
    console.error('Error al cancelar cita:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cancelar cita'
    });
  }
};

/**
 * @desc    Obtener citas de un médico
 * @route   GET /api/citas/medico/:medicoId
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.obtenerCitasMedico = async (req, res) => {
  try {
    const { medicoId } = req.params;
    const { 
      fechaDesde, fechaHasta, estado,
      page = 1, limit = 10
    } = req.query;
    
    // Verificar permisos
    if (req.user.rol === 'medico' && req.user.userId !== medicoId) {
      return res.status(403).json({
        status: 'error',
        message: 'Solo puedes ver tus propias citas'
      });
    }
    
    // Verificar que el médico exista
    const medico = await User.findOne({ _id: medicoId, rol: 'medico' });
    
    if (!medico) {
      return res.status(404).json({
        status: 'error',
        message: 'Médico no encontrado'
      });
    }
    
    // Construir filtro
    const filtro = { medico: medicoId };
    
    if (estado) {
      filtro.estado = estado;
    }
    
    // Filtrar por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.fechaInicio = {};
      
      if (fechaDesde) {
        filtro.fechaInicio.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.fechaInicio.$lte = new Date(fechaHasta);
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar citas con paginación
    const citas = await Cita.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('tratamiento', 'nombre duracionEstimada categoria')
      .sort({ fechaInicio: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de citas para paginación
    const totalCitas = await Cita.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalCitas / parseInt(limit));
    
    res.json({
      status: 'success',
      medico: {
        _id: medico._id,
        nombre: medico.nombre,
        apellido: medico.apellido
      },
      totalCitas,
      totalPaginas,
      pagina: parseInt(page),
      citas
    });
  } catch (error) {
    console.error('Error al obtener citas del médico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener citas del médico'
    });
  }
};

/**
 * @desc    Obtener citas por fecha
 * @route   GET /api/citas/fecha/:fecha
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.obtenerCitasPorFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    
    // Validar formato de fecha
    if (!moment(fecha, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        status: 'error',
        message: 'Formato de fecha inválido. Use YYYY-MM-DD'
      });
    }
    
    // Calcular inicio y fin del día
    const fechaInicio = new Date(fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(fecha);
    fechaFin.setHours(23, 59, 59, 999);
    
    // Construir filtro
    const filtro = {
      fechaInicio: { $gte: fechaInicio, $lte: fechaFin }
    };
    
    // Si es médico, mostrar solo sus citas
    if (req.user.rol === 'medico') {
      filtro.medico = req.user.userId;
    }
    
    // Buscar citas para ese día
    const citas = await Cita.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamiento', 'nombre duracionEstimada categoria')
      .sort({ fechaInicio: 1 });
    
    // Agrupar por médico para la respuesta
    const citasPorMedico = {};
    
    for (const cita of citas) {
      const medicoId = cita.medico._id.toString();
      
      if (!citasPorMedico[medicoId]) {
        citasPorMedico[medicoId] = {
          medico: {
            _id: cita.medico._id,
            nombre: cita.medico.nombre,
            apellido: cita.medico.apellido,
            especialidad: cita.medico.especialidad
          },
          citas: []
        };
      }
      
      citasPorMedico[medicoId].citas.push(cita);
    }
    
    res.json({
      status: 'success',
      fecha,
      totalCitas: citas.length,
      citasPorMedico: Object.values(citasPorMedico),
      citas // Incluir también lista completa
    });
  } catch (error) {
    console.error('Error al obtener citas por fecha:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener citas por fecha'
    });
  }
};