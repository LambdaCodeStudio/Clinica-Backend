// src/controllers/documentos.js
const mongoose = require('mongoose');
const DocumentoTemplate = require('../models/documentoTemplate');
const Documento = mongoose.model('Documento');
const Paciente = require('../models/paciente');
const User = require('../models/user');
const Archivo = require('../models/archivo');
const pdfService = require('../services/pdf');
const firmaDigitalService = require('../services/firmaDigital');
const emailService = require('../services/email');
const path = require('path');
const fs = require('fs');

/**
 * @desc    Obtener todas las plantillas de documentos
 * @route   GET /api/documentos/templates
 * @access  Privado (Admin, Médico)
 */
exports.obtenerTemplates = async (req, res) => {
  try {
    const { 
      tipo, categoria, activo,
      page = 1, limit = 10,
      ordenarPor = 'nombre', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (tipo) {
      filtro.tipo = tipo;
    }
    
    if (categoria) {
      // Si el médico tiene una especialidad específica, mostrar solo plantillas de esa categoría o generales
      if (req.user.rol === 'medico' && req.user.especialidad && req.user.especialidad !== 'ambas') {
        filtro.$or = [
          { categoria: req.user.especialidad },
          { categoria: 'general' }
        ];
      } else {
        filtro.categoria = categoria;
      }
    }
    
    if (activo !== undefined) {
      filtro.activo = activo === 'true';
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar plantillas con paginación
    const templates = await DocumentoTemplate.find(filtro)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de plantillas para paginación
    const totalTemplates = await DocumentoTemplate.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalTemplates / parseInt(limit));
    
    res.json({
      status: 'success',
      totalTemplates,
      totalPaginas,
      pagina: parseInt(page),
      templates
    });
  } catch (error) {
    console.error('Error al obtener plantillas de documentos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las plantillas de documentos'
    });
  }
};

/**
 * @desc    Crear nueva plantilla de documento
 * @route   POST /api/documentos/templates
 * @access  Privado (Admin)
 */
exports.crearTemplate = async (req, res) => {
  try {
    const { 
      nombre, tipo, categoria, contenido, 
      variables, requiereFirma, requiereFirmaMedico, 
      version, activo, nota
    } = req.body;
    
    // Verificar si ya existe una plantilla con el mismo nombre y tipo
    const templateExistente = await DocumentoTemplate.findOne({ 
      nombre, 
      tipo
    });
    
    if (templateExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe una plantilla con ese nombre y tipo'
      });
    }
    
    // Crear nueva plantilla
    const nuevaPlantilla = new DocumentoTemplate({
      nombre,
      tipo,
      categoria,
      contenido,
      variables: variables || [],
      requiereFirma: requiereFirma !== false, // Por defecto true
      requiereFirmaMedico: requiereFirmaMedico !== false, // Por defecto true
      version: version || '1.0',
      activo: activo !== false, // Por defecto true
      nota
    });
    
    await nuevaPlantilla.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Plantilla de documento creada con éxito',
      template: nuevaPlantilla
    });
  } catch (error) {
    console.error('Error al crear plantilla de documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear plantilla de documento'
    });
  }
};

/**
 * @desc    Obtener plantilla por ID
 * @route   GET /api/documentos/templates/:id
 * @access  Privado (Admin, Médico)
 */
exports.obtenerTemplatePorId = async (req, res) => {
  try {
    const templateId = req.params.id;
    
    // Buscar plantilla
    const template = await DocumentoTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({
        status: 'error',
        message: 'Plantilla de documento no encontrada'
      });
    }
    
    // Verificar permisos para médicos según especialidad
    if (req.user.rol === 'medico' && template.categoria !== 'general') {
      const medico = await User.findById(req.user.userId);
      
      // Si el médico tiene especialidad específica y no coincide con la plantilla
      if (medico.especialidad !== 'ambas' && medico.especialidad !== template.categoria) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a esta plantilla'
        });
      }
    }
    
    res.json({
      status: 'success',
      template
    });
  } catch (error) {
    console.error('Error al obtener plantilla de documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información de la plantilla'
    });
  }
};

