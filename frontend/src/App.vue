<script setup>
import { ref, onMounted } from 'vue';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const experiencias = ref([]);
const cargando = ref(false);
const errorMsg = ref('');
const categoria = ref('');
const usarCercania = ref(false);
const lat = ref('4.7110');
const lng = ref('-74.0721');
const radioKm = ref('20');

const reservaForm = ref({
  experiencia_id: 1,
  viajero_id: 2,
  fecha_inicio: '2026-12-10',
  fecha_fin: '2026-12-12',
  cupos: 1,
});
const reservaCreada = ref(null);
const reservaError = ref('');

const codigoConsulta = ref('');
const reservaConsultada = ref(null);
const validacionMsg = ref('');
const validacionError = ref('');

async function cargarExperiencias() {
  cargando.value = true;
  errorMsg.value = '';
  try {
    const params = new URLSearchParams();
    if (categoria.value) params.set('categoria', categoria.value);
    if (usarCercania.value && lat.value && lng.value) {
      params.set('lat', lat.value);
      params.set('lng', lng.value);
      params.set('radioKm', radioKm.value || '20');
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/api/experiencias${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar experiencias');

    experiencias.value = data.experiencias || [];
    if (experiencias.value.length > 0) {
      reservaForm.value.experiencia_id = experiencias.value[0].id;
    }
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    cargando.value = false;
  }
}

async function enviarReserva() {
  reservaError.value = '';
  reservaCreada.value = null;
  try {
    const res = await fetch(`${API_URL}/api/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservaForm.value),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear la reserva');
    reservaCreada.value = data.reserva;
    codigoConsulta.value = data.reserva.codigo_validacion;
  } catch (err) {
    reservaError.value = err.message;
  }
}

async function consultarCodigo() {
  validacionError.value = '';
  validacionMsg.value = '';
  reservaConsultada.value = null;
  const codigo = codigoConsulta.value.trim();
  if (!codigo) {
    validacionError.value = 'Ingresa un código de reserva (ej. ECO-1A2B3C4D).';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/reservas/codigo/${encodeURIComponent(codigo)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se encontró la reserva');
    reservaConsultada.value = data.reserva;
  } catch (err) {
    validacionError.value = err.message;
  }
}

async function confirmarIngreso() {
  validacionError.value = '';
  validacionMsg.value = '';
  const codigo = codigoConsulta.value.trim();
  if (!codigo) {
    validacionError.value = 'Ingresa un código de reserva para validar.';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/reservas/codigo/${encodeURIComponent(codigo)}/validar`, {
      method: 'PATCH',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo validar el ingreso');
    validacionMsg.value = data.mensaje || 'Ingreso validado.';
    await consultarCodigo();
  } catch (err) {
    validacionError.value = err.message;
  }
}

onMounted(cargarExperiencias);
</script>

<template>
  <main class="container">
    <header class="header">
      <h1>Eco Turismo Experiencial</h1>
      <p>Marketplace de alojamientos y experiencias sostenibles con geolocalización PostGIS</p>
    </header>

    <section class="filtros">
      <select v-model="categoria">
        <option value="">Todas las categorías</option>
        <option value="alojamiento_eco">Alojamiento eco</option>
        <option value="senderismo">Senderismo</option>
        <option value="avistamiento">Avistamiento</option>
        <option value="comunitaria">Comunitaria</option>
        <option value="taller_sostenible">Taller sostenible</option>
      </select>

      <label class="checkbox">
        <input type="checkbox" v-model="usarCercania" />
        Buscar por cercanía
      </label>

      <input v-if="usarCercania" v-model="lat" type="text" placeholder="Latitud" />
      <input v-if="usarCercania" v-model="lng" type="text" placeholder="Longitud" />
      <input v-if="usarCercania" v-model="radioKm" type="number" min="1" placeholder="Radio (km)" />

      <button @click="cargarExperiencias">Buscar</button>
    </section>

    <p v-if="cargando">Cargando experiencias...</p>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <section class="grid">
      <article v-for="exp in experiencias" :key="exp.id" class="card">
        <span class="badge">{{ exp.categoria }}</span>
        <h2>{{ exp.titulo }}</h2>
        <p>{{ exp.descripcion }}</p>
        <p v-if="exp.practicas_sostenibles"><strong>Sostenibilidad:</strong> {{ exp.practicas_sostenibles }}</p>
        <p><strong>Municipio:</strong> {{ exp.municipio || 'Sin especificar' }}</p>
        <p v-if="exp.distancia_metros !== null && exp.distancia_metros !== undefined">
          <strong>Distancia:</strong> {{ (exp.distancia_metros / 1000).toFixed(2) }} km
        </p>
        <p class="precio">${{ Number(exp.precio_cop).toLocaleString('es-CO') }} COP</p>
        <button @click="reservaForm.experiencia_id = exp.id">Seleccionar para reservar</button>
      </article>
    </section>

    <section class="reserva-box">
      <h2>Crear reserva</h2>
      <form @submit.prevent="enviarReserva" class="reserva-form">
        <label>
          ID Experiencia
          <input v-model.number="reservaForm.experiencia_id" type="number" min="1" required />
        </label>
        <label>
          ID Viajero
          <input v-model.number="reservaForm.viajero_id" type="number" min="1" required />
        </label>
        <label>
          Fecha inicio
          <input v-model="reservaForm.fecha_inicio" type="date" required />
        </label>
        <label>
          Fecha fin
          <input v-model="reservaForm.fecha_fin" type="date" required />
        </label>
        <label>
          Cupos
          <input v-model.number="reservaForm.cupos" type="number" min="1" required />
        </label>
        <button type="submit">Confirmar reserva</button>
      </form>

      <p v-if="reservaError" class="error">{{ reservaError }}</p>
      <div v-if="reservaCreada" class="confirmacion">
        <p><strong>¡Reserva confirmada!</strong></p>
        <p>Código de validación: <code>{{ reservaCreada.codigo_validacion }}</code></p>
        <p>Total: ${{ Number(reservaCreada.total_cop).toLocaleString('es-CO') }} COP</p>
      </div>
    </section>

    <section class="reserva-box validacion-box">
      <h2>Validación de reserva e ingreso</h2>
      <div class="validacion-controls">
        <input
          v-model="codigoConsulta"
          type="text"
          placeholder="Código de reserva (ej. ECO-1A2B3C4D)"
        />
        <button type="button" @click="consultarCodigo">Consultar código</button>
        <button type="button" @click="confirmarIngreso">Marcar ingreso</button>
      </div>

      <p v-if="validacionError" class="error">{{ validacionError }}</p>
      <p v-if="validacionMsg" class="exito">{{ validacionMsg }}</p>

      <div v-if="reservaConsultada" class="detalle-reserva">
        <p><strong>Código:</strong> <code>{{ reservaConsultada.codigo_validacion }}</code></p>
        <p><strong>Estado:</strong> {{ reservaConsultada.estado }}</p>
        <p><strong>Experiencia:</strong> {{ reservaConsultada.experiencia_titulo }}</p>
        <p><strong>Viajero:</strong> {{ reservaConsultada.viajero_nombre }}</p>
        <p v-if="reservaConsultada.viajero_identificacion">
          <strong>Identificación:</strong> {{ reservaConsultada.viajero_identificacion }}
        </p>
        <p v-if="reservaConsultada.viajero_telefono">
          <strong>Teléfono:</strong> {{ reservaConsultada.viajero_telefono }}
        </p>
        <p><strong>Cupos:</strong> {{ reservaConsultada.cupos }}</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, sans-serif; }
.header { margin-bottom: 1.5rem; }
.filtros { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 1.5rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.card { border: 1px solid #d1d5db; border-radius: 10px; padding: 1rem; background: #fff; color: #111827; }
.badge { display: inline-block; background: #dcfce7; color: #166534; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; }
.precio { font-weight: 700; color: #15803d; }
.reserva-box { border: 1px solid #d1d5db; border-radius: 10px; padding: 1.25rem; background: #f9fafb; color: #111827; margin-bottom: 1.5rem; }
.reserva-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; align-items: end; }
.reserva-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.validacion-controls { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.detalle-reserva { margin-top: 1rem; padding: 0.85rem; border-radius: 8px; background: #fff; border: 1px solid #d1d5db; }
.confirmacion { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #ecfdf5; border: 1px solid #86efac; }
.exito { color: #15803d; font-weight: 600; margin-top: 0.75rem; }
.error { color: #b91c1c; font-weight: 600; margin-top: 0.75rem; }
button { background: #15803d; color: #fff; border: none; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; }
button:hover { background: #166534; }
input, select { padding: 0.45rem; border: 1px solid #9ca3af; border-radius: 6px; }
</style>
