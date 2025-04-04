// src/controllers/pagos.js
const Pago = require('../models/pago');
const Cita = require('../models/cita');
const Paciente = require('../models/paciente');
const User = require('../models/user');
const Tratamiento = require('../models/tratamiento');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los pagos (con filtros)
 * @route   GET /api/pagos
 * @access  Privado (Admin, Secretaria)
 */
exports.obtenerPagos = async (req, res) => {
  try {
    const { 
      paciente, medico, metodoPago, estado, categoria,
      fechaDesde, fechaHasta, montoMin, montoMax,
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (paciente) {
      filtro.paciente = paciente;
    }
    
    if (medico) {
      filtro.medico = medico;
    }
    
    if (metodoPago) {
      filtro.metodoPago = metodoPago;
    }
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (categoria) {
      filtro.categoria = categoria;
    }
    
    // Filtrar por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.createdAt.$lte = new Date(fechaHasta);
      }
    }
    
    // Filtrar por rango de montos
    if (montoMin || montoMax) {
      filtro.monto = {};
      
      if (montoMin) {
        filtro.monto.$gte = parseFloat(montoMin);
      }
      
      if (montoMax) {
        filtro.monto.$lte = parseFloat(montoMax);
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar pagos con paginación y populate
    const pagos = await Pago.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido')
      .populate('cita', 'fechaInicio estado')
      .populate('tratamiento', 'nombre categoria')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de pagos para paginación
    const totalPagos = await Pago.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalPagos / parseInt(limit));
    
    // Calcular suma total de montos
    const sumaPagos = await Pago.aggregate([
      { $match: filtro },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$monto' },
          promedio: { $avg: '$monto' },
          maximo: { $max: '$monto' },
          minimo: { $min: '$monto' }
        } 
      }
    ]);
    
    const resumenFinanciero = sumaPagos.length > 0 ? {
      totalMonto: sumaPagos[0].total,
      promedioMonto: sumaPagos[0].promedio,
      montoMaximo: sumaPagos[0].maximo,
      montoMinimo: sumaPagos[0].minimo
    } : {
      totalMonto: 0,
      promedioMonto: 0,
      montoMaximo: 0,
      montoMinimo: 0
    };
    
    res.json({
      status: 'success',
      totalPagos,
      totalPaginas,
      pagina: parseInt(page),
      resumenFinanciero,
      pagos
    });
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de pagos'
    });
  }
};

/**
 * @desc    Registrar un nuevo pago
 * @route   POST /api/pagos
 * @access  Privado (Admin, Secretaria)
 */
exports.registrarPago = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      paciente, cita, medico, tratamiento,
      monto, metodoPago, categoria, comprobante,
      notasInternas
    } = req.body;
    
    // Verificar que la cita exista
    const citaExistente = await Cita.findById(cita)
      .populate('paciente');
    
    if (!citaExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que la cita no tenga ya un pago completado
    const pagoExistente = await Pago.findOne({ 
      cita, 
      estado: 'completado'
    });
    
    if (pagoExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un pago completado para esta cita',
        pagoId: pagoExistente._id
      });
    }
    
    // Verificar que el paciente de la cita coincida con el proporcionado
    if (citaExistente.paciente._id.toString() !== paciente) {
      return res.status(400).json({
        status: 'error',
        message: 'El paciente no coincide con el de la cita'
      });
    }
    
    // Verificar que el médico de la cita coincida con el proporcionado
    if (citaExistente.medico.toString() !== medico) {
      return res.status(400).json({
        status: 'error',
        message: 'El médico no coincide con el de la cita'
      });
    }
    
    // Verificar que el tratamiento de la cita coincida con el proporcionado
    if (citaExistente.tratamiento.toString() !== tratamiento) {
      return res.status(400).json({
        status: 'error',
        message: 'El tratamiento no coincide con el de la cita'
      });
    }
    
    // Crear nuevo pago
    const nuevoPago = new Pago({
      paciente,
      cita,
      medico,
      tratamiento,
      monto,
      metodoPago,
      estado: 'completado', // Por defecto, el pago se marca como completado
      categoria,
      notasInternas
    });
    
    // Agregar comprobante si se proporcionó
    if (comprobante) {
      nuevoPago.comprobante = {
        tipo: comprobante.tipo,
        numero: comprobante.numero,
        fechaEmision: comprobante.fechaEmision || new Date()
      };
    }
    
    await nuevoPago.save({ session });
    
    // Si la cita estaba en estado completada o en_curso, no cambiar
    // En otros casos, actualizar a confirmada
    if (!['completada', 'en_curso'].includes(citaExistente.estado)) {
      citaExistente.estado = 'confirmada';
      await citaExistente.save({ session });
    }
    
    await session.commitTransaction();
    
    // Poblar datos para la respuesta
    const pagoCreado = await Pago.findById(nuevoPago._id)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido')
      .populate('cita', 'fechaInicio estado')
      .populate('tratamiento', 'nombre categoria precio');
    
    res.status(201).json({
      status: 'success',
      message: 'Pago registrado con éxito',
      pago: pagoCreado
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error al registrar pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar pago'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Obtener pago por ID
 * @route   GET /api/pagos/:id
 * @access  Privado (Admin, Secretaria)
 */
exports.obtenerPagoPorId = async (req, res) => {
  try {
    const pagoId = req.params.id;
    
    // Buscar pago con populate completo
    const pago = await Pago.findById(pagoId)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('cita', 'fechaInicio fechaFin estado')
      .populate('tratamiento', 'nombre categoria precio')
      .populate('reembolso.aprobadoPor', 'nombre apellido');
    
    if (!pago) {
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      pago
    });
  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del pago'
    });
  }
};

