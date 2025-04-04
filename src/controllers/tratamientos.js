// src/controllers/tratamientos.js
const Tratamiento = require('../models/tratamiento');
const User = require('../models/user');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los tratamientos (con filtros)
 * @route   GET /api/tratamientos
 * @access  Privado
 */
exports.obtenerTratamientos = async (req, res) => {
  try {
    const { 
      nombre, categoria, activo,
      page = 1, limit = 10,
      ordenarPor = 'nombre', orden = 'asc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (nombre) {
      filtro.nombre = { $regex: nombre, $options: 'i' };
    }
    
    if (categoria) {
      filtro.categoria = categoria;
    }
    
    if (activo !== undefined) {
      filtro.activo = activo === 'true';
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar tratamientos con paginación y populate de profesionales habilitados
    const tratamientos = await Tratamiento.find(filtro)
      .populate('profesionalesHabilitados', 'nombre apellido')
      .populate('consentimientoTemplate', 'nombre tipo')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de tratamientos para paginación
    const totalTratamientos = await Tratamiento.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalTratamientos / parseInt(limit));
    
    res.json({
      status: 'success',
      totalTratamientos,
      totalPaginas,
      pagina: parseInt(page),
      tratamientos
    });
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de tratamientos'
    });
  }
};

/**
 * @desc    Obtener tratamientos por categoría
 * @route   GET /api/tratamientos/categoria/:categoria
 * @access  Privado
 */
exports.obtenerPorCategoria = async (req, res) => {
  try {
    const { categoria } = req.params;
    
    // Validar categoría
    if (!['estetica_general', 'medicina_estetica'].includes(categoria)) {
      return res.status(400).json({
        status: 'error',
        message: 'Categoría no válida'
      });
    }
    
    // Buscar tratamientos activos de esa categoría
    const tratamientos = await Tratamiento.find({ 
      categoria, 
      activo: true 
    }).sort({ nombre: 1 });
    
    res.json({
      status: 'success',
      categoria,
      tratamientos
    });
  } catch (error) {
    console.error('Error al obtener tratamientos por categoría:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener tratamientos por categoría'
    });
  }
};

/**
 * @desc    Crear un nuevo tratamiento
 * @route   POST /api/tratamientos
 * @access  Privado (Admin)
 */
exports.crearTratamiento = async (req, res) => {
  try {
    const { 
      nombre, descripcion, categoria, subcategoria, 
      precio, duracionEstimada, requiereConsulta, requiereConsentimiento,
      consentimientoTemplate, profesionalesHabilitados, notas, imagenes
    } = req.body;
    
    // Verificar si ya existe un tratamiento con el mismo nombre
    const tratamientoExistente = await Tratamiento.findOne({ nombre });
    
    if (tratamientoExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un tratamiento con ese nombre'
      });
    }
    
    // Si se especificó una plantilla de consentimiento, verificar que exista
    if (consentimientoTemplate) {
      const DocumentoTemplate = mongoose.model('DocumentoTemplate');
      const templateExistente = await DocumentoTemplate.findById(consentimientoTemplate);
      
      if (!templateExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'La plantilla de consentimiento especificada no existe'
        });
      }
    }
    
    // Si se especificaron profesionales, verificar que existan y sean médicos
    if (profesionalesHabilitados && profesionalesHabilitados.length > 0) {
      const idsValidos = [];
      
      for (const id of profesionalesHabilitados) {
        const medico = await User.findOne({ _id: id, rol: 'medico', activo: true });
        
        if (medico) {
          idsValidos.push(medico._id);
        }
      }
      
      // Asignar solo IDs válidos
      req.body.profesionalesHabilitados = idsValidos;
    }
    
    // Crear nuevo tratamiento
    const nuevoTratamiento = new Tratamiento(req.body);
    
    await nuevoTratamiento.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Tratamiento creado con éxito',
      tratamiento: nuevoTratamiento
    });
  } catch (error) {
    console.error('Error al crear tratamiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear tratamiento'
    });
  }
};

/**
 * @desc    Obtener tratamiento por ID
 * @route   GET /api/tratamientos/:id
 * @access  Privado
 */
