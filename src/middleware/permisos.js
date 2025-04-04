// src/middleware/permisos.js
const User = require('../models/user');
const Paciente = require('../models/paciente');

/**
 * Middleware para verificar si el usuario es administrador
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
exports.esAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado'
      });
    }
    
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Se requieren privilegios de administrador.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware esAdmin:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar permisos'
    });
  }
};

/**
 * Middleware para verificar si el usuario es médico
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
exports.esMedico = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado'
      });
    }
    
    if (req.user.rol !== 'medico' && req.user.rol !== 'administrador') {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Se requieren privilegios de médico.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware esMedico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar permisos'
    });
  }
};

/**
 * Middleware para verificar si el usuario es secretaria
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
exports.esSecretaria = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado'
      });
    }
    
    if (req.user.rol !== 'secretaria' && req.user.rol !== 'administrador') {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Se requieren privilegios de secretaria.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware esSecretaria:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar permisos'
    });
  }
};

/**
 * Middleware para verificar si puede ver datos del paciente
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
exports.puedeVerPaciente = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado'
      });
    }
    
    const pacienteId = req.params.id;
    
    // Permitir siempre a administradores y médicos
    if (req.user.rol === 'administrador' || req.user.rol === 'medico' || req.user.rol === 'secretaria') {
      return next();
    }
    
    // Si es paciente, verificar que sea el propio paciente
    if (req.user.rol === 'paciente') {
      const paciente = await Paciente.findById(pacienteId);
      
      if (!paciente) {
        return res.status(404).json({
          status: 'error',
          message: 'Paciente no encontrado'
        });
      }
      
      if (paciente.usuario.toString() !== req.user.userId) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para acceder a estos datos'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware puedeVerPaciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar permisos'
    });
  }
};

/**
 * Middleware para verificar si puede modificar datos del paciente
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
exports.puedeModificarPaciente = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado'
      });
    }
    
    const pacienteId = req.params.id;
    
    // Permitir siempre a administradores y médicos
    if (req.user.rol === 'administrador' || req.user.rol === 'medico') {
      return next();
    }
    
    // Si es secretaria, solo permitir actualizar datos básicos
    if (req.user.rol === 'secretaria') {
      const camposSensibles = ['alergias', 'condicionesMedicas', 'medicacionActual', 'grupoSanguineo'];
      
      // Verificar si está intentando modificar campos sensibles
      const intentaModificarSensibles = camposSensibles.some(campo => req.body[campo] !== undefined);
      
      if (intentaModificarSensibles) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para modificar información médica sensible'
        });
      }
      
      return next();
    }
    
    // Si es paciente, verificar que sea el propio paciente
    if (req.user.rol === 'paciente') {
      const paciente = await Paciente.findById(pacienteId);
      
      if (!paciente) {
        return res.status(404).json({
          status: 'error',
          message: 'Paciente no encontrado'
        });
      }
      
      if (paciente.usuario.toString() !== req.user.userId) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permiso para modificar estos datos'
        });
      }
      
      // Verificar campos que un paciente puede modificar
      const camposPermitidosPaciente = [
        'telefono', 'direccion', 'contactoEmergencia', 'preferencias'
      ];
      
      // Obtener todos los campos que se intentan modificar
      const camposModificados = Object.keys(req.body);
      
      // Verificar si hay algún campo no permitido
      const camposNoPermitidos = camposModificados.filter(
        campo => !camposPermitidosPaciente.includes(campo)
      );
      
      if (camposNoPermitidos.length > 0) {
        return res.status(403).json({
          status: 'error',
          message: `No tienes permiso para modificar: ${camposNoPermitidos.join(', ')}`
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware puedeModificarPaciente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar permisos'
    });
  }
};