/**
 * @desc    Actualizar pago
 * @route   PUT /api/pagos/:id
 * @access  Privado (Admin)
 */
exports.actualizarPago = async (req, res) => {
  try {
    const pagoId = req.params.id;
    
    // Buscar pago
    const pago = await Pago.findById(pagoId);
    
    if (!pago) {
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    // Verificar que el pago no esté en estado reembolsado o anulado
    if (['reembolsado', 'anulado'].includes(pago.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede actualizar un pago en estado ${pago.estado}`
      });
    }
    
    // Campos actualizables
    const camposActualizables = [
      'metodoPago', 'comprobante', 'notasInternas'
    ];
    
    // Actualizar solo los campos permitidos
    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        pago[campo] = req.body[campo];
      }
    });
    
    // Actualizar comprobante manteniendo campos existentes
    if (req.body.comprobante) {
      pago.comprobante = {
        ...pago.comprobante,
        ...req.body.comprobante
      };
    }
    
    await pago.save();
    
    res.json({
      status: 'success',
      message: 'Pago actualizado correctamente',
      pago: {
        _id: pago._id,
        metodoPago: pago.metodoPago,
        comprobante: pago.comprobante,
        notasInternas: pago.notasInternas,
        updatedAt: pago.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar pago'
    });
  }
};

/**
 * @desc    Registrar reembolso
 * @route   POST /api/pagos/:id/reembolso
 * @access  Privado (Admin)
 */
exports.registrarReembolso = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const pagoId = req.params.id;
    const { monto, motivo } = req.body;
    
    // Buscar pago
    const pago = await Pago.findById(pagoId);
    
    if (!pago) {
      return res.status(404).json({
        status: 'error',
        message: 'Pago no encontrado'
      });
    }
    
    // Verificar que el pago no esté ya reembolsado o anulado
    if (['reembolsado', 'anulado'].includes(pago.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede reembolsar un pago en estado ${pago.estado}`
      });
    }
    
    // Verificar que el monto de reembolso no exceda el monto del pago
    if (parseFloat(monto) > pago.monto) {
      return res.status(400).json({
        status: 'error',
        message: 'El monto del reembolso no puede ser mayor que el monto del pago'
      });
    }
    
    // Registrar reembolso
    pago.reembolso = {
      fecha: new Date(),
      monto: parseFloat(monto),
      motivo,
      aprobadoPor: req.user.userId
    };
    
    // Actualizar estado del pago
    pago.estado = 'reembolsado';
    
    await pago.save({ session });
    
    // Si el reembolso está asociado a una cancelación de cita,
    // asegurarse de que la cita esté marcada como cancelada
    const cita = await Cita.findById(pago.cita);
    
    if (cita && cita.estado !== 'cancelada') {
      cita.estado = 'cancelada';
      cita.motivoCancelacion = motivo || 'Relacionado con reembolso';
      cita.canceladoPor = 'sistema';
      
      await cita.save({ session });
    }
    
    await session.commitTransaction();
    
    // Poblar datos para la respuesta
    const pagoActualizado = await Pago.findById(pagoId)
      .populate('reembolso.aprobadoPor', 'nombre apellido');
    
    res.json({
      status: 'success',
      message: 'Reembolso registrado correctamente',
      pago: {
        _id: pagoActualizado._id,
        estado: pagoActualizado.estado,
        reembolso: pagoActualizado.reembolso
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error al registrar reembolso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar reembolso'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Obtener pagos de un paciente
 * @route   GET /api/pagos/paciente/:pacienteId
 * @access  Privado (Admin, Secretaria)
 */
exports.obtenerPagosPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const { 
      fechaDesde, fechaHasta, estado,
      page = 1, limit = 10
    } = req.query;
    
    // Verificar que el paciente exista
    const paciente = await Paciente.findById(pacienteId)
      .populate('usuario', 'nombre apellido email');
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Construir filtro
    const filtro = { paciente: pacienteId };
    
    if (estado) {
      filtro.estado = estado;
    }
    
    // Filtrar por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.createdAt.$lte = new Date(fechaHasta);
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar pagos con paginación
    const pagos = await Pago.find(filtro)
      .populate('medico', 'nombre apellido')
      .populate('cita', 'fechaInicio estado')
      .populate('tratamiento', 'nombre categoria precio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de pagos para paginación
    const totalPagos = await Pago.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalPagos / parseInt(limit));
    
    // Calcular suma total de montos
    const sumaPagos = await Pago.aggregate([
      { $match: filtro },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$monto' } 
        } 
      }
    ]);
    
    res.json({
      status: 'success',
      paciente: {
        _id: paciente._id,
        nombre: `${paciente.usuario.nombre} ${paciente.usuario.apellido}`,
        dni: paciente.dni,
        email: paciente.usuario.email
      },
      totalPagos,
      totalPaginas,
      totalMonto: sumaPagos.length > 0 ? sumaPagos[0].total : 0,
      pagina: parseInt(page),
      pagos
    });
  } catch (error) {
    console.error('Error al obtener pagos del paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener pagos del paciente'
    });
  }
};

