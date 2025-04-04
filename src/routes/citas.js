// src/routes/citas.js
const router = require('express').Router();
const citasController = require('../controllers/citas');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body, param } = require('express-validator');
const { esAdmin, esMedico, esSecretaria } = require('../middleware/permisos');

/**
 * @route   GET /api/citas
 * @desc    Obtener todas las citas (con filtros)
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.get('/', auth, citasController.obtenerCitas);

/**
 * @route   POST /api/citas
 * @desc    Crear una nueva cita
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.post('/', auth, [
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('medico').isMongoId().withMessage('ID de médico no válido'),
  body('tratamiento').isMongoId().withMessage('ID de tratamiento no válido'),
  body('fechaInicio').isISO8601().withMessage('Fecha de inicio no válida'),
  body('fechaFin').isISO8601().withMessage('Fecha de fin no válida')
], validate, citasController.crearCita);

/**
 * @route   GET /api/citas/:id
 * @desc    Obtener cita por ID
 * @access  Privado
 */
router.get('/:id', auth, citasController.obtenerCitaPorId);

/**
 * @route   PUT /api/citas/:id
 * @desc    Actualizar cita
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.put('/:id', auth, [
  // Validaciones para campos a actualizar
], validate, citasController.actualizarCita);

/**
 * @route   PUT /api/citas/:id/estado
 * @desc    Cambiar estado de la cita
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.put('/:id/estado', auth, [
  body('estado').isIn(['programada', 'confirmada', 'en_curso', 'completada', 'cancelada', 'reprogramada', 'no_asistio']).withMessage('Estado no válido'),
  body('notas').optional()
], validate, citasController.cambiarEstadoCita);

/**
 * @route   POST /api/citas/:id/reprogramar
 * @desc    Reprogramar una cita
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.post('/:id/reprogramar', auth, [
  body('fechaInicio').isISO8601().withMessage('Fecha de inicio no válida'),
  body('fechaFin').isISO8601().withMessage('Fecha de fin no válida'),
  body('motivo').optional()
], validate, citasController.reprogramarCita);

/**
 * @route   POST /api/citas/:id/cancelar
 * @desc    Cancelar una cita
 * @access  Privado
 */
router.post('/:id/cancelar', auth, [
  body('motivo').notEmpty().withMessage('El motivo de cancelación es obligatorio'),
  body('canceladoPor').isIn(['paciente', 'medico', 'sistema']).withMessage('Valor no válido para canceladoPor')
], validate, citasController.cancelarCita);

/**
 * @route   GET /api/citas/medico/:medicoId
 * @desc    Obtener citas de un médico
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.get('/medico/:medicoId', auth, citasController.obtenerCitasMedico);

/**
 * @route   GET /api/citas/fecha/:fecha
 * @desc    Obtener citas por fecha
 * @access  Privado (Admin, Médico, Secretaria)
 */
router.get('/fecha/:fecha', auth, citasController.obtenerCitasPorFecha);

module.exports = router;