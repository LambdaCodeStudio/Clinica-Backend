// src/controllers/informes.js
const Pago = require('../models/pago');
const Cita = require('../models/cita');
const Paciente = require('../models/paciente');
const User = require('../models/user');
const Tratamiento = require('../models/tratamiento');
const mongoose = require('mongoose');
const moment = require('moment');
const excel = require('exceljs');
const path = require('path');
const fs = require('fs');
const estadisticasService = require('../services/estadisticas');

/**
 * @desc    Obtener informe de ingresos mensuales
 * @route   GET /api/informes/ingresos-mensuales
 * @access  Privado (Admin)
 */
exports.ingresosMensuales = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, categoria } = req.query;
    
    const resultado = await estadisticasService.obtenerIngresosMensuales({
      fechaInicio,
      fechaFin,
      categoria
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de ingresos mensuales:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de ingresos mensuales'
    });
  }
};

/**
 * @desc    Obtener informe de ingresos por médico
 * @route   GET /api/informes/ingresos-por-medico
 * @access  Privado (Admin)
 */
exports.ingresosPorMedico = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, categoria, desgloseMensual } = req.query;
    
    const resultado = await estadisticasService.obtenerIngresosPorMedico({
      fechaInicio,
      fechaFin,
      categoria,
      desgloseMensual: desgloseMensual === 'true'
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de ingresos por médico:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de ingresos por médico'
    });
  }
};

/**
 * @desc    Obtener informe de ingresos por categoría
 * @route   GET /api/informes/ingresos-por-categoria
 * @access  Privado (Admin)
 */
exports.ingresosPorCategoria = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    const resultado = await estadisticasService.obtenerIngresosPorCategoria({
      fechaInicio,
      fechaFin
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de ingresos por categoría:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de ingresos por categoría'
    });
  }
};

/**
 * @desc    Obtener informe de tratamientos más populares
 * @route   GET /api/informes/tratamientos-populares
 * @access  Privado (Admin)
 */
exports.tratamientosPopulares = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, categoria, limite } = req.query;
    
    const resultado = await estadisticasService.obtenerTratamientosPopulares({
      fechaInicio,
      fechaFin,
      categoria,
      limite: parseInt(limite) || 10
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de tratamientos populares:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de tratamientos populares'
    });
  }
};

/**
 * @desc    Obtener informe de citas completadas vs canceladas
 * @route   GET /api/informes/citas-completadas
 * @access  Privado (Admin)
 */
exports.citasCompletadas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, medico, desgloseMensual } = req.query;
    
    const resultado = await estadisticasService.obtenerEstadisticasCitas({
      fechaInicio,
      fechaFin,
      medico,
      desgloseMensual: desgloseMensual === 'true'
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de citas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de citas'
    });
  }
};

/**
 * @desc    Obtener informe de pacientes nuevos por mes
 * @route   GET /api/informes/pacientes-nuevos
 * @access  Privado (Admin)
 */
exports.pacientesNuevos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    const resultado = await estadisticasService.obtenerNuevosPacientesPorMes({
      fechaInicio,
      fechaFin
    });
    
    res.json({
      status: 'success',
      data: resultado
    });
  } catch (error) {
    console.error('Error al obtener informe de pacientes nuevos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe de pacientes nuevos'
    });
  }
};

/**
 * @desc    Generar informe en Excel
 * @route   GET /api/informes/excel/:tipo
 * @access  Privado (Admin)
 */
