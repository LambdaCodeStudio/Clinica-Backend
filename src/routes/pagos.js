// src/routes/pagos.js
const router = require('express').Router();
const pagosController = require('../controllers/pagos');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const { esAdmin, esMedico, esSecretaria } = require('../middleware/permisos');

/**
 * @route   GET /api/pagos
 * @desc    Obtener todos los pagos (con filtros)
 * @access  Privado (Admin, Secretaria)
 */
router.get('/', auth, pagosController.obtenerPagos);

/**
 * @route   POST /api/pagos
 * @desc    Registrar un nuevo pago
 * @access  Privado (Admin, Secretaria)
 */
router.post('/', auth, [
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('cita').isMongoId().withMessage('ID de cita no válido'),
  body('medico').isMongoId().withMessage('ID de médico no válido'),
  body('tratamiento').isMongoId().withMessage('ID de tratamiento no válido'),
  body('monto').isNumeric().withMessage('El monto debe ser un número'),
  body('metodoPago').isIn(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque', 'otro']).withMessage('Método de pago no válido'),
  body('categoria').isIn(['estetica_general', 'medicina_estetica']).withMessage('Categoría no válida')
], validate, pagosController.registrarPago);

/**
 * @route   GET /api/pagos/:id
 * @desc    Obtener pago por ID
 * @access  Privado (Admin, Secretaria)
 */
router.get('/:id', auth, pagosController.obtenerPagoPorId);

/**
 * @route   PUT /api/pagos/:id
 * @desc    Actualizar pago
 * @access  Privado (Admin)
 */
router.put('/:id', auth, esAdmin, [
  // Validaciones para campos a actualizar
], validate, pagosController.actualizarPago);

/**
 * @route   POST /api/pagos/:id/reembolso
 * @desc    Registrar reembolso
 * @access  Privado (Admin)
 */
router.post('/:id/reembolso', auth, esAdmin, [
  body('monto').isNumeric().withMessage('El monto debe ser un número'),
  body('motivo').notEmpty().withMessage('El motivo es obligatorio')
], validate, pagosController.registrarReembolso);

/**
 * @route   GET /api/pagos/paciente/:pacienteId
 * @desc    Obtener pagos de un paciente
 * @access  Privado (Admin, Secretaria)
 */
router.get('/paciente/:pacienteId', auth, pagosController.obtenerPagosPaciente);

/**
 * @route   GET /api/pagos/medico/:medicoId
 * @desc    Obtener pagos de un médico
 * @access  Privado (Admin, Médico propio)
 */
router.get('/medico/:medicoId', auth, pagosController.obtenerPagosMedico);

module.exports = router;