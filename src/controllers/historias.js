// src/controllers/historias.js
const HistoriaClinica = require('../models/historiaClinica');
const Paciente = require('../models/paciente');
const Cita = require('../models/cita');
const Tratamiento = require('../models/tratamiento');
const Archivo = require('../models/archivo');
const User = require('../models/user');
const mongoose = require('mongoose');
const pdfService = require('../services/pdf');
const path = require('path');
const fs = require('fs');

/**
 * @desc    Obtener todas las historias clínicas (con filtros)
 * @route   GET /api/historias
 * @access  Privado (Admin, Médico)
 */
exports.obtenerHistorias = async (req, res) => {
  try {
    const { 
      paciente, medico, tratamientoRealizado,
      fechaDesde, fechaHasta,
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (paciente) {
      filtro.paciente = paciente;
    }
    
    // Si es médico, mostrar solo sus historias
    if (req.user.rol === 'medico') {
      filtro.medico = req.user.userId;
    } else if (medico) {
      filtro.medico = medico;
    }
    
    if (tratamientoRealizado) {
      filtro.tratamientoRealizado = tratamientoRealizado;
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
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar historias con paginación y populate
    const historias = await HistoriaClinica.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamientoRealizado', 'nombre categoria')
      .populate('cita', 'fechaInicio fechaFin')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de historias para paginación
    const totalHistorias = await HistoriaClinica.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalHistorias / parseInt(limit));
    
    res.json({
      status: 'success',
      totalHistorias,
      totalPaginas,
      pagina: parseInt(page),
      historias
    });
  } catch (error) {
    console.error('Error al obtener historias clínicas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de historias clínicas'
    });
  }
};

/**
 * @desc    Crear una nueva historia clínica
 * @route   POST /api/historias
 * @access  Privado (Médico)
 */
