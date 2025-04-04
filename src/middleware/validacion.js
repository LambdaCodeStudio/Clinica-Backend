// src/middleware/validacion.js
const { body, param, query, validationResult } = require('express-validator');

/**
 * Esquemas de validación para diferentes recursos
 */
const esquemas = {
  // Validaciones para usuarios
  usuario: {
    crear: [
      body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
      body('apellido').notEmpty().withMessage('El apellido es obligatorio'),
      body('email').isEmail().withMessage('Debe proporcionar un email válido'),
      body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
      body('rol').isIn(['administrador', 'medico', 'secretaria', 'paciente']).withMessage('Rol no válido')
    ],
    actualizar: [
      body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
      body('apellido').optional().notEmpty().withMessage('El apellido no puede estar vacío'),
      body('email').optional().isEmail().withMessage('Debe proporcionar un email válido'),
      body('telefono').optional().isMobilePhone().withMessage('Teléfono no válido')
    ]
  },
  
  // Validaciones para pacientes
  paciente: {
    crear: [
      body('dni').notEmpty().withMessage('El DNI es obligatorio'),
      body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
      body('apellido').notEmpty().withMessage('El apellido es obligatorio'),
      body('email').isEmail().withMessage('Debe proporcionar un email válido'),
      body('fechaNacimiento').isDate().withMessage('Fecha de nacimiento no válida'),
      body('genero').isIn(['masculino', 'femenino', 'otro', 'no_especificado']).withMessage('Género no válido')
    ],
    actualizar: [
      body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
      body('apellido').optional().notEmpty().withMessage('El apellido no puede estar vacío'),
      body('email').optional().isEmail().withMessage('Debe proporcionar un email válido'),
      body('fechaNacimiento').optional().isDate().withMessage('Fecha de nacimiento no válida'),
      body('genero').optional().isIn(['masculino', 'femenino', 'otro', 'no_especificado']).withMessage('Género no válido'),
      body('grupoSanguineo').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'desconocido']).withMessage('Grupo sanguíneo no válido')
    ]
  },
  
  // Validaciones para tratamientos
  tratamiento: {
    crear: [
      body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
      body('descripcion').notEmpty().withMessage('La descripción es obligatoria'),
      body('categoria').isIn(['estetica_general', 'medicina_estetica']).withMessage('Categoría no válida'),
      body('subcategoria').notEmpty().withMessage('La subcategoría es obligatoria'),
      body('precio').isNumeric().withMessage('El precio debe ser un número'),
      body('duracionEstimada').isInt({ min: 15 }).withMessage('La duración estimada debe ser al menos 15 minutos')
    ],
    actualizar: [
      body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
      body('descripcion').optional().notEmpty().withMessage('La descripción no puede estar vacía'),
      body('categoria').optional().isIn(['estetica_general', 'medicina_estetica']).withMessage('Categoría no válida'),
      body('precio').optional().isNumeric().withMessage('El precio debe ser un número'),
      body('duracionEstimada').optional().isInt({ min: 15 }).withMessage('La duración estimada debe ser al menos 15 minutos')
    ]
  },
  
  // Validaciones para citas
  cita: {
    crear: [
      body('paciente').isMongoId().withMessage('ID de paciente no válido'),
      body('medico').isMongoId().withMessage('ID de médico no válido'),
      body('tratamiento').isMongoId().withMessage('ID de tratamiento no válido'),
      body('fechaInicio').isISO8601().withMessage('Fecha de inicio no válida'),
      body('fechaFin').isISO8601().withMessage('Fecha de fin no válida')
    ],
    actualizar: [
      body('fechaInicio').optional().isISO8601().withMessage('Fecha de inicio no válida'),
      body('fechaFin').optional().isISO8601().withMessage('Fecha de fin no válida'),
      body('estado').optional().isIn(['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'reprogramada', 'no_asistio']).withMessage('Estado no válido')
    ],
    cambiarEstado: [
      body('estado').isIn(['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'reprogramada', 'no_asistio']).withMessage('Estado no válido')
    ]
  },
  
  // Validaciones para documentos
  documento: {
    crear: [
      body('paciente').isMongoId().withMessage('ID de paciente no válido'),
      body('tipo').isIn(['consentimiento', 'autorizacion', 'informativo', 'receta', 'certificado', 'otro']).withMessage('Tipo no válido'),
      body('titulo').notEmpty().withMessage('El título es obligatorio'),
      body('contenido').notEmpty().withMessage('El contenido es obligatorio')
    ],
    actualizar: [
      body('titulo').optional().notEmpty().withMessage('El título no puede estar vacío'),
      body('contenido').optional().notEmpty().withMessage('El contenido no puede estar vacío'),
      body('estado').optional().isIn(['borrador', 'pendiente_firma_paciente', 'pendiente_firma_medico', 'completado', 'anulado']).withMessage('Estado no válido')
    ],
    firmar: [
      body('datosFirma').notEmpty().withMessage('Los datos de firma son obligatorios')
    ]
  },
  
  // Validaciones para historias clínicas
  historiaClinica: {
    crear: [
      body('paciente').isMongoId().withMessage('ID de paciente no válido'),
      body('cita').isMongoId().withMessage('ID de cita no válido'),
      body('tratamientoRealizado').isMongoId().withMessage('ID de tratamiento no válido'),
      body('motivoConsulta').notEmpty().withMessage('El motivo de consulta es obligatorio')
    ],
    actualizar: [
      body('diagnostico').optional().notEmpty().withMessage('El diagnóstico no puede estar vacío'),
      body('observaciones').optional(),
      body('indicaciones').optional(),
      body('resultados').optional(),
      body('recomendacionesSeguimiento').optional()
    ]
  },
  
  // Validaciones para archivos
  archivo: {
    subir: [
      body('tipo').isIn(['imagen', 'documento', 'firma', 'receta', 'consentimiento', 'certificado', 'otro']).withMessage('Tipo no válido'),
      body('paciente').isMongoId().withMessage('ID de paciente no válido'),
      body('categoria').isIn(['foto_antes', 'foto_despues', 'receta', 'estudio', 'consentimiento', 'documento_firmado', 'otro']).withMessage('Categoría no válida')
    ]
  },
  
  // Validaciones para pagos
  pago: {
    crear: [
      body('paciente').isMongoId().withMessage('ID de paciente no válido'),
      body('cita').isMongoId().withMessage('ID de cita no válido'),
      body('medico').isMongoId().withMessage('ID de médico no válido'),
      body('tratamiento').isMongoId().withMessage('ID de tratamiento no válido'),
      body('monto').isNumeric().withMessage('El monto debe ser un número'),
      body('metodoPago').isIn(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque', 'otro']).withMessage('Método de pago no válido'),
      body('categoria').isIn(['estetica_general', 'medicina_estetica']).withMessage('Categoría no válida')
    ],
    reembolso: [
      body('monto').isNumeric().withMessage('El monto debe ser un número'),
      body('motivo').notEmpty().withMessage('El motivo es obligatorio')
    ]
  }
};

/**
 * Middleware para validar los datos de entrada según el recurso y acción
 * @param {String} recurso - Nombre del recurso
 * @param {String} accion - Acción a realizar
 * @returns {Array} - Middlewares de validación
 */
exports.validar = (recurso, accion) => {
  if (!esquemas[recurso] || !esquemas[recurso][accion]) {
    throw new Error(`Esquema de validación no encontrado para ${recurso}.${accion}`);
  }
  
  return [
    ...esquemas[recurso][accion],
    (req, res, next) => {
      const errores = validationResult(req);
      
      if (!errores.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada no válidos',
          errores: errores.array().map(err => ({
            campo: err.path,
            mensaje: err.msg
          }))
        });
      }
      
      next();
    }
  ];
};

/**
 * Validadores personalizados para casos específicos
 */
exports.validadores = {
  // Validar que la fecha de fin sea posterior a la de inicio
  fechaFinPosterior: body('fechaFin').custom((value, { req }) => {
    if (new Date(value) <= new Date(req.body.fechaInicio)) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    return true;
  }),
  
  // Validar que no haya superposición de citas para un médico
  sinSuperposicionCitas: body('fechaInicio').custom(async (value, { req }) => {
    const Cita = require('../models/cita');
    
    const fechaInicio = new Date(value);
    const fechaFin = new Date(req.body.fechaFin);
    const medicoId = req.body.medico;
    
    // Si estamos actualizando, excluir la cita actual
    const citaId = req.params.id ? { _id: { $ne: req.params.id } } : {};
    
    // Buscar citas que se superponen
    const citasSolapadas = await Cita.countDocuments({
      ...citaId,
      medico: medicoId,
      $or: [
        { // Cita existente dentro de la nueva cita
          fechaInicio: { $gte: fechaInicio, $lt: fechaFin }
        },
        { // Nueva cita dentro de una cita existente
          fechaFin: { $gt: fechaInicio, $lte: fechaFin }
        },
        { // Nueva cita empieza antes y termina después
          fechaInicio: { $lte: fechaInicio },
          fechaFin: { $gte: fechaFin }
        }
      ],
      estado: { $nin: ['cancelada', 'reprogramada'] }
    });
    
    if (citasSolapadas > 0) {
      throw new Error('El médico ya tiene otra cita programada en ese horario');
    }
    
    return true;
  }),
  
  // Validar que el médico esté habilitado para el tratamiento
  medicoHabilitado: body('medico').custom(async (value, { req }) => {
    const Tratamiento = require('../models/tratamiento');
    
    const tratamientoId = req.body.tratamiento;
    const medicoId = value;
    
    const tratamiento = await Tratamiento.findById(tratamientoId);
    
    if (!tratamiento) {
      throw new Error('Tratamiento no encontrado');
    }
    
    // Si el tratamiento tiene lista de profesionales habilitados
    if (tratamiento.profesionalesHabilitados && tratamiento.profesionalesHabilitados.length > 0) {
      if (!tratamiento.profesionalesHabilitados.includes(medicoId)) {
        throw new Error('El médico no está habilitado para realizar este tratamiento');
      }
    }
    
    return true;
  })
};