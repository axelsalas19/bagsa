// Lógica del panel de búsqueda y herramientas de localización (Calles y Suministros)
import { state } from './state.js';
import { wktToGeoJSON, obtenerColorRuta, showStatus } from './utils.js';
import { initIndicadoresPanel } from './kpis.js';

// Estado local de resaltado activo de suministro buscado
let _highlightRestore = null;  // función para restaurar el estilo original
let _highlightTimer = null;    // timeout de auto-restauración (15 s)
let _highlightMapClick = null; // handler de clic en mapa para dismissal

/**
 * Inicialización de los elementos de entrada del panel de búsqueda en el sidebar
 */
export function initSearchPanel() {
    const searchBtn = document.getElementById('searchBtn');
    const input = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    
    if (searchBtn) searchBtn.addEventListener('click', buscarSuministro);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') buscarSuministro(); });
    if (searchClearBtn) searchClearBtn.addEventListener('click', () => {
        if (input) input.value = '';
        const r = document.getElementById('searchResults');
        if (r) r.innerHTML = '';
        if (input) input.focus();
    });

    const searchRutaBtn = document.getElementById('searchRutaBtn');
    const searchRutaClear = document.getElementById('searchRutaClearBtn');
    const rutaInput = document.getElementById('searchRutaInput');
    const ordenInput = document.getElementById('searchOrdenInput');
    if (searchRutaBtn) searchRutaBtn.addEventListener('click', buscarPorRutaOrden);
    if (searchRutaClear) searchRutaClear.addEventListener('click', () => {
        if (rutaInput) rutaInput.value = '';
        if (ordenInput) ordenInput.value = '';
        const r = document.getElementById('searchResults');
        if (r) r.innerHTML = '';
        if (rutaInput) rutaInput.focus();
    });
    if (rutaInput) rutaInput.addEventListener('keydown', e => { if (e.key === 'Enter') buscarPorRutaOrden(); });
    if (ordenInput) ordenInput.addEventListener('keydown', e => { if (e.key === 'Enter') buscarPorRutaOrden(); });

    const callesBtn = document.getElementById('callesSearchBtn');
    const callesInput = document.getElementById('callesSearchInput');
    const callesClear = document.getElementById('callesClearBtn');
    
    if (callesBtn) callesBtn.addEventListener('click', buscarCalle);
    if (callesInput) callesInput.addEventListener('keydown', e => { if (e.key === 'Enter') buscarCalle(); });
    if (callesClear) {
        callesClear.addEventListener('click', () => {
            if (callesInput) callesInput.value = '';
            const r = document.getElementById('callesSearchResults');
            if (r) r.innerHTML = '';
            limpiarSeleccionCalles();
            if (callesInput) callesInput.focus();
        });
    }

    // Inicializar panel de indicadores
    initIndicadoresPanel();
}

/**
 * Muestra el panel buscador de calles del Área de Servicio activa
 */
export function mostrarBuscadorCalles() {
    const section = document.getElementById('buscarCallesSection');
    if (section) section.style.display = 'block';
    const input = document.getElementById('callesSearchInput');
    if (input) input.value = '';
    document.getElementById('callesSearchResults').innerHTML = '';

    // Poblar datalist con nombres únicos ordenados
    const datalist = document.getElementById('callesSuggestions');
    if (datalist) {
        datalist.innerHTML = '';
        const nombresUnicos = [...new Set(
            state.callesFiltradas.map(c => c.name).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        
        nombresUnicos.forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            datalist.appendChild(option);
        });
    }
}

/**
 * Oculta el panel buscador de calles
 */
export function ocultarBuscadorCalles() {
    const section = document.getElementById('buscarCallesSection');
    if (section) section.style.display = 'none';
    const input = document.getElementById('callesSearchInput');
    if (input) input.value = '';
    const results = document.getElementById('callesSearchResults');
    if (results) results.innerHTML = '';
    limpiarSeleccionCalles();
}

/**
 * Busca e identifica calles filtradas
 */
