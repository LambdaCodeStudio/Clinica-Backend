// src/controllers/pacientes.js
const Paciente = require('../models/paciente');
const User = require('../models/user');
const HistoriaClinica = require('../models/historiaClinica');
const Documento = require('../models/documento');
const Cita = require('../models/cita');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los pacientes
 * @route   GET /api/pacientes
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.obtenerPacientes = async (req, res) => {
  try {
    const { 
      nombre, apellido, dni, email, 
      fechaDesde, fechaHasta, 
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (dni) {
      filtro.dni = { $regex: dni, $options: 'i' };
    }
    
    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.createdAt.$lte = new Date(fechaHasta);
      }
    }
    
    // Buscar primero en la colección de usuarios si se filtró por nombre, apellido o email
    if (nombre || apellido || email) {
      const filtroUsuario = {};
      
      if (nombre) {
        filtroUsuario.nombre = { $regex: nombre, $options: 'i' };
      }
      
      if (apellido) {
        filtroUsuario.apellido = { $regex: apellido, $options: 'i' };
      }
      
      if (email) {
        filtroUsuario.email = { $regex: email, $options: 'i' };
      }
      
      // Solo pacientes
      filtroUsuario.rol = 'paciente';
      
      const usuarios = await User.find(filtroUsuario).select('_id');
      const usuarioIds = usuarios.map(user => user._id);
      
      // Añadir al filtro de pacientes
      if (usuarioIds.length > 0) {
        filtro.usuario = { $in: usuarioIds };
      } else {
        // Si la búsqueda de usuarios no devuelve resultados, asegurar búsqueda vacía
        return res.json({
          status: 'success',
          totalPacientes: 0,
          totalPaginas: 0,
          pagina: parseInt(page),
          pacientes: []
        });
      }
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Buscar pacientes con paginación
    const pacientes = await Paciente.find(filtro)
      .populate('usuario', 'nombre apellido email telefono')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de pacientes para paginación
    const totalPacientes = await Paciente.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalPacientes / parseInt(limit));
    
    res.json({
      status: 'success',
      totalPacientes,
      totalPaginas,
      pagina: parseInt(page),
      pacientes
    });
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de pacientes'
    });
  }
};

/**
 * @desc    Crear un nuevo paciente
 * @route   POST /api/pacientes
 * @access  Privado (Admin, Médico, Secretaria)
 */
exports.crearPaciente = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      nombre, apellido, email, password, telefono,
      dni, fechaNacimiento, genero, direccion,
      grupoSanguineo, alergias, condicionesMedicas, medicacionActual,
      contactoEmergencia, preferencias, notas
    } = req.body;
    
    // Verificar si ya existe un paciente con el mismo DNI
    const pacienteExistente = await Paciente.findOne({ dni });
    
    if (pacienteExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un paciente con ese DNI'
      });
    }
    
    // Verificar si ya existe un usuario con el mismo email
    const emailExistente = await User.findOne({ email });
    
    if (emailExistente) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }
    
    // Crear usuario
    const nuevoUsuario = new User({
      nombre,
      apellido,
      email,
      password: password || Math.random().toString(36).slice(-8), // Generar contraseña aleatoria si no se proporciona
      telefono,
      rol: 'paciente'
    });
    
    await nuevoUsuario.save({ session });
    
    // Crear paciente
    const nuevoPaciente = new Paciente({
      usuario: nuevoUsuario._id,
      dni,
      fechaNacimiento,
      genero,
      direccion,
      grupoSanguineo: grupoSanguineo || 'desconocido',
      alergias: alergias || [],
      condicionesMedicas: condicionesMedicas || [],
      medicacionActual: medicacionActual || [],
      contactoEmergencia: contactoEmergencia || {},
      preferencias: preferencias || {
        recordatoriosSMS: true,
        recordatoriosEmail: true,
        recibirPromociones: false
      },
      notas
    });
    
    await nuevoPaciente.save({ session });
    
    // Si se generó contraseña automática, enviar email
    if (!password) {
      // Aquí se implementaría el envío de email con la contraseña
    }
    
    await session.commitTransaction();
    
    res.status(201).json({
      status: 'success',
      message: 'Paciente creado con éxito',
      paciente: {
        ...nuevoPaciente.toObject(),
        usuario: {
          _id: nuevoUsuario._id,
          nombre: nuevoUsuario.nombre,
          apellido: nuevoUsuario.apellido,
          email: nuevoUsuario.email,
          telefono: nuevoUsuario.telefono
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error al crear paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el paciente'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Obtener paciente por ID
 * @route   GET /api/pacientes/:id
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
exports.obtenerPacientePorId = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    
    // Verificar permisos
    if (req.user.rol === 'paciente' && req.user.userId !== pacienteId) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a estos datos'
      });
    }
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId)
      .populate('usuario', 'nombre apellido email telefono activo ultimoAcceso');
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      paciente
    });
  } catch (error) {
    console.error('Error al obtener paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del paciente'
    });
  }
};