exports.crearHistoria = async (req, res) => {
  try {
    const { 
      paciente, cita, tratamientoRealizado,
      motivoConsulta, diagnostico, observaciones, indicaciones,
      parametrosRegistrados, resultados, recomendacionesSeguimiento,
      proximaCita, documentos, autorizacionDivulgacionImagenes
    } = req.body;
    
    // Verificar que el paciente exista
    const pacienteExistente = await Paciente.findById(paciente);
    
    if (!pacienteExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar que la cita exista
    const citaExistente = await Cita.findById(cita);
    
    if (!citaExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Cita no encontrada'
      });
    }
    
    // Verificar que la cita corresponda al paciente
    if (citaExistente.paciente.toString() !== paciente) {
      return res.status(400).json({
        status: 'error',
        message: 'La cita no corresponde al paciente indicado'
      });
    }
    
    // Verificar que la cita esté en estado completada o en_curso
    if (!['completada', 'en_curso'].includes(citaExistente.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede crear una historia clínica para una cita en estado ${citaExistente.estado}`
      });
    }
    
    // Verificar que el tratamiento exista
    const tratamientoExistente = await Tratamiento.findById(tratamientoRealizado);
    
    if (!tratamientoExistente) {
      return res.status(404).json({
        status: 'error',
        message: 'Tratamiento no encontrado'
      });
    }
    
    // Verificar que no exista ya una historia para esta cita
    const historiaExistente = await HistoriaClinica.findOne({ cita });
    
    if (historiaExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe una historia clínica para esta cita',
        historiaId: historiaExistente._id
      });
    }
    
    // Crear nueva historia clínica
    const nuevaHistoria = new HistoriaClinica({
      paciente,
      medico: req.user.userId, // El médico que crea la historia
      cita,
      tratamientoRealizado,
      motivoConsulta,
      diagnostico,
      observaciones,
      indicaciones,
      parametrosRegistrados: parametrosRegistrados || [],
      resultados,
      autorizacionDivulgacionImagenes: autorizacionDivulgacionImagenes || false,
      recomendacionesSeguimiento,
      documentos: documentos || []
    });
    
    // Configurar próxima cita si se especificó
    if (proximaCita && proximaCita.recomendada) {
      nuevaHistoria.proximaCita = {
        recomendada: true,
        tiempoRecomendado: proximaCita.tiempoRecomendado || 30,
        observaciones: proximaCita.observaciones || ''
      };
    }
    
    await nuevaHistoria.save();
    
    // Si la cita estaba en estado en_curso, marcarla como completada
    if (citaExistente.estado === 'en_curso') {
      citaExistente.estado = 'completada';
      await citaExistente.save();
    }
    
    // Poblar datos para la respuesta
    const historiaCreada = await HistoriaClinica.findById(nuevaHistoria._id)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamientoRealizado', 'nombre categoria')
      .populate('cita', 'fechaInicio fechaFin');
    
    res.status(201).json({
      status: 'success',
      message: 'Historia clínica creada con éxito',
      historia: historiaCreada
    });
  } catch (error) {
    console.error('Error al crear historia clínica:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear historia clínica'
    });
  }
};

/**
 * @desc    Obtener historia clínica por ID
 * @route   GET /api/historias/:id
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerHistoriaPorId = async (req, res) => {
  try {
    const historiaId = req.params.id;
    
    // Buscar historia con populate completo
    const historia = await HistoriaClinica.findById(historiaId)
      .populate('paciente')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad matriculaProfesional')
      .populate('tratamientoRealizado')
      .populate('cita')
      .populate({
        path: 'documentos.archivoId',
        model: 'Archivo',
        select: 'nombre tipo mimeType tamanio ruta'
      });
    
    if (!historia) {
      return res.status(404).json({
        status: 'error',
        message: 'Historia clínica no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo de la historia
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== historia.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta historia clínica'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== historia.medico._id.toString()) {
      // Si es médico, verificar si es el médico responsable o tiene la misma especialidad
      const medico = await User.findById(req.user.userId);
      const especialidadHistoria = historia.medico.especialidad;
      
      // Permitir acceso si tiene la misma especialidad o es 'ambas'
      if (medico.especialidad !== 'ambas' && medico.especialidad !== especialidadHistoria && especialidadHistoria !== 'ambas') {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta historia clínica'
        });
      }
    }
    
    res.json({
      status: 'success',
      historia
    });
  } catch (error) {
    console.error('Error al obtener historia clínica:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información de la historia clínica'
    });
  }
};

/**
 * @desc    Actualizar historia clínica
 * @route   PUT /api/historias/:id
 * @access  Privado (Médico)
 */
exports.actualizarHistoria = async (req, res) => {
  try {
    const historiaId = req.params.id;
    
    // Buscar historia
    const historia = await HistoriaClinica.findById(historiaId);
    
    if (!historia) {
      return res.status(404).json({
        status: 'error',
        message: 'Historia clínica no encontrada'
      });
    }
    
    // Verificar permisos (solo el médico que la creó o un administrador pueden modificarla)
    if (req.user.rol === 'medico' && req.user.userId !== historia.medico.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para modificar esta historia clínica'
      });
    }
    
    // Campos actualizables
    const camposActualizables = [
      'diagnostico', 'observaciones', 'indicaciones',
      'parametrosRegistrados', 'resultados', 'recomendacionesSeguimiento',
      'proximaCita', 'autorizacionDivulgacionImagenes'
    ];
    
    // Actualizar solo los campos permitidos
    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        historia[campo] = req.body[campo];
      }
    });
    
    // Manejar proximaCita si viene como objeto
    if (req.body.proximaCita) {
      const { recomendada, tiempoRecomendado, observaciones } = req.body.proximaCita;
      
      historia.proximaCita = {
        recomendada: recomendada !== undefined ? recomendada : historia.proximaCita?.recomendada,
        tiempoRecomendado: tiempoRecomendado || historia.proximaCita?.tiempoRecomendado || 30,
        observaciones: observaciones || historia.proximaCita?.observaciones || ''
      };
    }
    
    await historia.save();
    
    // Poblar datos para la respuesta
    const historiaActualizada = await HistoriaClinica.findById(historiaId)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamientoRealizado', 'nombre categoria')
      .populate('cita', 'fechaInicio fechaFin');
    
    res.json({
      status: 'success',
      message: 'Historia clínica actualizada correctamente',
      historia: historiaActualizada
    });
  } catch (error) {
    console.error('Error al actualizar historia clínica:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar historia clínica'
    });
  }
};

/**
 * @desc    Agregar documento a historia clínica
 * @route   POST /api/historias/:id/documentos
 * @access  Privado (Médico)
 */
exports.agregarDocumento = async (req, res) => {
  try {
    const historiaId = req.params.id;
    const { tipo, archivoId, notas } = req.body;
    
    // Verificar tipos válidos
    const tiposValidos = ['consentimiento', 'receta', 'resultado', 'foto_antes', 'foto_despues', 'otros'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        status: 'error',
        message: 'Tipo de documento no válido'
      });
    }
    
    // Buscar historia
    const historia = await HistoriaClinica.findById(historiaId);
    
    if (!historia) {
      return res.status(404).json({
        status: 'error',
        message: 'Historia clínica no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'medico' && req.user.userId !== historia.medico.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para modificar esta historia clínica'
      });
    }
    
    // Verificar que el archivo exista
    const archivo = await Archivo.findById(archivoId);
    
    if (!archivo) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado'
      });
    }
    
    // Verificar que el archivo pertenezca al mismo paciente
    if (archivo.paciente.toString() !== historia.paciente.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo no pertenece al mismo paciente de la historia clínica'
      });
    }
    
    // Agregar documento a la historia
    historia.documentos.push({
      tipo,
      archivoId,
      fechaCreacion: new Date(),
      notas: notas || ''
    });
    
    await historia.save();
    
    res.json({
      status: 'success',
      message: 'Documento agregado a la historia clínica',
      documento: {
        tipo,
        archivoId,
        fechaCreacion: new Date(),
        notas: notas || ''
      }
    });
  } catch (error) {
    console.error('Error al agregar documento a historia clínica:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al agregar documento a la historia clínica'
    });
  }
};

/**
 * @desc    Generar PDF de historia clínica
 * @route   GET /api/historias/:id/pdf
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.generarPDF = async (req, res) => {
  try {
    const historiaId = req.params.id;
    
    // Buscar historia con populate completo
    const historia = await HistoriaClinica.findById(historiaId)
      .populate('paciente')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad matriculaProfesional')
      .populate('tratamientoRealizado')
      .populate('cita');
    
    if (!historia) {
      return res.status(404).json({
        status: 'error',
        message: 'Historia clínica no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo de la historia
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== historia.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta historia clínica'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== historia.medico._id.toString()) {
      // Si es médico, verificar si tiene la misma especialidad
      const medico = await User.findById(req.user.userId);
      const especialidadHistoria = historia.medico.especialidad;
      
      // Permitir acceso si tiene la misma especialidad o es 'ambas'
      if (medico.especialidad !== 'ambas' && medico.especialidad !== especialidadHistoria && especialidadHistoria !== 'ambas') {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta historia clínica'
        });
      }
    }
    
    // Obtener documentos asociados
    const documentosIds = historia.documentos.map(doc => doc.archivoId);
    const archivos = await Archivo.find({ _id: { $in: documentosIds } });
    
    // Directorio para archivos temporales
    const directorioTemp = path.join(__dirname, '../temp');
    if (!fs.existsSync(directorioTemp)) {
      fs.mkdirSync(directorioTemp, { recursive: true });
    }
    
    // Nombre del archivo PDF
    const nombreArchivo = `historia_clinica_${historia._id}_${Date.now()}.pdf`;
    const rutaPDF = path.join(directorioTemp, nombreArchivo);
    
    // Generar PDF
    await pdfService.generarHistoriaClinicaPDF(historia, archivos, rutaPDF);
    
    // Enviar archivo al cliente
    res.download(rutaPDF, `Historia_Clinica_${historia.paciente.usuario.apellido}.pdf`, (err) => {
      if (err) {
        console.error('Error al enviar PDF:', err);
      }
      
      // Eliminar archivo temporal después de enviarlo
      fs.unlink(rutaPDF, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error al eliminar archivo temporal:', unlinkErr);
        }
      });
    });
  } catch (error) {
    console.error('Error al generar PDF de historia clínica:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar PDF de historia clínica'
    });
  }
};

/**
 * @desc    Obtener historias clínicas de un paciente
 * @route   GET /api/historias/paciente/:pacienteId
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerHistoriasPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const { 
      fechaDesde, fechaHasta, 
      page = 1, limit = 10 
    } = req.query;
    
    // Verificar que el paciente exista
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo del usuario
      const pacienteUsuario = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!pacienteUsuario || pacienteUsuario._id.toString() !== pacienteId) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a estas historias clínicas'
        });
      }
    }
    
    // Construir filtro
    const filtro = { paciente: pacienteId };
    
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
    
    // Si es médico, filtrar por especialidad o médico específico
    if (req.user.rol === 'medico') {
      const medico = await User.findById(req.user.userId);
      
      // Si no es de categoría 'ambas', filtrar por tratamientos de su especialidad
      if (medico.especialidad !== 'ambas') {
        const tratamientosDeEspecialidad = await Tratamiento.find({ 
          categoria: medico.especialidad 
        }).select('_id');
        
        const idsTratamientos = tratamientosDeEspecialidad.map(t => t._id);
        
        // Filtrar por tratamientos de su especialidad o propias consultas
        filtro.$or = [
          { tratamientoRealizado: { $in: idsTratamientos } },
          { medico: req.user.userId }
        ];
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar historias con paginación
    const historias = await HistoriaClinica.find(filtro)
      .populate('medico', 'nombre apellido especialidad')
      .populate('tratamientoRealizado', 'nombre categoria')
      .populate('cita', 'fechaInicio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de historias para paginación
    const totalHistorias = await HistoriaClinica.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalHistorias / parseInt(limit));
    
    res.json({
      status: 'success',
      paciente: {
        _id: paciente._id,
        nombre: paciente.usuario ? `${paciente.usuario.nombre} ${paciente.usuario.apellido}` : '',
        dni: paciente.dni
      },
      totalHistorias,
      totalPaginas,
      pagina: parseInt(page),
      historias
    });
  } catch (error) {
    console.error('Error al obtener historias del paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener historias clínicas del paciente'
    });
  }
};