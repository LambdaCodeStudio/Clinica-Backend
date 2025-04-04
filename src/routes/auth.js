// src/routes/auth.js
const router = require('express').Router();
const authController = require('../controllers/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Público para pacientes, Privado para otros roles (admin puede crear cualquier tipo)
 */
router.post('/register', [
  body('email').isEmail().withMessage('Debe proporcionar un email válido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').notEmpty().withMessage('El apellido es obligatorio'),
  body('rol').isIn(['administrador', 'medico', 'secretaria', 'paciente']).withMessage('Rol no válido')
], validate, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión y obtener token
 * @access  Público
 */
router.post('/login', [
  body('email').isEmail().withMessage('Debe proporcionar un email válido'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria')
], validate, authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener información del usuario actual
 * @access  Privado
 */
router.get('/me', auth, authController.getMe);

/**
 * @route   PUT /api/auth/password
 * @desc    Cambiar contraseña
 * @access  Privado
 */
router.put('/password', auth, [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria'),
  body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
], validate, authController.cambiarPassword);

/**
 * @route   POST /api/auth/recovery
 * @desc    Solicitar recuperación de contraseña
 * @access  Público
 */
router.post('/recovery', [
  body('email').isEmail().withMessage('Debe proporcionar un email válido')
], validate, authController.solicitarRecuperacion);

/**
 * @route   POST /api/auth/reset
 * @desc    Restablecer contraseña con token
 * @access  Público
 */
router.post('/reset', [
  body('token').notEmpty().withMessage('El token es obligatorio'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
], validate, authController.restablecerPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Privado
 */
router.post('/logout', auth, authController.logout);

module.exports = router;