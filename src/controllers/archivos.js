// src/controllers/archivos.js
const Archivo = require('../models/archivo');
const Paciente = require('../models/paciente');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const almacenamientoService = require('../services/almacenamiento');

/**
 * @desc    Subir un nuevo archivo
 * @route   POST /api/archivos/upload
 * @access  Privado
 */
exports.subirArchivo = async (req, res) => {
  try {
    // Verificar si se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se ha subido ningún archivo'
      });
    }
    
    const { tipo, paciente, categoria, descripcion, tags, cita } = req.body;
    
    // Verificar que el paciente exista
    const pacienteExistente = await Paciente.findById(paciente);
    
    if (!pacienteExistente) {
      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos (pacientes solo pueden subir archivos para sí mismos)
    if (req.user.rol === 'paciente') {
      const pacienteUsuario = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!pacienteUsuario || pacienteUsuario._id.toString() !== paciente) {
        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
        
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para subir archivos para este paciente'
        });
      }
    }
    
    // Guardar archivo en sistema y BD usando el servicio
    const archivo = await almacenamientoService.guardarArchivo(req.file, {
      tipo,
      paciente,
      subidoPor: req.user.userId,
      cita,
      categoria,
      descripcion,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Archivo subido con éxito',
      archivo: {
        _id: archivo._id,
        nombre: archivo.nombre,
        tipo: archivo.tipo,
        mimeType: archivo.mimeType,
        tamanio: archivo.tamanio,
        categoria: archivo.categoria,
        createdAt: archivo.createdAt
      }
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    
    // Intentar eliminar el archivo temporal si existe
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Error al subir archivo'
    });
  }
};

/**
 * @desc    Obtener archivo por ID
 * @route   GET /api/archivos/:id
 * @access  Privado
 */
exports.obtenerArchivoPorId = async (req, res) => {
  try {
    const archivoId = req.params.id;
    
    // Buscar archivo
    const archivo = await Archivo.findById(archivoId)
      .populate('paciente', 'dni')
      .populate({
        path: 'paciente',
        populate: { path: 'usuario', select: 'nombre apellido' }
      })
      .populate('subidoPor', 'nombre apellido rol')
      .populate('cita', 'fechaInicio');
    
    if (!archivo) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado'
      });
    }
    
    // Verificar si el archivo ha sido eliminado
    if (archivo.fechaEliminacion) {
      return res.status(410).json({
        status: 'error',
        message: 'Este archivo ha sido eliminado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== archivo.paciente._id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a este archivo'
        });
      }
    }
    
    res.json({
      status: 'success',
      archivo: {
        _id: archivo._id,
        nombre: archivo.nombre,
        tipo: archivo.tipo,
        mimeType: archivo.mimeType,
        tamanio: archivo.tamanio,
        ruta: archivo.ruta,
        paciente: archivo.paciente,
        subidoPor: archivo.subidoPor,
        cita: archivo.cita,
        categoria: archivo.categoria,
        descripcion: archivo.descripcion,
        tags: archivo.tags,
        createdAt: archivo.createdAt,
        updatedAt: archivo.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al obtener archivo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del archivo'
    });
  }
};

/**
 * @desc    Descargar archivo
 * @route   GET /api/archivos/:id/download
 * @access  Privado
 */
exports.descargarArchivo = async (req, res) => {
  try {
    const archivoId = req.params.id;
    
    // Buscar archivo
    const archivo = await Archivo.findById(archivoId);
    
    if (!archivo) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado'
      });
    }
    
    // Verificar si el archivo ha sido eliminado
    if (archivo.fechaEliminacion) {
      return res.status(410).json({
        status: 'error',
        message: 'Este archivo ha sido eliminado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente') {
      const paciente = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!paciente || paciente._id.toString() !== archivo.paciente.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para descargar este archivo'
        });
      }
    }
    
    // Construir ruta completa
    const rutaCompleta = path.join(__dirname, '..', archivo.ruta);
    
    // Verificar si el archivo existe en el sistema
    if (!fs.existsSync(rutaCompleta)) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado en el sistema'
      });
    }
    
    // Verificar integridad del archivo si tiene hash
    if (archivo.hash) {
      const buffer = fs.readFileSync(rutaCompleta);
      const hashActual = crypto.createHash('sha256').update(buffer).digest('hex');
      
      if (hashActual !== archivo.hash) {
        console.error(`Error de integridad en archivo ${archivoId}: hash no coincide`);
        
        return res.status(500).json({
          status: 'error',
          message: 'Error de integridad en el archivo'
        });
      }
    }
    
    // Enviar el archivo
    res.download(rutaCompleta, archivo.nombre, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
        
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Error al descargar archivo'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al descargar archivo'
    });
  }
};

/**
 * @desc    Eliminar archivo
 * @route   DELETE /api/archivos/:id
 * @access  Privado (Admin, Médico)
 */