/**
 * @desc    Actualizar plantilla
 * @route   PUT /api/documentos/templates/:id
 * @access  Privado (Admin)
 */
exports.actualizarTemplate = async (req, res) => {
  try {
    const templateId = req.params.id;
    
    // Buscar plantilla
    const template = await DocumentoTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({
        status: 'error',
        message: 'Plantilla de documento no encontrada'
      });
    }
    
    // Verificar si se quiere actualizar nombre y tipo, y si ya existe otra con esos valores
    if (req.body.nombre && req.body.tipo && 
        (req.body.nombre !== template.nombre || req.body.tipo !== template.tipo)) {
      
      const templateExistente = await DocumentoTemplate.findOne({ 
        nombre: req.body.nombre, 
        tipo: req.body.tipo,
        _id: { $ne: templateId }
      });
      
      if (templateExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'Ya existe otra plantilla con ese nombre y tipo'
        });
      }
    }
    
    // Campos actualizables
    const camposActualizables = [
      'nombre', 'tipo', 'categoria', 'contenido',
      'variables', 'requiereFirma', 'requiereFirmaMedico',
      'version', 'activo', 'nota'
    ];
    
    // Actualizar solo los campos permitidos
    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        template[campo] = req.body[campo];
      }
    });
    
    // Si se actualiza el contenido, incrementar la versión
    if (req.body.contenido) {
      // Extraer componentes de la versión actual (major.minor)
      const [major, minor] = template.version.split('.').map(Number);
      
      // Incrementar versión minor
      template.version = `${major}.${minor + 1}`;
    }
    
    await template.save();
    
    res.json({
      status: 'success',
      message: 'Plantilla de documento actualizada correctamente',
      template
    });
  } catch (error) {
    console.error('Error al actualizar plantilla de documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar plantilla de documento'
    });
  }
};

/**
 * @desc    Obtener todos los documentos (con filtros)
 * @route   GET /api/documentos
 * @access  Privado (Admin, Médico)
 */
exports.obtenerDocumentos = async (req, res) => {
  try {
    const { 
      paciente, medico, tipo, estado,
      fechaDesde, fechaHasta,
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (paciente) {
      filtro.paciente = paciente;
    }
    
    // Si es médico, mostrar solo sus documentos
    if (req.user.rol === 'medico') {
      filtro.medico = req.user.userId;
    } else if (medico) {
      filtro.medico = medico;
    }
    
    if (tipo) {
      filtro.tipo = tipo;
    }
    
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
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar documentos con paginación y populate
    const documentos = await Documento.find(filtro)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('cita', 'fechaInicio')
      .populate('template', 'nombre tipo')
      .select('-firmaPaciente.datosFirma -firmaMedico.datosFirma') // No enviar datos de firma por seguridad
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de documentos para paginación
    const totalDocumentos = await Documento.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalDocumentos / parseInt(limit));
    
    res.json({
      status: 'success',
      totalDocumentos,
      totalPaginas,
      pagina: parseInt(page),
      documentos
    });
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de documentos'
    });
  }
};

/**
 * @desc    Crear nuevo documento
 * @route   POST /api/documentos
 * @access  Privado (Médico)
 */
exports.crearDocumento = async (req, res) => {
  try {
    const { 
      paciente, tipo, titulo, contenido,
      template, cita, vigenciaHasta, notas
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
    
    // Si se especificó una plantilla, verificar que exista
    let templateInfo = null;
    if (template) {
      templateInfo = await DocumentoTemplate.findById(template);
      
      if (!templateInfo) {
        return res.status(404).json({
          status: 'error',
          message: 'Plantilla de documento no encontrada'
        });
      }
    }
    
    // Crear nuevo documento
    const nuevoDocumento = new Documento({
      paciente,
      medico: req.user.userId,
      cita: cita || null,
      template: template || null,
      tipo,
      titulo,
      contenido: contenido || (templateInfo ? templateInfo.contenido : ''),
      estado: 'borrador',
      vigenciaHasta: vigenciaHasta || null,
      notas
    });
    
    // Configurar estado inicial según plantilla
    if (templateInfo) {
      if (templateInfo.requiereFirma && templateInfo.requiereFirmaMedico) {
        nuevoDocumento.estado = 'pendiente_firma_paciente';
      } else if (templateInfo.requiereFirma) {
        nuevoDocumento.estado = 'pendiente_firma_paciente';
      } else if (templateInfo.requiereFirmaMedico) {
        nuevoDocumento.estado = 'pendiente_firma_medico';
      } else {
        nuevoDocumento.estado = 'completado';
      }
    }
    
    await nuevoDocumento.save();
    
    // Poblar datos para la respuesta
    const documentoCreado = await Documento.findById(nuevoDocumento._id)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('template', 'nombre tipo');
    
    res.status(201).json({
      status: 'success',
      message: 'Documento creado con éxito',
      documento: documentoCreado
    });
  } catch (error) {
    console.error('Error al crear documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear documento'
    });
  }
};

