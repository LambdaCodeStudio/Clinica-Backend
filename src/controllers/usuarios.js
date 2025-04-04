// src/controllers/usuarios.js
const User = require('../models/user');
const Paciente = require('../models/paciente');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los usuarios (con filtros)
 * @route   GET /api/usuarios
 * @access  Privado (Admin)
 */
exports.obtenerUsuarios = async (req, res) => {
  try {
    const { 
      nombre, apellido, email, rol, activo,
      page = 1, limit = 10,
      ordenarPor = 'createdAt', orden = 'desc'
    } = req.query;
    
    // Construir filtro
    const filtro = {};
    
    if (nombre) {
      filtro.nombre = { $regex: nombre, $options: 'i' };
    }
    
    if (apellido) {
      filtro.apellido = { $regex: apellido, $options: 'i' };
    }
    
    if (email) {
      filtro.email = { $regex: email, $options: 'i' };
    }
    
    if (rol) {
      filtro.rol = rol;
    }
    
    if (activo !== undefined) {
      filtro.activo = activo === 'true';
    }
    
    // Calcular saltos para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Definir ordenación
    const sort = {};
    sort[ordenarPor] = orden === 'asc' ? 1 : -1;
    
    // Excluir campos sensibles
    const projection = {
      password: 0,
      tokenRecuperacion: 0,
      expiracionToken: 0
    };
    
    // Buscar usuarios con paginación
    const usuarios = await User.find(filtro, projection)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Contar total de usuarios para paginación
    const totalUsuarios = await User.countDocuments(filtro);
    const totalPaginas = Math.ceil(totalUsuarios / parseInt(limit));
    
    res.json({
      status: 'success',
      totalUsuarios,
      totalPaginas,
      pagina: parseInt(page),
      usuarios
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de usuarios'
    });
  }
};

/**
 * @desc    Obtener todos los médicos
 * @route   GET /api/usuarios/medicos
 * @access  Privado (Admin, Secretaria)
 */
exports.obtenerMedicos = async (req, res) => {
  try {
    const { especialidad } = req.query;
    
    // Construir filtro
    const filtro = { 
      rol: 'medico',
      activo: true
    };
    
    if (especialidad) {
      // Si se especifica 'ambas', incluir médicos con 'estetica_general', 'medicina_estetica' o 'ambas'
      if (especialidad === 'ambas') {
        filtro.$or = [
          { especialidad: 'estetica_general' },
          { especialidad: 'medicina_estetica' },
          { especialidad: 'ambas' }
        ];
      } else {
        // Buscar médicos con la especialidad específica o 'ambas'
        filtro.$or = [
          { especialidad },
          { especialidad: 'ambas' }
        ];
      }
    }
    
    // Excluir campos sensibles
    const projection = {
      nombre: 1,
      apellido: 1,
      email: 1,
      telefono: 1,
      especialidad: 1,
      matriculaProfesional: 1,
      createdAt: 1
    };
    
    // Buscar médicos activos
    const medicos = await User.find(filtro, projection).sort({ apellido: 1, nombre: 1 });
    
    res.json({
      status: 'success',
      medicos
    });
  } catch (error) {
    console.error('Error al obtener médicos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la lista de médicos'
    });
  }
};

/**
 * @desc    Obtener usuario por ID
 * @route   GET /api/usuarios/:id
 * @access  Privado (Admin, o usuario propio)
 */
exports.obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    
    // Verificar permisos
    if (req.user.rol !== 'administrador' && req.user.userId !== usuarioId) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para acceder a estos datos'
      });
    }
    
    // Buscar usuario
    const usuario = await User.findById(usuarioId).select('-password -tokenRecuperacion -expiracionToken');
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Si es un paciente, incluir datos adicionales
    let datosPaciente = null;
    if (usuario.rol === 'paciente') {
      datosPaciente = await Paciente.findOne({ usuario: usuario._id });
    }
    
    res.json({
      status: 'success',
      usuario,
      ...(datosPaciente && { paciente: datosPaciente })
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del usuario'
    });
  }
};