exports.eliminarArchivo = async (req, res) => {
  try {
    const archivoId = req.params.id;
    const eliminacionFisica = req.query.fisica === 'true';
    
    // Solo administradores pueden realizar eliminación física
    if (eliminacionFisica && req.user.rol !== 'administrador') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para realizar eliminación física de archivos'
      });
    }
    
    // Buscar archivo
    const archivo = await Archivo.findById(archivoId);
    
    if (!archivo) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado'
      });
    }
    
    // Verificar si ya está eliminado
    if (archivo.fechaEliminacion && !eliminacionFisica) {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo ya está marcado como eliminado'
      });
    }
    
    // Eliminar archivo usando el servicio
    const resultado = await almacenamientoService.eliminarArchivo(
      archivoId,
      req.user.userId,
      !eliminacionFisica // eliminación lógica por defecto
    );
    
    res.json({
      status: 'success',
      message: `Archivo ${eliminacionFisica ? 'eliminado' : 'marcado como eliminado'} correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar archivo'
    });
  }
};

/**
 * @desc    Obtener archivos de un paciente
 * @route   GET /api/archivos/paciente/:pacienteId
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerArchivosPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const { 
      tipo, categoria, fechaDesde, fechaHasta,
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
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
      const pacienteUsuario = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!pacienteUsuario || pacienteUsuario._id.toString() !== pacienteId) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a los archivos de este paciente'
        });
      }
    }
    
    // Construir filtro
    const filtro = { 
      paciente: pacienteId,
      fechaEliminacion: null // Solo archivos no eliminados
    };
    
    if (tipo) {
      filtro.tipo = tipo;
    }
    
    if (categoria) {
      filtro.categoria = categoria;
    }
    
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
    
    // Buscar archivos con paginación
    const archivos = await Archivo.find(filtro)
      .populate('subidoPor', 'nombre apellido rol')
      .populate('cita', 'fechaInicio estado')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de archivos para paginación
    const totalArchivos = await Archivo.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalArchivos / parseInt(limit));
    
    res.json({
      status: 'success',
      totalArchivos,
      totalPaginas,
      pagina: parseInt(page),
      archivos
    });
  } catch (error) {
    console.error('Error al obtener archivos del paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener archivos del paciente'
    });
  }
};

/**
 * @desc    Subir firma
 * @route   POST /api/archivos/firma
 * @access  Privado
 */
exports.subirFirma = async (req, res) => {
  try {
    // Verificar si se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se ha subido ningún archivo de firma'
      });
    }
    
    const { paciente, documento } = req.body;
    
    // Verificar que el paciente exista
    const pacienteExistente = await Paciente.findById(paciente);
    
    if (!pacienteExistente) {
      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar que el documento exista
    const Documento = mongoose.model('Documento');
    const documentoExistente = await Documento.findById(documento);
    
    if (!documentoExistente) {
      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        status: 'error',
        message: 'Documento no encontrado'
      });
    }
    
    // Verificar permisos (pacientes solo pueden subir firmas para sí mismos)
    if (req.user.rol === 'paciente') {
      const pacienteUsuario = await Paciente.findOne({ usuario: req.user.userId });
      
      if (!pacienteUsuario || pacienteUsuario._id.toString() !== paciente) {
        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
        
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para subir firmas para este paciente'
        });
      }
      
      // Verificar que el documento corresponda al paciente
      if (documentoExistente.paciente.toString() !== paciente) {
        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
        
        return res.status(403).json({
          status: 'error',
          message: 'El documento no corresponde a este paciente'
        });
      }
    }
    
    // Guardar archivo de firma en sistema y BD
    const archivo = await almacenamientoService.guardarArchivo(req.file, {
      tipo: 'firma',
      paciente,
      subidoPor: req.user.userId,
      categoria: 'documento_firmado',
      descripcion: `Firma para documento: ${documentoExistente.titulo}`
    });
    
    // Actualizar documento con la firma
    if (req.user.rol === 'paciente' || req.body.firmante === 'paciente') {
      // Firma del paciente
      documentoExistente.firmaPaciente = {
        fechaFirma: new Date(),
        datosFirma: archivo.ruta, // Guardar ruta del archivo
        ip: req.ip,
        dispositivo: req.headers['user-agent']
      };
      
      if (documentoExistente.firmaMedico?.fechaFirma) {
        documentoExistente.estado = 'completado';
      } else {
        documentoExistente.estado = 'pendiente_firma_medico';
      }
    } else if (req.user.rol === 'medico' || req.body.firmante === 'medico') {
      // Firma del médico
      documentoExistente.firmaMedico = {
        fechaFirma: new Date(),
        datosFirma: archivo.ruta, // Guardar ruta del archivo
        ip: req.ip
      };
      
      if (documentoExistente.firmaPaciente?.fechaFirma) {
        documentoExistente.estado = 'completado';
      } else {
        documentoExistente.estado = 'pendiente_firma_paciente';
      }
    }
    
    await documentoExistente.save();
    
    // Asociar el archivo al documento
    documentoExistente.archivos.push(archivo._id);
    await documentoExistente.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Firma subida y registrada con éxito',
      archivo: {
        _id: archivo._id,
        nombre: archivo.nombre,
        createdAt: archivo.createdAt
      },
      documento: {
        _id: documentoExistente._id,
        titulo: documentoExistente.titulo,
        estado: documentoExistente.estado
      }
    });
  } catch (error) {
    console.error('Error al subir firma:', error);
    
    // Intentar eliminar el archivo temporal si existe
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Error al subir firma'
    });
  }
};