/**
 * @desc    Obtener documento por ID
 * @route   GET /api/documentos/:id
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerDocumentoPorId = async (req, res) => {
  try {
    const documentoId = req.params.id;
    
    // Buscar documento con populate completo
    const documento = await Documento.findById(documentoId)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad')
      .populate('cita', 'fechaInicio fechaFin')
      .populate('template', 'nombre tipo categoria')
      .populate('archivos');
    
    if (!documento) {
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo del documento
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== documento.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a este documento'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== documento.medico._id.toString()) {
      // Si es médico, solo puede ver sus propios documentos o de su especialidad
      const medico = await User.findById(req.user.userId);
      const especialidadDocumento = documento.template?.categoria || 'general';
      
      if (medico.especialidad !== 'ambas' && medico.especialidad !== especialidadDocumento) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a este documento'
        });
      }
    }
    
    // No incluir los datos biométricos de las firmas en la respuesta
    const respuesta = documento.toObject();
    if (respuesta.firmaPaciente) {
      delete respuesta.firmaPaciente.datosFirma;
    }
    if (respuesta.firmaMedico) {
      delete respuesta.firmaMedico.datosFirma;
    }
    
    res.json({
      status: 'success',
      documento: respuesta
    });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del documento'
    });
  }
};

/**
 * @desc    Actualizar documento
 * @route   PUT /api/documentos/:id
 * @access  Privado (Médico)
 */