/**
 * @desc    Actualizar usuario
 * @route   PUT /api/usuarios/:id
 * @access  Privado (Admin, o usuario propio)
 */
exports.actualizarUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    
    // Verificar permisos
    if (req.user.rol !== 'administrador' && req.user.userId !== usuarioId) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para modificar estos datos'
      });
    }
    
    // Buscar usuario
    const usuario = await User.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Campos permitidos para actualización
    const camposPermitidos = ['nombre', 'apellido', 'telefono'];
    
    // Si es admin, permitir más campos
    if (req.user.rol === 'administrador') {
      camposPermitidos.push('email', 'especialidad', 'matriculaProfesional');
    }
    
    // Actualizar solo los campos permitidos
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        usuario[campo] = req.body[campo];
      }
    });
    
    // Si se está actualizando el email, verificar que no exista otro usuario con ese email
    if (req.body.email && req.body.email !== usuario.email) {
      const emailExistente = await User.findOne({ email: req.body.email, _id: { $ne: usuarioId } });
      
      if (emailExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'El email ya está registrado'
        });
      }
    }
    
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Usuario actualizado correctamente',
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        especialidad: usuario.especialidad,
        matriculaProfesional: usuario.matriculaProfesional,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar usuario'
    });
  }
};

/**
 * @desc    Cambiar rol de usuario
 * @route   PUT /api/usuarios/:id/rol
 * @access  Privado (Admin)
 */
exports.cambiarRol = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { rol } = req.body;
    
    // Verificar que el rol sea válido
    const rolesValidos = ['administrador', 'medico', 'secretaria', 'paciente'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        status: 'error',
        message: 'Rol no válido'
      });
    }
    
    // Buscar usuario
    const usuario = await User.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar si es un paciente con datos adicionales
    if (usuario.rol === 'paciente' && rol !== 'paciente') {
      const pacienteExistente = await Paciente.findOne({ usuario: usuario._id });
      
      if (pacienteExistente) {
        return res.status(400).json({
          status: 'error',
          message: 'No se puede cambiar el rol de un paciente con datos clínicos registrados'
        });
      }
    }
    
    // Actualizar rol
    usuario.rol = rol;
    
    // Si cambia a médico, establecer campos adicionales
    if (rol === 'medico') {
      usuario.especialidad = req.body.especialidad || 'ambas';
      usuario.matriculaProfesional = req.body.matriculaProfesional || '';
    }
    
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Rol actualizado correctamente',
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        especialidad: usuario.especialidad,
        matriculaProfesional: usuario.matriculaProfesional
      }
    });
  } catch (error) {
    console.error('Error al cambiar rol:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cambiar rol del usuario'
    });
  }
};

/**
 * @desc    Desactivar usuario
 * @route   DELETE /api/usuarios/:id
 * @access  Privado (Admin)
 */
exports.desactivarUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    
    // Buscar usuario
    const usuario = await User.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // No permitir desactivar al propio administrador
    if (usuario._id.toString() === req.user.userId) {
      return res.status(400).json({
        status: 'error',
        message: 'No puedes desactivar tu propia cuenta'
      });
    }
    
    // Desactivar usuario
    usuario.activo = false;
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Usuario desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al desactivar usuario'
    });
  }
};

/**
 * @desc    Reactivar usuario
 * @route   PUT /api/usuarios/:id/activar
 * @access  Privado (Admin)
 */
exports.activarUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    
    // Buscar usuario
    const usuario = await User.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Activar usuario
    usuario.activo = true;
    await usuario.save();
    
    res.json({
      status: 'success',
      message: 'Usuario activado correctamente'
    });
  } catch (error) {
    console.error('Error al activar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al activar usuario'
    });
  }
};