// src/routes/archivos.js
const router = require('express').Router();
const archivosController = require('../controllers/archivos');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const upload = require('../middleware/upload');

/**
 * @route   POST /api/archivos/upload
 * @desc    Subir un nuevo archivo
 * @access  Privado
 */
router.post('/upload', auth, upload.single('archivo'), [
  body('tipo').isIn(['imagen', 'documento', 'firma', 'receta', 'consentimiento', 'certificado', 'otro']).withMessage('Tipo no válido'),
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('categoria').isIn(['foto_antes', 'foto_despues', 'receta', 'estudio', 'consentimiento', 'documento_firmado', 'otro']).withMessage('Categoría no válida')
], validate, archivosController.subirArchivo);

/**
 * @route   GET /api/archivos/:id
 * @desc    Obtener archivo por ID
 * @access  Privado
 */
router.get('/:id', auth, archivosController.obtenerArchivoPorId);

/**
 * @route   GET /api/archivos/:id/download
 * @desc    Descargar archivo
 * @access  Privado
 */
router.get('/:id/download', auth, archivosController.descargarArchivo);

/**
 * @route   DELETE /api/archivos/:id
 * @desc    Eliminar archivo
 * @access  Privado (Admin, Médico)
 */
router.delete('/:id', auth, archivosController.eliminarArchivo);

/**
 * @route   GET /api/archivos/paciente/:pacienteId
 * @desc    Obtener archivos de un paciente
 * @access  Privado (Admin, Médico, Paciente propio)
 */
router.get('/paciente/:pacienteId', auth, archivosController.obtenerArchivosPaciente);

/**
 * @route   POST /api/archivos/firma
 * @desc    Subir firma
 * @access  Privado
 */
router.post('/firma', auth, upload.single('firma'), [
  body('paciente').isMongoId().withMessage('ID de paciente no válido'),
  body('documento').isMongoId().withMessage('ID de documento no válido')
], validate, archivosController.subirFirma);

module.exports = router;