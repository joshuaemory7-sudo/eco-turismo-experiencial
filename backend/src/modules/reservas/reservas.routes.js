const { Router } = require('express');
const {
  listarReservas,
  crearReserva,
  obtenerReservaPorCodigo,
  validarIngresoReserva,
} = require('./reservas.controller');

const router = Router();

router.get('/', listarReservas);
router.post('/', crearReserva);
router.get('/codigo/:codigo', obtenerReservaPorCodigo);
router.patch('/codigo/:codigo/validar', validarIngresoReserva);

module.exports = router;
