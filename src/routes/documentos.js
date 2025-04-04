// src/routes/documentos.js
const router = require('express').Router();
const documentosController = require('../controllers/documentos');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const { esAdmin, esMedico } = require('../middleware/permisos');

/**
 * @route   GET /api/documentos/templates
 * @desc    Obtener todas las plantillas de documentos
 * @access  Privado (Admin, Médico)
 */
router.get('/templates', auth, documentosController.obtenerTemplates);

/**
 * @route   POST /api/documentos/templates
 * @desc    Crear nueva plantilla de documento
 * @access  Privado (Admin)
 */
router.post('/templates', auth, esAdmin, [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('tipo').isIn(['consentimiento', 'autorizacion', 'informativo', 'receta', 'certificado']).withMessage('Tipo no válido'),
  body('categoria').isIn(['estetica_general', 'medicina_estetica', 'general']).withMessage('Categoría no válida'),
  body('contenido').notEmpty().withMessage('El contenido es obligatorio')
], validate, documentosController.crearTemplate);

/**
 * @route   GET /api/documentos/templates/:id
 * @desc    Obtener plantilla por ID
 * @access  Privado (Admin, Médico)
 */
router.get('/templates/:id', auth, documentosController.obtenerTemplatePorId);

/**
 * @route   PUT /api/documentos/templates/:id
 * @desc    Actualizar plantilla
 * @access  Privado (Admin)
 */
router.put('/templates/:id', auth, esAdmin, [
  // Validaciones para campos a actualizar
], validate, documentosController.actualizarTemplate);

/**
 * @route   GET /api/documentos
 * @desc    Obtener todos los documentos (con filtros)
 * @access  Privado (Admin, Médico)
 */
router.get('/', auth, documentosController.obtenerDocumentos);

/**
 * @route   POST /api/documentos
 * @desc    Crear nuevo documento
 * @access  Privado (Médico)
 */
router.post('/', auth, esMedico, [
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('tipo').isIn(['consentimiento', 'autorizacion', 'informativo', 'receta', 'certificado', 'otro']).withMessage('Tipo no válido'),
  body('titulo').notEmpty().withMessage('El título es obligatorio'),
  body('contenido').notEmpty().withMessage('El contenido es obligatorio')
], validate, documentosController.crearDocumento);

/**
 * @route   GET /api/documentos/:id
 * @desc    Obtener documento por ID
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id', auth, documentosController.obtenerDocumentoPorId);

/**
 * @route   PUT /api/documentos/:id
 * @desc    Actualizar documento
 * @access  Privado (Médico)
 */
router.put('/:id', auth, esMedico, [
  // Validaciones para campos a actualizar
], validate, documentosController.actualizarDocumento);

/**
 * @route   POST /api/documentos/:id/firma-paciente
 * @desc    Registrar firma del paciente
 * @access  Privado (Paciente o Médico)
 */
router.post('/:id/firma-paciente', auth, [
  body('datosFirma').notEmpty().withMessage('Los datos de firma son obligatorios')
], validate, documentosController.firmarPaciente);

/**
 * @route   POST /api/documentos/:id/firma-medico
 * @desc    Registrar firma del médico
 * @access  Privado (Médico)
 */
router.post('/:id/firma-medico', auth, esMedico, [
  body('datosFirma').notEmpty().withMessage('Los datos de firma son obligatorios')
], validate, documentosController.firmarMedico);

/**
 * @route   GET /api/documentos/:id/pdf
 * @desc    Generar PDF del documento
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/:id/pdf', auth, documentosController.generarPDF);

module.exports = router;