export function buscarCalle() {
    const input = document.getElementById('callesSearchInput');
    const resultsDiv = document.getElementById('callesSearchResults');
    if (!input || !resultsDiv) return;

    const texto = input.value.trim().toLowerCase();
    if (!texto) { 
        resultsDiv.innerHTML = '<div class="search-no-results">Ingresá un nombre de calle.</div>'; 
        return; 
    }
    if (state.callesFiltradas.length === 0) { 
        resultsDiv.innerHTML = '<div class="search-no-results">Primero filtrá un Área de Servicio.</div>'; 
        return; 
    }

    const encontradas = [...new Map(
        state.callesFiltradas
            .filter(c => c.name && c.name.toLowerCase().includes(texto))
            .map(c => [c.name.toLowerCase(), c])
    ).values()];

    if (encontradas.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Sin resultados para "' + texto + '".</div>';
        return;
    }

    resultsDiv.innerHTML = '';
    encontradas.slice(0, 15).forEach(calle => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<div class="result-main">〽 ${calle.name}</div>
            <div class="result-sub">${calle.fclass ? 'Tipo: ' + calle.fclass : ''}</div>`;
        div.addEventListener('click', () => zoomACalle(calle));
        resultsDiv.appendChild(div);
    });
    
    if (encontradas.length > 15) {
        resultsDiv.innerHTML += `<div class="search-no-results">Mostrando 15 de ${encontradas.length} calles.</div>`;
    }
}

/**
 * Restablece los estilos por defecto de las calles
 */
export function limpiarSeleccionCalles() {
    if (state.layerGroups && state.layerGroups.calles) {
        state.layerGroups.calles.eachLayer(function (geoJsonLayer) {
            if (geoJsonLayer.eachLayer) {
                geoJsonLayer.eachLayer(function (lineLayer) {
                    lineLayer.setStyle({ color: '#333333', weight: 2, opacity: 0.6 });
                });
            } else if (geoJsonLayer.setStyle) {
                geoJsonLayer.setStyle({ color: '#333333', weight: 2, opacity: 0.6 });
            }
        });
    }
}

/**
 * Enfoca y resalta la calle indicada en el mapa
 */
export function zoomACalle(calle) {
    const geom = calle.wkt_geom || calle.geom || calle.the_geom;
    if (!geom) return;
    try {
        const gj = typeof geom === 'string' ? wktToGeoJSON(geom) : geom;
        if (!gj) return;
        const tempLayer = L.geoJSON(gj);
        const bounds = tempLayer.getBounds();
        if (bounds && bounds.isValid() && state.map) {
            state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        }
        
        // Resaltar en naranja
        state.layerGroups.calles.eachLayer(function (geoJsonLayer) {
            geoJsonLayer.eachLayer(function (lineLayer) {
                const props = lineLayer.feature && lineLayer.feature.properties;
                if (props && props.name === calle.name) {
                    lineLayer.setStyle({ color: '#ff9900ff', weight: 3, opacity: 1 });
                } else {
                    lineLayer.setStyle({ color: '#333333', weight: 2, opacity: 0.6 });
                }
            });
        });
    } catch (e) { console.error('Error zoom calle:', e); }
}

/**
 * Busca suministros filtrados en la caché por diferentes campos de interés
 */
export function buscarSuministro() {
    const campo = document.getElementById('searchField').value;
    const texto = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!texto) { 
        if (resultsDiv) resultsDiv.innerHTML = '<div class="search-no-results">Ingresá un texto para buscar.</div>'; 
        return; 
    }
    if (state.suministrosData.length === 0) { 
        if (resultsDiv) resultsDiv.innerHTML = '<div class="search-no-results">Primero cargá los datos base.</div>'; 
        return; 
    }

    const campoMap = { 'Nombre': 'cliente', 'medidor': 'numero_medidor', 'Cliente': 'cliente' };
    const campoReal = campoMap[campo] || campo;
    
    const todoEncontrado = state.suministrosData.filter(s => { 
        const valor = s[campoReal]; 
        return valor && String(valor).toLowerCase().includes(texto); 
    });
    
    if (!resultsDiv) return;
    if (todoEncontrado.length === 0) { 
        resultsDiv.innerHTML = '<div class="search-no-results">Sin resultados.</div>'; 
        return; 
    }

    let enFiltro = todoEncontrado, enOtra = [];
    if (state.currentFilter && state.currentFilter.num_fimm && state.currentFilter.num_fimm.length > 0) {
        let _nombresEnFiltro = [];
        if (state.currentFilter.type === 'localidad') {
            _nombresEnFiltro = [state.currentFilter.name];
        } else if (state.currentFilter.type === 'unidad_regional') {
            _nombresEnFiltro = state.localidadesData
                .filter(l => l.unidad_regional === state.currentFilter.name)
                .map(l => l.nombre).filter(Boolean);
        } else {
            const _nf = (state.currentFilter.num_fimm || []).map(String);
            _nombresEnFiltro = state.localidadesData
                .filter(l => _nf.includes(String(l.num_fimm)))
                .map(l => l.nombre).filter(Boolean);
        }
        enFiltro = todoEncontrado.filter(s => _nombresEnFiltro.includes(s.localidad));
        enOtra = todoEncontrado.filter(s => !_nombresEnFiltro.includes(s.localidad));
    }

    resultsDiv.innerHTML = '';
    if (enFiltro.length > 0) {
        enFiltro.slice(0, 20).forEach(item => renderResultItem(item, resultsDiv));
        if (enFiltro.length > 20) {
            resultsDiv.innerHTML += '<div class="search-no-results">Mostrando 20 de ' + enFiltro.length + ' resultados.</div>';
        }
    } else if (state.currentFilter && state.currentFilter.num_fimm && state.currentFilter.num_fimm.length > 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No se encontró en ' + state.currentFilter.name + '.</div>';
    }
    
    if (enOtra.length > 0) {
        resultsDiv.innerHTML += '<div style="font-size:11px; color:#856404; background:#fff3cd; padding:5px; margin-top:6px;">⚠️ ' + enOtra.length + ' resultado(s) en otra localidad:</div>';
        enOtra.slice(0, 5).forEach(item => {
            const loc = state.localidadesData.find(l => l.nombre === item.localidad);
            renderResultItem(item, resultsDiv, loc ? loc.nombre : (item.localidad || 'Otra localidad'));
        });
    }
    
    if (!state.currentFilter || !state.currentFilter.num_fimm || state.currentFilter.num_fimm.length === 0) {
        todoEncontrado.slice(0, 20).forEach(item => renderResultItem(item, resultsDiv));
        if (todoEncontrado.length > 20) {
            resultsDiv.innerHTML += '<div class="search-no-results">Mostrando 20 de ' + todoEncontrado.length + ' resultados.</div>';
        }
    }
}

function renderResultItem(item, container, otraLocalidad = null) {
    const ruta = item.ruta || '-';
    const orden = item.orden || '-';
    const colorRuta = (ruta && ruta !== '-') ? obtenerColorRuta(String(ruta)) : '#666';

    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<div class="result-main">${item.cliente || item.numero_medidor || '-'}</div>
        <div class="result-sub">🔢 Medidor: ${item.numero_medidor || '-'} | Estado: ${item.estado_contrato || '-'}</div>
        <div class="result-sub">📭 Ruta: <span style="color:${colorRuta}; font-weight:bold;">${ruta}</span> | 🔜 Orden: ${orden}</div>
        <div class="result-sub">📍 ${item.direccion || ''}${otraLocalidad ? ` <em style="color:#856404">— ${otraLocalidad}</em>` : ''}</div>`;
    div.addEventListener('click', () => zoomASuministro(item));
    container.appendChild(div);
}

/**
 * Busca suministros por `ruta` y/o `orden` dentro de la caché (y prioriza los de la localidad filtrada)
 */
export function buscarPorRutaOrden() {
    const rutaValRaw = document.getElementById('searchRutaInput')?.value;
    const ordenValRaw = document.getElementById('searchOrdenInput')?.value;
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;

    const rutaVal = rutaValRaw != null && String(rutaValRaw).trim() !== '' ? String(rutaValRaw).trim() : null;
    const ordenVal = ordenValRaw != null && String(ordenValRaw).trim() !== '' ? parseInt(ordenValRaw, 10) : null;

    if (!rutaVal && (ordenVal == null || isNaN(ordenVal))) {
        resultsDiv.innerHTML = '<div class="search-no-results">Ingrese ruta o/ y orden para buscar.</div>';
        return;
    }

    if (state.suministrosData.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Primero cargá los datos base.</div>';
        return;
    }

    const coincidencias = state.suministrosData.filter(s => {
        const sRuta = s.ruta != null ? String(s.ruta) : null;
        const sOrden = s.orden != null ? Number(s.orden) : null;
        if (rutaVal && ordenVal != null && !isNaN(ordenVal)) {
            return sRuta === rutaVal && sOrden === ordenVal;
        } else if (rutaVal) {
            return sRuta === rutaVal;
        } else if (ordenVal != null && !isNaN(ordenVal)) {
            return sOrden === ordenVal;
        }
        return false;
    });

    if (coincidencias.length === 0) {
        resultsDiv.innerHTML = `<div class="search-no-results">Sin resultados para Ruta ${rutaVal || '-'} ${ordenVal != null ? 'Orden ' + ordenVal : ''}.</div>`;
        return;
    }

    // Priorizar resultados dentro del filtro activo (localidad / unidad_regional)
    let enFiltro = coincidencias, enOtra = [];
    if (state.currentFilter && state.currentFilter.num_fimm && state.currentFilter.num_fimm.length > 0) {
        let _nombresEnFiltro = [];
        if (state.currentFilter.type === 'localidad') {
            _nombresEnFiltro = [state.currentFilter.name];
        } else if (state.currentFilter.type === 'unidad_regional') {
            _nombresEnFiltro = state.localidadesData
                .filter(l => l.unidad_regional === state.currentFilter.name)
                .map(l => l.nombre).filter(Boolean);
        } else {
            const _nf = (state.currentFilter.num_fimm || []).map(String);
            _nombresEnFiltro = state.localidadesData
                .filter(l => _nf.includes(String(l.num_fimm)))
                .map(l => l.nombre).filter(Boolean);
        }
        enFiltro = coincidencias.filter(s => _nombresEnFiltro.includes(s.localidad));
        enOtra = coincidencias.filter(s => !_nombresEnFiltro.includes(s.localidad));
    }

    resultsDiv.innerHTML = '';
    if (enFiltro.length > 0) {
        enFiltro.slice(0, 50).forEach(item => renderResultItem(item, resultsDiv));
    }
    if (enOtra.length > 0) {
        resultsDiv.innerHTML += `<div class="search-no-results">⚠️ ${enOtra.length} resultado(s) en otra localidad:</div>`;
        enOtra.slice(0, 20).forEach(item => {
            const loc = state.localidadesData.find(l => l.nombre === item.localidad);
            renderResultItem(item, resultsDiv, loc ? loc.nombre : (item.localidad || 'Otra localidad'));
        });
    }
}

function _cancelarResaltadoSuministro() {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    if (_highlightMapClick) { state.map.off('click', _highlightMapClick); _highlightMapClick = null; }
    if (_highlightRestore) { _highlightRestore(); _highlightRestore = null; }
}

/**
 * Centra la vista en el suministro y lo resalta de forma temporal
 */
export function zoomASuministro(item) {
    // Helper: obtiene latlng desde varios formatos posibles
    function _getLatLngFromItem(it) {
        const geom = it.geom || it.wkt_geom || it.the_geom;
        if (!geom) return null;
        try {
            if (typeof geom === 'object' && geom.coordinates) return L.latLng(geom.coordinates[1], geom.coordinates[0]);
            if (typeof geom === 'object' && geom.type === 'Feature' && geom.geometry && geom.geometry.type === 'Point') return L.latLng(geom.geometry.coordinates[1], geom.geometry.coordinates[0]);
            if (typeof geom === 'string') {
                const gj = wktToGeoJSON(geom);
                if (gj && gj.coordinates) return L.latLng(gj.coordinates[1], gj.coordinates[0]);
                if (gj && gj.type === 'Feature' && gj.geometry && gj.geometry.type === 'Point') return L.latLng(gj.geometry.coordinates[1], gj.geometry.coordinates[0]);
            }
        } catch (e) { console.warn('Error parseando geometría para zoom:', e); }
        return null;
    }

    // Intento directo con la geometría del item
    let latlng = _getLatLngFromItem(item);

    // Si no hay geometría, buscar en la caché por numero_medidor
    if (!latlng && item.numero_medidor) {
        const encontrado = state.suministrosData.find(s => String(s.numero_medidor) === String(item.numero_medidor));
        if (encontrado) latlng = _getLatLngFromItem(encontrado);
    }

    // Si todavía no hay latlng pero hay ruta, hago fitBounds sobre todos los suministros de esa ruta
    if (!latlng && item.ruta) {
        const agrup = state.suministrosData.filter(s => s.ruta != null && String(s.ruta) === String(item.ruta));
        const latlngs = agrup.map(s => _getLatLngFromItem(s)).filter(Boolean);
        if (latlngs.length > 0) {
            const group = L.featureGroup(latlngs.map(ll => L.marker(ll)));
            state.map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 17 });
            // no resaltado individual en este caso
            return;
        }
    }

    if (!latlng) return;

    state.map.setView(latlng, 18);

    _cancelarResaltadoSuministro();

    const medidorBuscado = item.numero_medidor != null ? String(item.numero_medidor) : null;
    const clienteBuscado = item.numero_cliente != null ? String(item.numero_cliente) : null;
    let encontradoFlag = false;

    state.layerGroups.suministros.eachLayer(function (geoJsonLayer) {
        if (encontradoFlag) return;
        geoJsonLayer.eachLayer(function (circleLayer) {
            if (encontradoFlag) return;
            if (!circleLayer.getLatLng) return;

            const props = circleLayer.feature && circleLayer.feature.properties;
            if (!props) return;

            // Único criterio válido cuando existe numero_cliente: NO hay fallback a coords.
            const coincideCliente = clienteBuscado && String(props.numero_cliente) === clienteBuscado;

            // Fallback solo si el item buscado no trae numero_cliente
            const coincideMedidor = !clienteBuscado && medidorBuscado && String(props.numero_medidor) === medidorBuscado;
            const coincideCoords = !clienteBuscado && !coincideMedidor && circleLayer.getLatLng().distanceTo(latlng) < 5;

            if (!coincideCliente && !coincideMedidor && !coincideCoords) return;

            encontradoFlag = true;
            setTimeout(() => {
                const colorOriginal = circleLayer.options.fillColor;
                const borderOriginal = circleLayer.options.color;
                const weightOriginal = circleLayer.options.weight;
                const opacOriginal = circleLayer.options.fillOpacity;
                const radioOriginal = circleLayer.options.radius;

                circleLayer.setStyle({ fillColor: '#ffffff', color: '#1565C0', weight: 3.5, fillOpacity: 0.95 });
                circleLayer.setRadius(14);
                circleLayer.bringToFront();
                circleLayer.openPopup();

                _highlightRestore = () => {
                    circleLayer.setStyle({ 
                        fillColor: colorOriginal, 
                        color: borderOriginal, 
                        weight: weightOriginal, 
                        fillOpacity: opacOriginal 
                    });
                    circleLayer.setRadius(radioOriginal || 4);
                    state.map.closePopup();
                };

                _highlightTimer = setTimeout(_cancelarResaltadoSuministro, 15000);

                setTimeout(() => {
                    _highlightMapClick = () => _cancelarResaltadoSuministro();
                    state.map.once('click', _highlightMapClick);
                }, 400);

            }, 350);
        });
    });
}