/**
 * @desc    Actualizar paciente
 * @route   PUT /api/pacientes/:id
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
exports.actualizarPaciente = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const pacienteId = req.params.id;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente' && req.user.userId !== paciente.usuario.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para modificar estos datos'
      });
    }
    
    // Extraer datos a actualizar
    const {
      // Datos del usuario
      nombre, apellido, email, telefono,
      // Datos del paciente
      dni, fechaNacimiento, genero, direccion,
      grupoSanguineo, alergias, condicionesMedicas, medicacionActual,
      contactoEmergencia, preferencias, notas
    } = req.body;
    
    // Si se proporcionó un nuevo DNI, verificar que no esté en uso
    if (dni && dni !== paciente.dni) {
      const dniExistente = await Paciente.findOne({ dni });
      
      if (dniExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'El DNI ya está registrado para otro paciente'
        });
      }
    }
    
    // Actualizar datos del usuario
    if (nombre || apellido || email || telefono) {
      const usuario = await User.findById(paciente.usuario);
      
      if (!usuario) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }
      
      // Si se proporcionó un nuevo email, verificar que no esté en uso
      if (email && email !== usuario.email) {
        const emailExistente = await User.findOne({ email });
        
        if (emailExistente) {
          return res.status(400).json({
            status: 'error',
            message: 'El email ya está registrado'
          });
        }
      }
      
      // Actualizar campos del usuario
      if (nombre) usuario.nombre = nombre;
      if (apellido) usuario.apellido = apellido;
      if (email) usuario.email = email;
      if (telefono) usuario.telefono = telefono;
      
      await usuario.save({ session });
    }
    
    // Actualizar datos del paciente
    if (dni) paciente.dni = dni;
    if (fechaNacimiento) paciente.fechaNacimiento = fechaNacimiento;
    if (genero) paciente.genero = genero;
    if (direccion) paciente.direccion = direccion;
    if (grupoSanguineo) paciente.grupoSanguineo = grupoSanguineo;
    if (alergias) paciente.alergias = alergias;
    if (condicionesMedicas) paciente.condicionesMedicas = condicionesMedicas;
    if (medicacionActual) paciente.medicacionActual = medicacionActual;
    if (contactoEmergencia) paciente.contactoEmergencia = contactoEmergencia;
    if (preferencias) paciente.preferencias = preferencias;
    if (notas) paciente.notas = notas;
    
    await paciente.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      status: 'success',
      message: 'Datos del paciente actualizados correctamente',
      paciente: await Paciente.findById(pacienteId).populate('usuario', 'nombre apellido email telefono')
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar datos del paciente'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Obtener historias clínicas de un paciente
 * @route   GET /api/pacientes/:id/historias
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerHistoriasClinicas = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente' && req.user.userId !== paciente.usuario.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a estos datos'
      });
    }
    
    // Extraer filtros de query
    const { 
      fechaDesde, fechaHasta, 
      medico, tratamiento,
      page = 1, limit = 10 
    } = req.query;
    
    // Construir filtro
    const filtro = { paciente: pacienteId };
    
    if (fechaDesde || fechaHasta) {
      filtro.createdAt = {};
      
      if (fechaDesde) {
        filtro.createdAt.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.createdAt.$lte = new Date(fechaHasta);
      }
    }
    
    if (medico) {
      filtro.medico = medico;
    }
    
    if (tratamiento) {
      filtro.tratamientoRealizado = tratamiento;
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar historias clínicas
    const historias = await HistoriaClinica.find(filtro)
      .populate('medico', 'nombre apellido')
      .populate('tratamientoRealizado', 'nombre categoria')
      .populate('cita', 'fechaInicio fechaFin')
      .select('-documentos.archivoId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total para paginación
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
      message: 'Error al obtener historias clínicas'
    });
  }
};

/**
 * @desc    Obtener documentos de un paciente
 * @route   GET /api/pacientes/:id/documentos
 * @access  Privado (Admin, Médico, Paciente propio)
 */