exports.obtenerTratamientoPorId = async (req, res) => {
  try {
    const tratamientoId = req.params.id;
    
    // Buscar tratamiento con populate de profesionales y plantilla
    const tratamiento = await Tratamiento.findById(tratamientoId)
      .populate('profesionalesHabilitados', 'nombre apellido email')
      .populate('consentimientoTemplate', 'nombre tipo');
    
    if (!tratamiento) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      tratamiento
    });
  } catch (error) {
    console.error('Error al obtener tratamiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del tratamiento'
    });
  }
};

/**
 * @desc    Actualizar tratamiento
 * @route   PUT /api/tratamientos/:id
 * @access  Privado (Admin)
 */
exports.actualizarTratamiento = async (req, res) => {
  try {
    const tratamientoId = req.params.id;
    
    // Buscar tratamiento
    const tratamiento = await Tratamiento.findById(tratamientoId);
    
    if (!tratamiento) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado'
      });
    }
    
    // Validar que no exista otro tratamiento con el mismo nombre
    if (req.body.nombre && req.body.nombre !== tratamiento.nombre) {
      const nombreExistente = await Tratamiento.findOne({ 
        nombre: req.body.nombre,
        _id: { $ne: tratamientoId }
      });
      
      if (nombreExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'Ya existe otro tratamiento con ese nombre'
        });
      }
    }
    
    // Si se actualizó la plantilla de consentimiento, validar que exista
    if (req.body.consentimientoTemplate) {
      const DocumentoTemplate = mongoose.model('DocumentoTemplate');
      const templateExistente = await DocumentoTemplate.findById(req.body.consentimientoTemplate);
      
      if (!templateExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'La plantilla de consentimiento especificada no existe'
        });
      }
    }
    
    // Campos actualizables
    const camposActualizables = [
      'nombre', 'descripcion', 'categoria', 'subcategoria',
      'precio', 'duracionEstimada', 'requiereConsulta', 'requiereConsentimiento',
      'consentimientoTemplate', 'notas', 'imagenes', 'activo'
    ];
    
    // Actualizar solo los campos permitidos
    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        tratamiento[campo] = req.body[campo];
      }
    });
    
    await tratamiento.save();
    
    res.json({
      status: 'success',
      message: 'Tratamiento actualizado correctamente',
      tratamiento
    });
  } catch (error) {
    console.error('Error al actualizar tratamiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar tratamiento'
    });
  }
};

/**
 * @desc    Desactivar tratamiento
 * @route   DELETE /api/tratamientos/:id
 * @access  Privado (Admin)
 */
exports.desactivarTratamiento = async (req, res) => {
  try {
    const tratamientoId = req.params.id;
    
    // Buscar tratamiento
    const tratamiento = await Tratamiento.findById(tratamientoId);
    
    if (!tratamiento) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado'
      });
    }
    
    // Verificar si ya está desactivado
    if (!tratamiento.activo) {
      return res.status(400).json({
        status: 'error',
        message: 'El tratamiento ya está desactivado'
      });
    }
    
    // Desactivar en lugar de eliminar
    tratamiento.activo = false;
    await tratamiento.save();
    
    res.json({
      status: 'success',
      message: 'Tratamiento desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar tratamiento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al desactivar tratamiento'
    });
  }
};

/**
 * @desc    Actualizar profesionales habilitados para el tratamiento
 * @route   PUT /api/tratamientos/:id/profesionales
 * @access  Privado (Admin)
 */
exports.actualizarProfesionales = async (req, res) => {
  try {
    const tratamientoId = req.params.id;
    const { profesionales } = req.body;
    
    // Buscar tratamiento
    const tratamiento = await Tratamiento.findById(tratamientoId);
    
    if (!tratamiento) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado'
      });
    }
    
    // Verificar que los profesionales existan y sean médicos activos
    const idsValidos = [];
    
    for (const id of profesionales) {
      const medico = await User.findOne({ _id: id, rol: 'medico', activo: true });
      
      if (medico) {
        idsValidos.push(medico._id);
      }
    }
    
    // Actualizar lista de profesionales habilitados
    tratamiento.profesionalesHabilitados = idsValidos;
    
    await tratamiento.save();
    
    // Obtener detalles de los médicos para la respuesta
    const profesionalesDetalle = await User.find(
      { _id: { $in: idsValidos } },
      'nombre apellido email especialidad'
    );
    
    res.json({
      status: 'success',
      message: 'Profesionales habilitados actualizados correctamente',
      profesionales: profesionalesDetalle
    });
  } catch (error) {
    console.error('Error al actualizar profesionales habilitados:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar profesionales habilitados'
    });
  }
};