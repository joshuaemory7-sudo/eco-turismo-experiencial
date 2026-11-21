const { Router } = require('express');
const { listarExperiencias, crearExperiencia } = require('./experiencias.controller');

const router = Router();

router.get('/', listarExperiencias);
router.post('/', crearExperiencia);

module.exports = router;
