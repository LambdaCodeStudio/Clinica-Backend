// src/routes/tratamientos.js
const router = require('express').Router();
const tratamientosController = require('../controllers/tratamientos');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');
const { esAdmin, esMedico } = require('../middleware/permisos');

/**
 * @route   GET /api/tratamientos
 * @desc    Obtener todos los tratamientos (con filtros)
 * @access  Privado
 */
router.get('/', auth, tratamientosController.obtenerTratamientos);

/**
 * @route   GET /api/tratamientos/categoria/:categoria
 * @desc    Obtener tratamientos por categoría
 * @access  Privado
 */
router.get('/categoria/:categoria', auth, tratamientosController.obtenerPorCategoria);

/**
 * @route   POST /api/tratamientos
 * @desc    Crear un nuevo tratamiento
 * @access  Privado (Admin)
 */
router.post('/', auth, esAdmin, [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('descripcion').notEmpty().withMessage('La descripción es obligatoria'),
  body('categoria').isIn(['estetica_general', 'medicina_estetica']).withMessage('Categoría no válida'),
  body('subcategoria').notEmpty().withMessage('La subcategoría es obligatoria'),
  body('precio').isNumeric().withMessage('El precio debe ser un número'),
  body('duracionEstimada').isInt({ min: 15 }).withMessage('La duración estimada debe ser al menos 15 minutos')
], validate, tratamientosController.crearTratamiento);

/**
 * @route   GET /api/tratamientos/:id
 * @desc    Obtener tratamiento por ID
 * @access  Privado
 */
router.get('/:id', auth, tratamientosController.obtenerTratamientoPorId);

/**
 * @route   PUT /api/tratamientos/:id
 * @desc    Actualizar tratamiento
 * @access  Privado (Admin)
 */
router.put('/:id', auth, esAdmin, [
  // Validaciones para los campos a actualizar
], validate, tratamientosController.actualizarTratamiento);

/**
 * @route   DELETE /api/tratamientos/:id
 * @desc    Desactivar tratamiento
 * @access  Privado (Admin)
 */
router.delete('/:id', auth, esAdmin, tratamientosController.desactivarTratamiento);

/**
 * @route   PUT /api/tratamientos/:id/profesionales
 * @desc    Actualizar profesionales habilitados para el tratamiento
 * @access  Privado (Admin)
 */
router.put('/:id/profesionales', auth, esAdmin, [
  body('profesionales').isArray().withMessage('Debe proporcionar un array de IDs de profesionales')
], validate, tratamientosController.actualizarProfesionales);

module.exports = router;