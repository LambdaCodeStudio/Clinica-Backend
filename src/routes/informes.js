// src/routes/informes.js
const router = require('express').Router();
const informesController = require('../controllers/informes');
const auth = require('../middleware/auth');
const { esAdmin } = require('../middleware/permisos');

/**
 * @route   GET /api/informes/ingresos-mensuales
 * @desc    Obtener informe de ingresos mensuales
 * @access  Privado (Admin)
 */
router.get('/ingresos-mensuales', auth, esAdmin, informesController.ingresosMensuales);

/**
 * @route   GET /api/informes/ingresos-por-medico
 * @desc    Obtener informe de ingresos por médico
 * @access  Privado (Admin)
 */
router.get('/ingresos-por-medico', auth, esAdmin, informesController.ingresosPorMedico);

/**
 * @route   GET /api/informes/ingresos-por-categoria
 * @desc    Obtener informe de ingresos por categoría
 * @access  Privado (Admin)
 */
router.get('/ingresos-por-categoria', auth, esAdmin, informesController.ingresosPorCategoria);

/**
 * @route   GET /api/informes/tratamientos-populares
 * @desc    Obtener informe de tratamientos más populares
 * @access  Privado (Admin)
 */
router.get('/tratamientos-populares', auth, esAdmin, informesController.tratamientosPopulares);

/**
 * @route   GET /api/informes/citas-completadas
 * @desc    Obtener informe de citas completadas vs canceladas
 * @access  Privado (Admin)
 */
router.get('/citas-completadas', auth, esAdmin, informesController.citasCompletadas);

/**
 * @route   GET /api/informes/pacientes-nuevos
 * @desc    Obtener informe de pacientes nuevos por mes
 * @access  Privado (Admin)
 */
router.get('/pacientes-nuevos', auth, esAdmin, informesController.pacientesNuevos);

/**
 * @route   GET /api/informes/excel/:tipo
 * @desc    Generar informe en Excel
 * @access  Privado (Admin)
 */
router.get('/excel/:tipo', auth, esAdmin, informesController.generarExcel);

module.exports = router;