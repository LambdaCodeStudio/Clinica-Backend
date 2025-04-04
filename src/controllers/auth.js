// src/controllers/auth.js
const User = require('../models/user');
const Paciente = require('../models/paciente');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const emailService = require('../services/email');

/**
 * @desc    Registrar un nuevo usuario
 * @route   POST /api/auth/register
 * @access  Público para pacientes, Privado para otros roles
 */
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol, especialidad, telefono, matriculaProfesional } = req.body;
    
    // Verificar si el usuario ya existe
    let usuario = await User.findOne({ email });
    if (usuario) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }
    
    // Crear nuevo usuario
    usuario = new User({
      nombre,
      apellido,
      email,
      password,
      rol,
      telefono,
      especialidad: rol === 'medico' ? especialidad : '',
      matriculaProfesional: rol === 'medico' ? matriculaProfesional : undefined
    });
    
    await usuario.save();
    
    // Si es un paciente, crear el registro correspondiente
    if (rol === 'paciente' && req.body.datosPaciente) {
      const datosPaciente = req.body.datosPaciente;
      
      const paciente = new Paciente({
        usuario: usuario._id,
        dni: datosPaciente.dni,
        fechaNacimiento: datosPaciente.fechaNacimiento,
        genero: datosPaciente.genero,
        direccion: datosPaciente.direccion,
        grupoSanguineo: datosPaciente.grupoSanguineo || 'desconocido',
        alergias: datosPaciente.alergias || [],
        condicionesMedicas: datosPaciente.condicionesMedicas || [],
        medicacionActual: datosPaciente.medicacionActual || [],
        contactoEmergencia: datosPaciente.contactoEmergencia || {},
        preferencias: datosPaciente.preferencias || {
          recordatoriosSMS: true,
          recordatoriosEmail: true,
          recibirPromociones: false
        }
      });
      
      await paciente.save();
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { userId: usuario._id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    
    // Establecer cookie con el token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 día
    });
    
    // Registrar último acceso
    usuario.ultimoAcceso = new Date();
    await usuario.save();
    
    // Respuesta exitosa
    res.status(201).json({
      status: 'success',
      message: 'Usuario registrado con éxito',
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol
      },
      token
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al registrar usuario', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Iniciar sesión y obtener token
 * @route   POST /api/auth/login
 * @access  Público
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar si el usuario existe
    const usuario = await User.findOne({ email });
    
    if (!usuario) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales no válidas'
      });
    }
    
    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(401).json({
        status: 'error',
        message: 'Esta cuenta ha sido desactivada. Contacte al administrador.'
      });
    }
    
    // Verificar si la cuenta está bloqueada
    if (usuario.estaBloqueado()) {
      return res.status(401).json({
        status: 'error',
        message: `Cuenta bloqueada temporalmente. Intente nuevamente después de ${new Date(usuario.bloqueadoHasta).toLocaleString()}`
      });
    }
    
    // Verificar la contraseña
    const isMatch = await usuario.compararPassword(password);
    
    if (!isMatch) {
      // Registrar intento fallido
      await usuario.registrarIntentoFallido();
      
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales no válidas'
      });
    }
    
    // Reiniciar contador de intentos fallidos
    await usuario.reiniciarIntentos();
    
    // Generar token JWT
    const token = jwt.sign(
      { userId: usuario._id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    
    // Establecer cookie con el token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 día
    });
    
    // Actualizar último acceso
    usuario.ultimoAcceso = new Date();
    await usuario.save();
    
    // Respuesta exitosa
    res.json({
      status: 'success',
      message: 'Inicio de sesión exitoso',
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol
      },
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al iniciar sesión', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Obtener información del usuario actual
 * @route   GET /api/auth/me
 * @access  Privado
 */
exports.getMe = async (req, res) => {
  try {
    const usuario = await User.findById(req.user.userId).select('-password');
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Si es un paciente, obtener datos adicionales
    let datosPaciente = null;
    if (usuario.rol === 'paciente') {
      datosPaciente = await Paciente.findOne({ usuario: usuario._id }).select('-__v');
    }
    
    res.json({
      status: 'success',
      usuario,
      paciente: datosPaciente
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al obtener información del usuario' 
    });
  }
};

/**
 * @desc    Cambiar contraseña
 * @route   PUT /api/auth/password
 * @access  Privado
 */
exports.cambiarPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Buscar usuario
    const usuario = await User.findById(req.user.userId);
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar contraseña actual
    const isMatch = await usuario.compararPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña actual no es correcta'
      });
    }
    
    // Actualizar contraseña
    usuario.password = newPassword;
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al cambiar contraseña' 
    });
  }
};

/**
 * @desc    Solicitar recuperación de contraseña
 * @route   POST /api/auth/recovery
 * @access  Público
 */
exports.solicitarRecuperacion = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Buscar usuario por email
    const usuario = await User.findOne({ email });
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'No existe un usuario con ese email'
      });
    }
    
    // Generar token de recuperación
    const token = crypto.randomBytes(32).toString('hex');
    
    // Guardar token y fecha de expiración
    usuario.tokenRecuperacion = token;
    usuario.expiracionToken = Date.now() + 3600000; // 1 hora
    
    await usuario.save();
    
    // Enviar email con enlace de recuperación
    const resetUrl = `${req.protocol}://${req.get('host')}/resetear-password/${token}`;
    
    await emailService.enviarEmailRecuperacion(usuario.email, usuario.nombre, resetUrl);
    
    res.json({
      status: 'success',
      message: 'Se ha enviado un enlace de recuperación a tu email'
    });
  } catch (error) {
    console.error('Error al solicitar recuperación:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al procesar la solicitud de recuperación' 
    });
  }
};

/**
 * @desc    Restablecer contraseña con token
 * @route   POST /api/auth/reset
 * @access  Público
 */
exports.restablecerPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    // Buscar usuario con el token proporcionado y que no haya expirado
    const usuario = await User.findOne({
      tokenRecuperacion: token,
      expiracionToken: { $gt: Date.now() }
    });
    
    if (!usuario) {
      return res.status(400).json({
        status: 'error',
        message: 'Token inválido o expirado'
      });
    }
    
    // Actualizar contraseña y limpiar tokens
    usuario.password = password;
    usuario.tokenRecuperacion = undefined;
    usuario.expiracionToken = undefined;
    
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Contraseña restablecida correctamente'
    });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al restablecer contraseña' 
    });
  }
};

/**
 * @desc    Cerrar sesión
 * @route   POST /api/auth/logout
 * @access  Privado
 */
exports.logout = (req, res) => {
  try {
    // Limpiar cookie del token
    res.clearCookie('token');
    
    res.json({
      status: 'success',
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al cerrar sesión' 
    });
  }
};
