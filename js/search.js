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

function _cancelarResaltadoSuministro() {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    if (_highlightMapClick) { state.map.off('click', _highlightMapClick); _highlightMapClick = null; }
    if (_highlightRestore) { _highlightRestore(); _highlightRestore = null; }
}

/**
 * Centra la vista en el suministro y lo resalta de forma temporal
 */
export function zoomASuministro(item) {
    const geom = item.geom || item.wkt_geom || item.the_geom;
    if (!geom) return;
    let coords;
    
    if (typeof geom === 'object' && geom.coordinates) coords = geom.coordinates;
    else if (typeof geom === 'string') { 
        const gj = wktToGeoJSON(geom); 
        if (gj && gj.coordinates) coords = gj.coordinates; 
    }
    if (!coords) return;

    const latlng = L.latLng(coords[1], coords[0]);
    state.map.setView(latlng, 18);

    _cancelarResaltadoSuministro();

    const medidorBuscado = item.numero_medidor != null ? String(item.numero_medidor) : null;
    let encontrado = false;

    state.layerGroups.suministros.eachLayer(function (geoJsonLayer) {
        if (encontrado) return;
        geoJsonLayer.eachLayer(function (circleLayer) {
            if (encontrado) return;
            if (!circleLayer.getLatLng) return;

            const props = circleLayer.feature && circleLayer.feature.properties;
            const coincideMedidor = medidorBuscado && props && String(props.numero_medidor) === medidorBuscado;
            const coincideCoords = !coincideMedidor && circleLayer.getLatLng().distanceTo(latlng) < 5;
            if (!coincideMedidor && !coincideCoords) return;

            encontrado = true;
            setTimeout(() => {
                const colorOriginal = circleLayer.options.fillColor;
                const borderOriginal = circleLayer.options.color;
                const weightOriginal = circleLayer.options.weight;
                const opacOriginal = circleLayer.options.fillOpacity;
                const radioOriginal = circleLayer.options.radius;

                // Estilo destacado: blanco grande con borde azul
                circleLayer.setStyle({ fillColor: '#ffffff', color: '#1565C0', weight: 3.5, fillOpacity: 0.95 });
                circleLayer.setRadius(14);
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
