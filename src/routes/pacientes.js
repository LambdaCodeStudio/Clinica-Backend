// src/routes/pacientes.js
const router = require('express').Router();
const pacientesController = require('../controllers/pacientes');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body, param } = require('express-validator');
const { esAdmin, esMedico, esSecretaria } = require('../middleware/permisos');

/**
 * @route   GET /api/pacientes
 * @desc    Obtener todos los pacientes (con filtros)
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.get('/', auth, pacientesController.obtenerPacientes);

/**
 * @route   POST /api/pacientes
 * @desc    Crear un nuevo paciente
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.post('/', auth, [
  body('dni').notEmpty().withMessage('El DNI es obligatorio'),
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').notEmpty().withMessage('El apellido es obligatorio'),
  body('email').isEmail().withMessage('Debe proporcionar un email válido'),
  body('fechaNacimiento').isDate().withMessage('Fecha de nacimiento no válida'),
  body('genero').isIn(['masculino', 'femenino', 'otro', 'no_especificado']).withMessage('Género no válido'),
  // Otras validaciones necesarias
], validate, pacientesController.crearPaciente);

/**
 * @route   GET /api/pacientes/:id
 * @desc    Obtener paciente por ID
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
router.get('/:id', auth, pacientesController.obtenerPacientePorId);

/**
 * @route   PUT /api/pacientes/:id
 * @desc    Actualizar paciente
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
router.put('/:id', auth, [
  // Validaciones para los campos a actualizar
], validate, pacientesController.actualizarPaciente);

/**
 * @route   GET /api/pacientes/:id/historias
 * @desc    Obtener historias clínicas de un paciente
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id/historias', auth, pacientesController.obtenerHistoriasClinicas);

/**
 * @route   GET /api/pacientes/:id/documentos
 * @desc    Obtener documentos de un paciente
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id/documentos', auth, pacientesController.obtenerDocumentosPaciente);

/**
 * @route   GET /api/pacientes/:id/citas
 * @desc    Obtener citas de un paciente
 * @access  Privado (Admin, Médico, Secretaria, Paciente propio)
 */
router.get('/:id/citas', auth, pacientesController.obtenerCitasPaciente);

/**
 * @route   PUT /api/pacientes/:id/alergias
 * @desc    Actualizar alergias del paciente
 * @access  Privado (Admin, Médico)
 */
router.put('/:id/alergias', auth, esMedico, pacientesController.actualizarAlergias);

/**
 * @route   PUT /api/pacientes/:id/condiciones
 * @desc    Actualizar condiciones médicas del paciente
 * @access  Privado (Admin, Médico)
 */
router.put('/:id/condiciones', auth, esMedico, pacientesController.actualizarCondiciones);

module.exports = router;