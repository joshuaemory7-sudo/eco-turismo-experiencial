const { Router } = require('express');
const {
  listarReservas,
  crearReserva,
  obtenerReservaPorCodigo,
} = require('./reservas.controller');

const router = Router();

router.get('/', listarReservas);
router.post('/', crearReserva);
router.get('/codigo/:codigo', obtenerReservaPorCodigo);

module.exports = router;