/**
 * @desc    Obtener pagos de un médico
 * @route   GET /api/pagos/medico/:medicoId
 * @access  Privado (Admin, Médico propio)
 */
exports.obtenerPagosMedico = async (req, res) => {
  try {
    const { medicoId } = req.params;
    const { 
      fechaDesde, fechaHasta, categoria,
      page = 1, limit = 10
    } = req.query;
    
    // Verificar permisos
    if (req.user.rol === 'medico' && req.user.userId !== medicoId) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a esta información'
      });
    }
    
    // Verificar que el médico exista
    const medico = await User.findOne({ 
      _id: medicoId, 
      rol: 'medico' 
    });
    
    if (!medico) {
      return res.status(404).json({
        status: 'error',
        message: 'Médico no encontrado'
      });
    }
    
    // Construir filtro
    const filtro = { 
      medico: medicoId,
      estado: 'completado' // Solo pagos completados
    };
    
    if (categoria) {
      filtro.categoria = categoria;
    }
    
    // Filtrar por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.createdAt.$lte = new Date(fechaHasta);
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar pagos con paginación
    const pagos = await Pago.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido' }
      })
      .populate('cita', 'fechaInicio')
      .populate('tratamiento', 'nombre categoria precio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de pagos para paginación
    const totalPagos = await Pago.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalPagos / parseInt(limit));
    
    // Calcular suma total de montos
    const sumaPagos = await Pago.aggregate([
      { $match: filtro },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$monto' } 
        } 
      }
    ]);
    
    // Agrupar por mes si se solicita resumen
    const resumenMensual = req.query.resumen === 'true' 
      ? await Pago.aggregate([
          { $match: filtro },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              total: { $sum: '$monto' },
              cantidad: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          {
            $project: {
              _id: 0,
              year: '$_id.year',
              month: '$_id.month',
              fecha: {
                $concat: [
                  { $toString: '$_id.month' },
                  '/',
                  { $toString: '$_id.year' }
                ]
              },
              total: 1,
              cantidad: 1
            }
          }
        ])
      : [];
    
    res.json({
      status: 'success',
      medico: {
        _id: medico._id,
        nombre: `${medico.nombre} ${medico.apellido}`,
        especialidad: medico.especialidad
      },
      totalPagos,
      totalPaginas,
      totalMonto: sumaPagos.length > 0 ? sumaPagos[0].total : 0,
      pagina: parseInt(page),
      pagos,
      resumenMensual
    });
  } catch (error) {
    console.error('Error al obtener pagos del médico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener pagos del médico'
    });
  }
};