exports.generarExcel = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { fechaInicio, fechaFin, categoria, medico } = req.query;
    
    let datos;
    let nombreArchivo;
    
    // Obtener datos según el tipo de informe
    switch (tipo) {
      case 'ingresos-mensuales':
        datos = await estadisticasService.obtenerIngresosMensuales({ fechaInicio, fechaFin, categoria });
        nombreArchivo = 'Ingresos_Mensuales';
        break;
      case 'ingresos-por-medico':
        datos = await estadisticasService.obtenerIngresosPorMedico({ 
          fechaInicio, 
          fechaFin, 
          categoria, 
          desgloseMensual: true 
        });
        nombreArchivo = 'Ingresos_Por_Medico';
        break;
      case 'ingresos-por-categoria':
        datos = await estadisticasService.obtenerIngresosPorCategoria({ fechaInicio, fechaFin });
        nombreArchivo = 'Ingresos_Por_Categoria';
        break;
      case 'tratamientos-populares':
        datos = await estadisticasService.obtenerTratamientosPopulares({ 
          fechaInicio, 
          fechaFin, 
          categoria, 
          limite: 50 
        });
        nombreArchivo = 'Tratamientos_Populares';
        break;
      case 'citas-completadas':
        datos = await estadisticasService.obtenerEstadisticasCitas({ 
          fechaInicio, 
          fechaFin, 
          medico, 
          desgloseMensual: true 
        });
        nombreArchivo = 'Estadisticas_Citas';
        break;
      case 'pacientes-nuevos':
        datos = await estadisticasService.obtenerNuevosPacientesPorMes({ fechaInicio, fechaFin });
        nombreArchivo = 'Pacientes_Nuevos';
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: 'Tipo de informe no válido'
        });
    }
    
    // Crear libro de Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Informe');
    
    // Configurar columnas según el tipo de informe
    switch (tipo) {
      case 'ingresos-mensuales':
        worksheet.columns = [
          { header: 'Año', key: 'anio', width: 10 },
          { header: 'Mes', key: 'nombreMes', width: 15 },
          { header: 'Total ($)', key: 'total', width: 15 },
          { header: 'Cantidad de pagos', key: 'count', width: 20 }
        ];
        
        // Agregar datos
        worksheet.addRows(datos.detallesMensuales);
        
        // Agregar resumen
        worksheet.addRow([]);
        worksheet.addRow(['RESUMEN']);
        worksheet.addRow(['Total ingresos', datos.resumen.totalIngresos]);
        worksheet.addRow(['Cantidad de pagos', datos.resumen.cantidadPagos]);
        worksheet.addRow(['Promedio por pago', datos.resumen.promedioMonto]);
        worksheet.addRow(['Monto mínimo', datos.resumen.montoMinimo]);
        worksheet.addRow(['Monto máximo', datos.resumen.montoMaximo]);
        break;
      
      case 'ingresos-por-medico':
        worksheet.columns = [
          { header: 'Médico', key: 'nombreMedico', width: 25 },
          { header: 'Especialidad', key: 'especialidad', width: 20 },
          { header: 'Total ($)', key: 'totalIngresos', width: 15 },
          { header: 'Cantidad de pagos', key: 'cantidadPagos', width: 20 },
          { header: 'Promedio por pago ($)', key: 'promedioMonto', width: 25 },
          { header: 'Cantidad de citas', key: 'cantidadCitas', width: 20 }
        ];
        
        // Mapear especialidad a texto legible
        datos = datos.map(item => ({
          ...item,
          especialidad: mapearEspecialidad(item.especialidad)
        }));
        
        // Agregar datos
        worksheet.addRows(datos);
        
        // Si hay desglose mensual, crear una hoja por médico
        datos.forEach(medico => {
          if (medico.desgloseMensual && medico.desgloseMensual.length > 0) {
            const medicoSheet = workbook.addWorksheet(`${medico.nombreMedico.substring(0, 30)}`);
            
            medicoSheet.columns = [
              { header: 'Año', key: 'anio', width: 10 },
              { header: 'Mes', key: 'nombreMes', width: 15 },
              { header: 'Total ($)', key: 'total', width: 15 },
              { header: 'Cantidad de pagos', key: 'count', width: 20 }
            ];
            
            medicoSheet.addRows(medico.desgloseMensual);
          }
        });
        break;
      
      // Implementar configuración para los demás tipos de informes
      // ...
      
      default:
        // Configuración genérica
        worksheet.columns = [
          { header: 'Datos', key: 'data', width: 30 }
        ];
        worksheet.addRow(['Datos no disponibles para este tipo de informe']);
    }
    
    // Directorio para guardar archivos temporales
    const directorioTemp = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(directorioTemp)) {
      fs.mkdirSync(directorioTemp, { recursive: true });
    }
    
    // Generar nombre de archivo con fecha
    const fechaHoy = moment().format('YYYY-MM-DD');
    const rutaArchivo = path.join(directorioTemp, `${nombreArchivo}_${fechaHoy}.xlsx`);
    
    // Guardar archivo
    await workbook.xlsx.writeFile(rutaArchivo);
    
    // Enviar archivo al cliente
    res.download(rutaArchivo, `${nombreArchivo}_${fechaHoy}.xlsx`, (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err);
      }
      
      // Eliminar archivo temporal después de enviarlo
      fs.unlink(rutaArchivo, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error al eliminar archivo temporal:', unlinkErr);
        }
      });
    });
  } catch (error) {
    console.error('Error al generar Excel:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar informe en Excel'
    });
  }
};

/**
 * Mapea el código de especialidad a un texto legible
 * @param {String} especialidad - Código de especialidad
 * @returns {String} - Texto legible
 */
function mapearEspecialidad(especialidad) {
  const especialidades = {
    'estetica_general': 'Estética General',
    'medicina_estetica': 'Medicina Estética',
    'ambas': 'Estética General y Medicina Estética'
  };
  
  return especialidades[especialidad] || 'No especificada';
}