exports.obtenerDocumentosPaciente = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente' && req.user.userId !== paciente.usuario.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a estos datos'
      });
    }
    
    // Extraer filtros de query
    const { 
      tipo, estado, 
      fechaDesde, fechaHasta, 
      medico,
      page = 1, limit = 10 
    } = req.query;
    
    // Construir filtro
    const filtro = { paciente: pacienteId };
    
    if (tipo) {
      filtro.tipo = tipo;
    }
    
    if (estado) {
      filtro.estado = estado;
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
    
    if (medico) {
      filtro.medico = medico;
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar documentos
    const documentos = await Documento.find(filtro)
      .populate('medico', 'nombre apellido')
      .populate('cita', 'fechaInicio fechaFin')
      .populate('template', 'nombre tipo')
      .select('-firmaPaciente.datosFirma -firmaMedico.datosFirma')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total para paginación
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
      message: 'Error al obtener documentos del paciente'
    });
  }
};

/**
 * @desc    Obtener citas de un paciente
 * @route   GET /api/pacientes/:id/citas
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
exports.obtenerCitasPaciente = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Verificar permisos
    if (req.user.rol === 'paciente' && req.user.userId !== paciente.usuario.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a estos datos'
      });
    }
    
    // Extraer filtros de query
    const { 
      estado, 
      fechaDesde, fechaHasta, 
      medico, tratamiento,
      page = 1, limit = 10 
    } = req.query;
    
    // Construir filtro
    const filtro = { paciente: pacienteId };
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (fechaDesde || fechaHasta) {
      filtro.fechaInicio = {};
      
      if (fechaDesde) {
        filtro.fechaInicio.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.fechaInicio.$lte = new Date(fechaHasta);
      }
    }
    
    if (medico) {
      filtro.medico = medico;
    }
    
    if (tratamiento) {
      filtro.tratamiento = tratamiento;
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Buscar citas
    const citas = await Cita.find(filtro)
      .populate('medico', 'nombre apellido')
      .populate('tratamiento', 'nombre categoria precio')
      .sort({ fechaInicio: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total para paginación
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
      message: 'Error al obtener citas del paciente'
    });
  }
};

/**
 * @desc    Actualizar alergias del paciente
 * @route   PUT /api/pacientes/:id/alergias
 * @access  Privado (Admin, Médico)
 */
exports.actualizarAlergias = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    const { alergias } = req.body;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Actualizar alergias
    paciente.alergias = alergias;
    await paciente.save();
    
    res.json({
      status: 'success',
      message: 'Alergias actualizadas correctamente',
      alergias: paciente.alergias
    });
  } catch (error) {
    console.error('Error al actualizar alergias:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar alergias del paciente'
    });
  }
};

/**
 * @desc    Actualizar condiciones médicas del paciente
 * @route   PUT /api/pacientes/:id/condiciones
 * @access  Privado (Admin, Médico)
 */
exports.actualizarCondiciones = async (req, res) => {
  try {
    const pacienteId = req.params.id;
    const { condicionesMedicas } = req.body;
    
    // Buscar paciente
    const paciente = await Paciente.findById(pacienteId);
    
    if (!paciente) {
      return res.status(404).json({
        status: 'error',
        message: 'Paciente no encontrado'
      });
    }
    
    // Actualizar condiciones médicas
    paciente.condicionesMedicas = condicionesMedicas;
    await paciente.save();
    
    res.json({
      status: 'success',
      message: 'Condiciones médicas actualizadas correctamente',
      condicionesMedicas: paciente.condicionesMedicas
    });
  } catch (error) {
    console.error('Error al actualizar condiciones médicas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar condiciones médicas del paciente'
    });
  }
};