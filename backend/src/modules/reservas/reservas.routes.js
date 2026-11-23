const { Router } = require('express');
const {
  crearReserva,
  consultarReservaPorCodigo,
  validarIngresoReserva,
} = require('./reservas.controller');

const router = Router();

router.post('/', crearReserva);
router.get('/codigo/:codigo', consultarReservaPorCodigo);
router.patch('/codigo/:codigo/validar', validarIngresoReserva);

module.exports = router;
