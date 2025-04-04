// src/routes/usuarios.js
const router = require('express').Router();
const usuariosController = require('../controllers/usuarios');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const { esAdmin, esMedico } = require('../middleware/permisos');

/**
 * @route   GET /api/usuarios
 * @desc    Obtener todos los usuarios (con filtros)
 * @access  Privado (Admin)
 */
router.get('/', auth, esAdmin, usuariosController.obtenerUsuarios);

/**
 * @route   GET /api/usuarios/medicos
 * @desc    Obtener todos los médicos
 * @access  Privado (Admin, Secretaria)
 */
router.get('/medicos', auth, usuariosController.obtenerMedicos);

/**
 * @route   GET /api/usuarios/:id
 * @desc    Obtener usuario por ID
 * @access  Privado (Admin, o usuario propio)
 */
router.get('/:id', auth, usuariosController.obtenerUsuarioPorId);

/**
 * @route   PUT /api/usuarios/:id
 * @desc    Actualizar usuario
 * @access  Privado (Admin, o usuario propio)
 */
router.put('/:id', auth, [
  // Validaciones según campos a actualizar
  body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('apellido').optional().notEmpty().withMessage('El apellido no puede estar vacío'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono no válido')
], validate, usuariosController.actualizarUsuario);

/**
 * @route   PUT /api/usuarios/:id/rol
 * @desc    Cambiar rol de usuario
 * @access  Privado (Admin)
 */
router.put('/:id/rol', auth, esAdmin, [
  body('rol').isIn(['administrador', 'medico', 'secretaria', 'paciente']).withMessage('Rol no válido')
], validate, usuariosController.cambiarRol);

/**
 * @route   DELETE /api/usuarios/:id
 * @desc    Desactivar usuario
 * @access  Privado (Admin)
 */
router.delete('/:id', auth, esAdmin, usuariosController.desactivarUsuario);

/**
 * @route   PUT /api/usuarios/:id/activar
 * @desc    Reactivar usuario
 * @access  Privado (Admin)
 */
router.put('/:id/activar', auth, esAdmin, usuariosController.activarUsuario);

module.exports = router;