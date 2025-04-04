// src/services/estadisticas.js
const mongoose = require('mongoose');
const Pago = require('../models/pago');
const Cita = require('../models/cita');
const Paciente = require('../models/paciente');
const Tratamiento = require('../models/tratamiento');
const moment = require('moment');

/**
 * Servicio para generar estadísticas y métricas
 */
class EstadisticasService {
  /**
   * Obtiene los ingresos totales y desglosados por mes
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Object>} - Datos de ingresos mensuales
   */
  async obtenerIngresosMensuales(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      }
      
      const matchQuery = {
        estado: 'completado',
        ...(Object.keys(filtroFecha).length > 0 && { createdAt: filtroFecha }),
        ...(filtros.categoria && { categoria: filtros.categoria })
      };
      
      // Agregación para obtener ingresos mensuales
      const ingresosMensuales = await Pago.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            total: { $sum: '$monto' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            anio: '$_id.year',
            mes: '$_id.month',
            total: 1,
            count: 1,
            nombreMes: {
              $let: {
                vars: {
                  meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                in: { $arrayElemAt: ['$$meses', { $subtract: ['$_id.month', 1] }] }
              }
            }
          }
        }
      ]);
      
      // Calcular total general
      const resumenGeneral = await Pago.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalIngresos: { $sum: '$monto' },
            cantidadPagos: { $sum: 1 },
            promedioMonto: { $avg: '$monto' },
            montoMinimo: { $min: '$monto' },
            montoMaximo: { $max: '$monto' }
          }
        }
      ]);
      
      return {
        detallesMensuales: ingresosMensuales,
        resumen: resumenGeneral.length > 0 ? resumenGeneral[0] : {
          totalIngresos: 0,
          cantidadPagos: 0,
          promedioMonto: 0,
          montoMinimo: 0,
          montoMaximo: 0
        }
      };
    } catch (error) {
      console.error('Error al obtener ingresos mensuales:', error);
      throw error;
    }
  }

  /**
   * Obtiene los ingresos por médico en un período
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Array>} - Datos de ingresos por médico
   */
  async obtenerIngresosPorMedico(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      } else {
        // Por defecto, último mes
        filtroFecha.$gte = new Date(moment().subtract(1, 'months').startOf('month'));
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      } else {
        // Por defecto, hasta hoy
        filtroFecha.$lte = new Date();
      }
      
      const matchQuery = {
        estado: 'completado',
        ...(Object.keys(filtroFecha).length > 0 && { createdAt: filtroFecha }),
        ...(filtros.categoria && { categoria: filtros.categoria })
      };
      
      // Agregación para obtener ingresos por médico
      const ingresosPorMedico = await Pago.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'medico',
            foreignField: '_id',
            as: 'medicoInfo'
          }
        },
        { $unwind: '$medicoInfo' },
        {
          $group: {
            _id: '$medico',
            nombreMedico: { $first: { $concat: ['$medicoInfo.nombre', ' ', '$medicoInfo.apellido'] } },
            especialidad: { $first: '$medicoInfo.especialidad' },
            totalIngresos: { $sum: '$monto' },
            cantidadPagos: { $sum: 1 },
            promedioMonto: { $avg: '$monto' },
            citasAtendidas: { $addToSet: '$cita' }
          }
        },
        {
          $project: {
            _id: 0,
            medicoId: '$_id',
            nombreMedico: 1,
            especialidad: 1,
            totalIngresos: 1,
            cantidadPagos: 1,
            promedioMonto: 1,
            cantidadCitas: { $size: '$citasAtendidas' }
          }
        },
        { $sort: { totalIngresos: -1 } }
      ]);
      
      // Si se solicita con desglose mensual
      if (filtros.desgloseMensual) {
        for (const medico of ingresosPorMedico) {
          medico.desgloseMensual = await Pago.aggregate([
            { 
              $match: { 
                ...matchQuery,
                medico: mongoose.Types.ObjectId(medico.medicoId)
              } 
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                total: { $sum: '$monto' },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            {
              $project: {
                _id: 0,
                anio: '$_id.year',
                mes: '$_id.month',
                total: 1,
                count: 1,
                nombreMes: {
                  $let: {
                    vars: {
                      meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                    },
                    in: { $arrayElemAt: ['$$meses', { $subtract: ['$_id.month', 1] }] }
                  }
                }
              }
            }
          ]);
        }
      }
      
      return ingresosPorMedico;
    } catch (error) {
      console.error('Error al obtener ingresos por médico:', error);
      throw error;
    }
  }

  /**
   * Obtiene los ingresos desglosados por categoría
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Object>} - Datos de ingresos por categoría
   */
  async obtenerIngresosPorCategoria(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      }
      
      const matchQuery = {
        estado: 'completado',
        ...(Object.keys(filtroFecha).length > 0 && { createdAt: filtroFecha })
      };
      
      // Agregación para obtener ingresos por categoría
      const ingresosPorCategoria = await Pago.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$categoria',
            totalIngresos: { $sum: '$monto' },
            cantidadPagos: { $sum: 1 },
            promedioMonto: { $avg: '$monto' }
          }
        },
        {
          $project: {
            _id: 0,
            categoria: '$_id',
            totalIngresos: 1,
            cantidadPagos: 1,
            promedioMonto: 1,
            porcentaje: { $multiply: [{ $divide: ['$totalIngresos', { $sum: '$totalIngresos' }] }, 100] }
          }
        },
        { $sort: { totalIngresos: -1 } }
      ]);
      
      // Obtener el total general
      const totalGeneral = await Pago.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$monto' },
            cantidad: { $sum: 1 }
          }
        }
      ]);
      
      // Calcular porcentajes
      for (const categoria of ingresosPorCategoria) {
        if (totalGeneral.length > 0) {
          categoria.porcentaje = (categoria.totalIngresos / totalGeneral[0].total * 100).toFixed(2);
        } else {
          categoria.porcentaje = 0;
        }
        
        // Formatear nombre de categoría
        if (categoria.categoria === 'estetica_general') {
          categoria.categoriaNombre = 'Estética General';
        } else if (categoria.categoria === 'medicina_estetica') {
          categoria.categoriaNombre = 'Medicina Estética';
        } else {
          categoria.categoriaNombre = categoria.categoria;
        }
      }
      
      return {
        detallesPorCategoria: ingresosPorCategoria,
        totalGeneral: totalGeneral.length > 0 ? totalGeneral[0] : { total: 0, cantidad: 0 }
      };
    } catch (error) {
      console.error('Error al obtener ingresos por categoría:', error);
      throw error;
    }
  }

  /**
   * Obtiene los tratamientos más populares
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Array>} - Datos de tratamientos populares
   */
  async obtenerTratamientosPopulares(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      }
      
      const matchQuery = {
        estado: 'completado',
        ...(Object.keys(filtroFecha).length > 0 && { createdAt: filtroFecha }),
        ...(filtros.categoria && { categoria: filtros.categoria })
      };
      
      // Agregación para obtener tratamientos populares
      const tratamientosPopulares = await Pago.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'tratamientos',
            localField: 'tratamiento',
            foreignField: '_id',
            as: 'tratamientoInfo'
          }
        },
        { $unwind: '$tratamientoInfo' },
        {
          $group: {
            _id: '$tratamiento',
            nombreTratamiento: { $first: '$tratamientoInfo.nombre' },
            categoria: { $first: '$tratamientoInfo.categoria' },
            totalIngresos: { $sum: '$monto' },
            cantidadVendidos: { $sum: 1 },
            precio: { $first: '$tratamientoInfo.precio' }
          }
        },
        {
          $project: {
            _id: 0,
            tratamientoId: '$_id',
            nombreTratamiento: 1,
            categoria: 1,
            totalIngresos: 1,
            cantidadVendidos: 1,
            precio: 1,
            categoriaNombre: {
              $cond: {
                if: { $eq: ['$categoria', 'estetica_general'] },
                then: 'Estética General',
                else: 'Medicina Estética'
              }
            }
          }
        },
        { $sort: { cantidadVendidos: -1 } },
        { $limit: filtros.limite || 10 }
      ]);
      
      return tratamientosPopulares;
    } catch (error) {
      console.error('Error al obtener tratamientos populares:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de citas completadas vs canceladas
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Object>} - Estadísticas de citas
   */
  async obtenerEstadisticasCitas(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      }
      
      const matchQuery = {
        ...(Object.keys(filtroFecha).length > 0 && { fechaInicio: filtroFecha }),
        ...(filtros.medico && { medico: mongoose.Types.ObjectId(filtros.medico) })
      };
      
      // Agregación para estadísticas generales de citas
      const estadisticasCitas = await Cita.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$estado',
            cantidad: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            estado: '$_id',
            cantidad: 1
          }
        }
      ]);
      
      // Transformar en objeto para facilitar acceso
      const resultado = {
        total: 0,
        completadas: 0,
        canceladas: 0,
        no_asistio: 0,
        programadas: 0,
        confirmadas: 0,
        en_curso: 0,
        reprogramadas: 0,
        porCompletadas: 0,
        porCanceladas: 0,
        porNoAsistio: 0
      };
      
      estadisticasCitas.forEach(item => {
        resultado[item.estado] = item.cantidad;
        resultado.total += item.cantidad;
      });
      
      // Calcular porcentajes
      if (resultado.total > 0) {
        resultado.porCompletadas = (resultado.completadas / resultado.total * 100).toFixed(2);
        resultado.porCanceladas = (resultado.canceladas / resultado.total * 100).toFixed(2);
        resultado.porNoAsistio = (resultado.no_asistio / resultado.total * 100).toFixed(2);
      }
      
      // Estadísticas por mes si se solicita
      if (filtros.desgloseMensual) {
        resultado.desgloseMensual = await Cita.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                year: { $year: '$fechaInicio' },
                month: { $month: '$fechaInicio' },
                estado: '$estado'
              },
              cantidad: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          {
            $project: {
              _id: 0,
              anio: '$_id.year',
              mes: '$_id.month',
              estado: '$_id.estado',
              cantidad: 1,
              nombreMes: {
                $let: {
                  vars: {
                    meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                  },
                  in: { $arrayElemAt: ['$$meses', { $subtract: ['$_id.month', 1] }] }
                }
              }
            }
          }
        ]);
      }
      
      return resultado;
    } catch (error) {
      console.error('Error al obtener estadísticas de citas:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de nuevos pacientes por mes
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Array>} - Datos de nuevos pacientes por mes
   */
  async obtenerNuevosPacientesPorMes(filtros = {}) {
    try {
      // Construir filtro de fechas
      const filtroFecha = {};
      
      if (filtros.fechaInicio) {
        filtroFecha.$gte = new Date(filtros.fechaInicio);
      } else {
        // Por defecto, último año
        filtroFecha.$gte = new Date(moment().subtract(1, 'years').startOf('month'));
      }
      
      if (filtros.fechaFin) {
        filtroFecha.$lte = new Date(filtros.fechaFin);
      } else {
        // Por defecto, hasta hoy
        filtroFecha.$lte = new Date();
      }
      
      const matchQuery = {
        ...(Object.keys(filtroFecha).length > 0 && { createdAt: filtroFecha })
      };
      
      // Agregación para obtener nuevos pacientes por mes
      const nuevosPacientesPorMes = await Paciente.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            cantidad: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            anio: '$_id.year',
            mes: '$_id.month',
            cantidad: 1,
            nombreMes: {
              $let: {
                vars: {
                  meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                in: { $arrayElemAt: ['$$meses', { $subtract: ['$_id.month', 1] }] }
              }
            },
            fechaFormateada: {
              $concat: [
                { $toString: '$_id.month' },
                '/',
                { $toString: '$_id.year' }
              ]
            }
          }
        }
      ]);
      
      // Calcular totales
      const totalNuevosPacientes = nuevosPacientesPorMes.reduce((sum, item) => sum + item.cantidad, 0);
      
      return {
        detallesMensuales: nuevosPacientesPorMes,
        totalNuevosPacientes
      };
    } catch (error) {
      console.error('Error al obtener nuevos pacientes por mes:', error);
      throw error;
    }
  }
}

module.exports = new EstadisticasService();