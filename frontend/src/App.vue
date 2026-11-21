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
  } catch (err) {
    reservaError.value = err.message;
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
.reserva-box { border: 1px solid #d1d5db; border-radius: 10px; padding: 1.25rem; background: #f9fafb; color: #111827; }
.reserva-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; align-items: end; }
.reserva-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.confirmacion { margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #ecfdf5; border: 1px solid #86efac; }
.error { color: #b91c1c; font-weight: 600; }
button { background: #15803d; color: #fff; border: none; border-radius: 6px; padding: 0.5rem 0.9rem; cursor: pointer; }
button:hover { background: #166534; }
input, select { padding: 0.45rem; border: 1px solid #9ca3af; border-radius: 6px; }
</style>
