// src/routes/historias.js
const router = require('express').Router();
const historiasController = require('../controllers/historias');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const { esAdmin, esMedico } = require('../middleware/permisos');

/**
 * @route   GET /api/historias
 * @desc    Obtener todas las historias clínicas (con filtros)
 * @access  Privado (Admin, Médico)
 */
router.get('/', auth, historiasController.obtenerHistorias);

/**
 * @route   POST /api/historias
 * @desc    Crear una nueva historia clínica
 * @access  Privado (Médico)
 */
router.post('/', auth, esMedico, [
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('cita').isMongoId().withMessage('ID de cita no válido'),
  body('tratamientoRealizado').isMongoId().withMessage('ID de tratamiento no válido'),
  body('motivoConsulta').notEmpty().withMessage('El motivo de consulta es obligatorio')
], validate, historiasController.crearHistoria);

/**
 * @route   GET /api/historias/:id
 * @desc    Obtener historia clínica por ID
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id', auth, historiasController.obtenerHistoriaPorId);

/**
 * @route   PUT /api/historias/:id
 * @desc    Actualizar historia clínica
 * @access  Privado (Médico)
 */
router.put('/:id', auth, esMedico, [
  // Validaciones para campos a actualizar
], validate, historiasController.actualizarHistoria);

/**
 * @route   POST /api/historias/:id/documentos
 * @desc    Agregar documento a historia clínica
 * @access  Privado (Médico)
 */
router.post('/:id/documentos', auth, esMedico, [
  body('tipo').isIn(['consentimiento', 'receta', 'resultado', 'foto_antes', 'foto_despues', 'otros']).withMessage('Tipo de documento no válido'),
  body('archivoId').isMongoId().withMessage('ID de archivo no válido')
], validate, historiasController.agregarDocumento);

/**
 * @route   GET /api/historias/:id/pdf
 * @desc    Generar PDF de historia clínica
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id/pdf', auth, historiasController.generarPDF);

/**
 * @route   GET /api/historias/paciente/:pacienteId
 * @desc    Obtener historias clínicas de un paciente
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/paciente/:pacienteId', auth, historiasController.obtenerHistoriasPaciente);

module.exports = router;