exports.actualizarDocumento = async (req, res) => {
  try {
    const documentoId = req.params.id;
    
    // Buscar documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar permisos (solo el médico que lo creó puede modificarlo)
    if (req.user.userId !== documento.medico.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para modificar este documento'
      });
    }
    
    // Verificar que el documento no esté en estado completado o anulado
    if (['completado', 'anulado'].includes(documento.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede modificar un documento en estado ${documento.estado}`
      });
    }
    
    // Campos actualizables
    const camposActualizables = [
      'titulo', 'contenido', 'vigenciaHasta', 'notas'
    ];
    
    // Actualizar solo los campos permitidos
    camposActualizables.forEach(campo => {
      if (req.body[campo] !== undefined) {
        documento[campo] = req.body[campo];
      }
    });
    
    // El estado solo puede ser actualizado según reglas específicas
    if (req.body.estado) {
      // Validar transiciones de estado permitidas
      const transicionesPermitidas = {
        'borrador': ['pendiente_firma_paciente', 'pendiente_firma_medico', 'anulado'],
        'pendiente_firma_paciente': ['borrador', 'pendiente_firma_medico', 'anulado'],
        'pendiente_firma_medico': ['borrador', 'pendiente_firma_paciente', 'anulado']
      };
      
      if (!transicionesPermitidas[documento.estado] || 
          !transicionesPermitidas[documento.estado].includes(req.body.estado)) {
        return res.status(400).json({
          status: 'error',
          message: `No se puede cambiar el estado de ${documento.estado} a ${req.body.estado}`
        });
      }
      
      documento.estado = req.body.estado;
    }
    
    await documento.save();
    
    res.json({
      status: 'success',
      message: 'Documento actualizado correctamente',
      documento: {
        _id: documento._id,
        titulo: documento.titulo,
        estado: documento.estado,
        updatedAt: documento.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar documento'
    });
  }
};

/**
 * @desc    Registrar firma del paciente
 * @route   POST /api/documentos/:id/firma-paciente
 * @access  Privado (Paciente o Médico)
 */
exports.firmarPaciente = async (req, res) => {
  try {
    const documentoId = req.params.id;
    const { datosFirma } = req.body;
    
    // Buscar documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar que el documento esté pendiente de firma del paciente
    if (documento.estado !== 'pendiente_firma_paciente' && documento.estado !== 'borrador') {
      return res.status(400).json({
        status: 'error',
        message: `El documento no está pendiente de firma del paciente, estado actual: ${documento.estado}`
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el correcto
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== documento.paciente.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para firmar este documento'
        });
      }
    }
    
    // Procesar y registrar firma
    try {
      const metadatos = {
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      };
      
      // Si es una imagen de firma, procesarla
      if (datosFirma.startsWith('data:image')) {
        // Guardar en el sistema con servicio de firma digital
        const registroFirma = await firmaDigitalService.procesarFirma(
          datosFirma,
          documento.paciente.toString(),
          documento._id.toString(),
          metadatos
        );
        
        // Actualizar documento con la firma
        documento.firmaPaciente = {
          fechaFirma: new Date(),
          datosFirma: registroFirma.datosFirma,
          ip: metadatos.ip,
          dispositivo: metadatos.dispositivo
        };
      } else {
        // Si no es imagen, generar firma digital basada en texto
        const nombrePaciente = (await Paciente.findById(documento.paciente))?.usuario?.nombre || '';
        const firmaGenerada = await firmaDigitalService.crearFirma(nombrePaciente);
        
        documento.firmaPaciente = {
          fechaFirma: new Date(),
          datosFirma: firmaGenerada,
          ip: metadatos.ip,
          dispositivo: metadatos.dispositivo
        };
      }
      
      // Actualizar estado del documento
      if (documento.firmaMedico && documento.firmaMedico.fechaFirma) {
        documento.estado = 'completado';
      } else {
        documento.estado = 'pendiente_firma_medico';
      }
      
      await documento.save();
      
      res.json({
        status: 'success',
        message: 'Documento firmado correctamente por el paciente',
        documento: {
          _id: documento._id,
          titulo: documento.titulo,
          estado: documento.estado,
          firmaPaciente: {
            fechaFirma: documento.firmaPaciente.fechaFirma
          }
        }
      });
    } catch (error) {
      console.error('Error al procesar firma:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error al procesar firma'
      });
    }
  } catch (error) {
    console.error('Error al firmar documento por paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al firmar documento'
    });
  }
};

/**
 * @desc    Registrar firma del médico
 * @route   POST /api/documentos/:id/firma-medico
 * @access  Privado (Médico)
 */
exports.firmarMedico = async (req, res) => {
  try {
    const documentoId = req.params.id;
    const { datosFirma } = req.body;
    
    // Buscar documento
    const documento = await Documento.findById(documentoId);
    
    if (!documento) {
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar que el documento esté pendiente de firma del médico
    if (documento.estado !== 'pendiente_firma_medico' && documento.estado !== 'borrador') {
      return res.status(400).json({
        status: 'error',
        message: `El documento no está pendiente de firma del médico, estado actual: ${documento.estado}`
      });
    }
    
    // Verificar que sea el médico correcto
    if (req.user.userId !== documento.medico.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para firmar este documento'
      });
    }
    
    // Procesar y registrar firma
    try {
      const metadatos = {
        ip: req.ip
      };
      
      // Si es una imagen de firma, procesarla
      if (datosFirma.startsWith('data:image')) {
        // Guardar en el sistema con servicio de firma digital
        const registroFirma = await firmaDigitalService.procesarFirma(
          datosFirma,
          documento.paciente.toString(),
          documento._id.toString(),
          metadatos
        );
        
        // Actualizar documento con la firma
        documento.firmaMedico = {
          fechaFirma: new Date(),
          datosFirma: registroFirma.datosFirma,
          ip: metadatos.ip
        };
      } else {
        // Si no es imagen, generar firma digital basada en texto
        const medico = await User.findById(documento.medico);
        const nombreMedico = medico ? `${medico.nombre} ${medico.apellido}` : '';
        const firmaGenerada = await firmaDigitalService.crearFirma(nombreMedico);
        
        documento.firmaMedico = {
          fechaFirma: new Date(),
          datosFirma: firmaGenerada,
          ip: metadatos.ip
        };
      }
      
      // Actualizar estado del documento
      if (documento.firmaPaciente && documento.firmaPaciente.fechaFirma) {
        documento.estado = 'completado';
        
        // Enviar notificación al paciente si el documento está completado
        try {
          const paciente = await Paciente.findById(documento.paciente)
            .populate('usuario');
          
          if (paciente && paciente.usuario && paciente.usuario.email) {
            // Generar PDF del documento
            const directorioTemp = path.join(__dirname, '../temp');
            if (!fs.existsSync(directorioTemp)) {
              fs.mkdirSync(directorioTemp, { recursive: true });
            }
            
            const nombreArchivo = `documento_${documento._id}_${Date.now()}.pdf`;
            const rutaPDF = path.join(directorioTemp, nombreArchivo);
            
            await pdfService.generarDocumentoPDF(documento, rutaPDF);
            
            // Crear objeto de archivo para adjuntar
            const adjunto = {
              nombre: `${documento.titulo}.pdf`,
              ruta: rutaPDF,
              mimeType: 'application/pdf'
            };
            
            // Enviar email con el documento firmado
            await emailService.enviarDocumentoFirmado(
              paciente.usuario.email,
              paciente.usuario.nombre,
              documento,
              adjunto
            );
            
            // Eliminar archivo temporal después de enviarlo
            setTimeout(() => {
              fs.unlink(rutaPDF, (err) => {
                if (err) {
                  console.error('Error al eliminar archivo temporal:', err);
                }
              });
            }, 5000);
          }
        } catch (notificacionError) {
          console.error('Error al enviar notificación:', notificacionError);
          // Continuar el proceso aunque falle la notificación
        }
      } else {
        documento.estado = 'pendiente_firma_paciente';
      }
      
      await documento.save();
      
      res.json({
        status: 'success',
        message: 'Documento firmado correctamente por el médico',
        documento: {
          _id: documento._id,
          titulo: documento.titulo,
          estado: documento.estado,
          firmaMedico: {
            fechaFirma: documento.firmaMedico.fechaFirma
          }
        }
      });
    } catch (error) {
      console.error('Error al procesar firma:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error al procesar firma'
      });
    }
  } catch (error) {
    console.error('Error al firmar documento por médico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al firmar documento'
    });
  }
};

/**
 * @desc    Generar PDF del documento
 * @route   GET /api/documentos/:id/pdf
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.generarPDF = async (req, res) => {
  try {
    const documentoId = req.params.id;
    
    // Buscar documento con populate completo
    const documento = await Documento.findById(documentoId)
      .populate('paciente')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido email telefono' }
      })
      .populate('medico', 'nombre apellido especialidad matriculaProfesional')
      .populate('cita', 'fechaInicio fechaFin')
      .populate('template');
    
    if (!documento) {
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      // Verificar que el paciente sea el mismo del documento
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== documento.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a este documento'
        });
      }
    } else if (req.user.rol === 'medico' && req.user.userId !== documento.medico._id.toString()) {
      // Si es médico, verificar que sea el médico del documento
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a este documento'
      });
    }
    
    // Directorio para archivos temporales
    const directorioTemp = path.join(__dirname, '../temp');
    if (!fs.existsSync(directorioTemp)) {
      fs.mkdirSync(directorioTemp, { recursive: true });
    }
    
    // Nombre del archivo PDF
    const nombreArchivo = `documento_${documento._id}_${Date.now()}.pdf`;
    const rutaPDF = path.join(directorioTemp, nombreArchivo);
    
    // Generar PDF
    await pdfService.generarDocumentoPDF(documento, rutaPDF);
    
    // Enviar archivo al cliente
    res.download(rutaPDF, `${documento.titulo}.pdf`, (err) => {
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
    console.error('Error al generar PDF de documento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar PDF de documento'
    });
  }
};