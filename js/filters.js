// Lógica de filtrado de capas y selección en la barra lateral (Sidebar)
import { state } from './state.js';
import { showStatus, zoomToGeometry } from './utils.js';
import { 
    renderDataToLayer, 
    fitViewToLayerGroup, 
    renderRedGasWithDiameterClassification, 
    setArbaToWMS, 
    removeArbaWMS, 
    handleCheckboxChange 
} from './map.js';
import { loadFilteredPostGIS, loadParcelasFromWFS } from './db.js';
import { inicializarModuloRuteo, limpiarModuloRuteo } from './routing.js';
import { mostrarBuscadorCalles, ocultarBuscadorCalles } from './search.js';
import { renderIndicadores } from './kpis.js';

/**
 * Rellena el selector de Unidad Regional con los valores del caché
 */
export function populateUnidadRegionalSelect() {
    const select = document.getElementById('selectUnidadRegional');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccione Unidad Regional --</option>';
    const unidades = [...new Set(state.localidadesData.map(l => l.unidad_regional).filter(ur => ur))].sort();
    unidades.forEach(unidad => {
        const option = document.createElement('option');
        option.value = unidad;
        option.textContent = unidad;
        select.appendChild(option);
    });
    select.disabled = false;
    const applyBtn = document.getElementById('applyUnidadRegionalFilter');
    const clearBtn = document.getElementById('clearUnidadRegionalFilter');
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

/**
 * Rellena el selector de Localidades (Áreas de Servicio)
 */
export function populateLocalidadSelect() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccione Área de Servicio --</option>';
    state.localidadesData.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    state.localidadesData.forEach(item => {
        if (!item.nombre) return;
        const option = document.createElement('option');
        option.value = item.nombre;
        option.textContent = item.nombre;
        select.appendChild(option);
    });
}

export function enableLocalidadFilter() {
    const select = document.getElementById('selectLocalidad');
    const applyBtn = document.getElementById('applyLocalidadFilter');
    const clearBtn = document.getElementById('clearLocalidadFilter');
    if (select) select.disabled = false;
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

/**
 * Habilita capas secundarias dependientes y las asocia al nombre del filtro
 */
export function enableDependentLayers(filterName) {
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    const arbaLabel = document.getElementById('label-arba');

    if (redGasLabel) {
        redGasLabel.innerHTML = `<input type="checkbox" id="layer-red_de_gas" data-table="red_de_gas" checked> Red de Gas (${filterName})`;
        const cb = document.getElementById('layer-red_de_gas');
        if (cb) cb.addEventListener('change', handleCheckboxChange);
    }
    if (callesLabel) {
        callesLabel.innerHTML = `<input type="checkbox" id="layer-calles" data-table="calles" checked> Calles (${filterName})`;
        const cb = document.getElementById('layer-calles');
        if (cb) cb.addEventListener('change', handleCheckboxChange);
    }
    if (suministrosLabel) {
        suministrosLabel.innerHTML = `<input type="checkbox" id="layer-suministros" data-table="suministros" checked> Suministros (${filterName})`;
        const cb = document.getElementById('layer-suministros');
        if (cb) cb.addEventListener('change', handleCheckboxChange);
    }
    if (arbaLabel) {
        arbaLabel.innerHTML = `<input type="checkbox" id="layer-arba" data-table="arba" checked> Parcelas (${filterName})`;
        const cb = document.getElementById('layer-arba');
        if (cb) cb.addEventListener('change', handleCheckboxChange);
    }

    setTimeout(() => {
        if (state.layerGroups.red_de_gas && !state.map.hasLayer(state.layerGroups.red_de_gas)) state.layerGroups.red_de_gas.addTo(state.map);
        if (state.layerGroups.calles && !state.map.hasLayer(state.layerGroups.calles)) state.layerGroups.calles.addTo(state.map);
        if (state.layerGroups.suministros && !state.map.hasLayer(state.layerGroups.suministros)) state.layerGroups.suministros.addTo(state.map);
        if (state.layerGroups.arba && !state.map.hasLayer(state.layerGroups.arba)) state.layerGroups.arba.addTo(state.map);
    }, 100);
}

/**
 * Invoca el filtro de localidad desde el botón de la UI
 */
export async function applyLocalidadFilter() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    const localidadNombre = select.value;
    if (!localidadNombre) {
        showStatus('Seleccione una localidad', 'error');
        return;
    }
    document.querySelectorAll('.filter-section').forEach(s => s.classList.remove('active-filter'));
    if (select.parentElement) select.parentElement.classList.add('active-filter');
    await aplicarFiltroLocalidad(localidadNombre);
}

/**
 * Lógica principal de filtrado espacial por área de servicio
 */
export async function aplicarFiltroLocalidad(localidadNombre) {
    console.log('Aplicando filtro localidad...');

    const localidad = state.localidadesData.find(l => l.nombre === localidadNombre);
    if (!localidad) {
        showStatus('Localidad no encontrada', 'error');
        return;
    }

    const numFimm = localidad.num_fimm;
    console.log(`Localidad: ${localidadNombre}, num_fimm: ${numFimm}`);

    state.currentFilter = {
        type: 'localidad',
        name: localidadNombre,
        data: localidad,
        geometry: localidad.geom,
        num_fimm: [numFimm]
    };

    showStatus(`Filtrando ${localidadNombre}...`, 'loading');
    enableDependentLayers(localidadNombre);

    state.layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', [localidad], state.filteredStyle.localidades);
    if (!state.map.hasLayer(state.layerGroups.localidades)) state.layerGroups.localidades.addTo(state.map);
    
    const cbLocalidades = document.getElementById('layer-localidades');
    if (cbLocalidades) { cbLocalidades.checked = true; cbLocalidades.disabled = false; }

    const municipioPadre = state.municipiosData.find(m => m.nam === localidad.partido || m.nam === localidad.partido_ig);
    state.layerGroups.municipios.clearLayers();
    if (municipioPadre) {
        renderDataToLayer('municipios', [municipioPadre], state.filteredStyle.municipios);
        if (state.map.hasLayer(state.layerGroups.municipios)) state.map.removeLayer(state.layerGroups.municipios);
        const cb = document.getElementById('layer-municipios');
        if (cb) { cb.checked = false; cb.disabled = false; }
    }

    if (localidad.geom) zoomToGeometry(localidad.geom);

    // Cargar calles
    const callesResult = await loadFilteredPostGIS('calles', 'localidad', localidadNombre);
    state.callesFiltradas = callesResult;
    state.layerGroups.calles.clearLayers();
    if (state.callesFiltradas.length > 0) {
        renderDataToLayer('calles', state.callesFiltradas);
        if (!state.map.hasLayer(state.layerGroups.calles)) state.layerGroups.calles.addTo(state.map);
        console.log(`✓ ${state.callesFiltradas.length} calles cargadas`);
    }

    // Cargar red de gas
    const redGasFiltrada = await loadFilteredPostGIS('red_de_gas', 'localidad', localidadNombre);
    state.layerGroups.red_de_gas.clearLayers();
    if (redGasFiltrada.length > 0) {
        renderRedGasWithDiameterClassification(redGasFiltrada);
        if (!state.map.hasLayer(state.layerGroups.red_de_gas)) state.layerGroups.red_de_gas.addTo(state.map);
        console.log(`✓ ${redGasFiltrada.length} red de gas cargada`);
    }

    // ARBA WFS
    let arbaItems = [];
    try {
        arbaItems = await loadParcelasFromWFS(localidadNombre, localidad.geom, 'localidad');
    } catch (e) {
        console.warn('Error cargando parcelas desde WFS, fallback a WMS:', e);
    }
    if (!arbaItems || arbaItems.length === 0) {
        await setArbaToWMS();
    }

    // Filtrar suministros en caché
    console.log(`Filtrando suministros por Localidad = ${numFimm}`);
    const suministrosFiltrados = state.suministrosData.filter(s => s.localidad === localidadNombre);
    console.log(`📊 Suministros encontrados en filtro: ${suministrosFiltrados.length}`);

    if (suministrosFiltrados.length > 0) {
        renderDataToLayer('suministros', suministrosFiltrados);
        if (!state.map.hasLayer(state.layerGroups.suministros)) state.layerGroups.suministros.addTo(state.map);
        inicializarModuloRuteo(suministrosFiltrados, localidadNombre);
    } else {
        console.log('⚠️ No se encontraron suministros para esta localidad');
        limpiarModuloRuteo();
    }

    setTimeout(() => fitViewToLayerGroup('localidades'), 500);

    const summary = `${localidadNombre}: ${state.callesFiltradas.length} calles, ${redGasFiltrada.length} red gas, ${suministrosFiltrados.length} suministros, ${(state.arbaDatosFiltrados || []).length} ARBA`;
    showStatus(summary, 'success');
    actualizarIndicadoresSiAbierto();
    if (state.callesFiltradas.length > 0) mostrarBuscadorCalles();

    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) downloadBtn.disabled = false;

    const downloadCallesBtn = document.getElementById('downloadCallesBtn');
    if (downloadCallesBtn) downloadCallesBtn.disabled = (state.callesFiltradas.length === 0);
}

/**
 * Filtro por Unidad Regional
 */
export async function applyUnidadRegionalFilter() {
    const selectUnidadRegional = document.getElementById('selectUnidadRegional');
    const unidadRegional = selectUnidadRegional.value;

    if (!unidadRegional) {
        showStatus('Seleccione una unidad regional', 'error');
        return;
    }

    console.log('Aplicando filtro por unidad regional:', unidadRegional);
    showStatus(`Filtrando por unidad regional: ${unidadRegional}...`, 'loading');

    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    selectUnidadRegional.closest('.filter-section').classList.add('active-filter');

    state.currentFilter = {
        type: 'unidad_regional',
        name: unidadRegional,
        num_fimm: []
    };

    const localidadesFiltradas = state.localidadesData.filter(l => l.unidad_regional === unidadRegional);

    if (localidadesFiltradas.length === 0) {
        showStatus(`No se encontraron localidades para ${unidadRegional}`, 'error');
        return;
    }

    console.log(`Localidades encontradas: ${localidadesFiltradas.length}`);
    state.currentFilter.num_fimm = localidadesFiltradas.map(l => l.num_fimm).filter(n => n != null);

    state.layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', localidadesFiltradas, state.filteredStyle.localidades);
    if (!state.map.hasLayer(state.layerGroups.localidades)) state.layerGroups.localidades.addTo(state.map);
    
    const localidadesCheckbox = document.getElementById('layer-localidades');
    if (localidadesCheckbox) {
        localidadesCheckbox.checked = true;
        localidadesCheckbox.disabled = false;
    }

    const municipiosUnicos = [...new Set(localidadesFiltradas.map(l => l.municipio))];
    const municipiosFiltrados = state.municipiosData.filter(m => municipiosUnicos.includes(m.municipio));
    state.layerGroups.municipios.clearLayers();
    if (municipiosFiltrados.length > 0) {
        renderDataToLayer('municipios', municipiosFiltrados, state.filteredStyle.municipios);
        if (state.map.hasLayer(state.layerGroups.municipios)) state.map.removeLayer(state.layerGroups.municipios);
        const municipiosCheckbox = document.getElementById('layer-municipios');
        if (municipiosCheckbox) municipiosCheckbox.checked = false;
    }

    setTimeout(() => fitViewToLayerGroup('localidades'), 500);
    habilitarCapasDependientesApagadas(unidadRegional);

    // Cargar calles
    const callesUR = await loadFilteredPostGIS('calles', 'localidad', unidadRegional);
    state.callesFiltradas = callesUR;
    state.layerGroups.calles.clearLayers();
    if (state.callesFiltradas.length > 0) {
        renderDataToLayer('calles', state.callesFiltradas);
        if (state.map.hasLayer(state.layerGroups.calles)) state.map.removeLayer(state.layerGroups.calles);
    }

    // Cargar red de gas
    const redGasUR = await loadFilteredPostGIS('red_de_gas', 'localidad', unidadRegional);
    state.layerGroups.red_de_gas.clearLayers();
    if (redGasUR.length > 0) {
        renderRedGasWithDiameterClassification(redGasUR);
        if (state.map.hasLayer(state.layerGroups.red_de_gas)) state.map.removeLayer(state.layerGroups.red_de_gas);
        document.getElementById('toggleLegendBtn').style.display = 'none';
        document.getElementById('legend').style.display = 'none';
    }

    // ARBA WFS
    let arbaUR = [];
    try {
        arbaUR = await loadParcelasFromWFS(unidadRegional, null, 'unidad_regional');
    } catch (e) {
        console.warn('Error WFS unidad regional:', e);
    }
    if (!arbaUR || arbaUR.length === 0) {
        await setArbaToWMS();
        if (state.layerGroups.arba && state.map.hasLayer(state.layerGroups.arba)) state.map.removeLayer(state.layerGroups.arba);
    }

    // Cargar suministros filtrados
    const nombresUR = localidadesFiltradas.map(l => l.nombre).filter(Boolean);
    const suministrosUR = state.suministrosData.filter(s => nombresUR.includes(s.localidad));
    console.log(`📊 Suministros encontrados: ${suministrosUR.length}`);

    if (suministrosUR.length > 0) {
        renderDataToLayer('suministros', suministrosUR);
        if (state.map.hasLayer(state.layerGroups.suministros)) state.map.removeLayer(state.layerGroups.suministros);
        inicializarModuloRuteo(suministrosUR, unidadRegional);
    }

    const containerTitle = document.getElementById('localidadesURTitle');
    if (containerTitle) containerTitle.textContent = 'Áreas de Servicio de la Unidad Regional';
    mostrarListaLocalidadesUR(localidadesFiltradas);
    showStatus(`${localidadesFiltradas.length} localidades en ${unidadRegional}`, 'success');
    actualizarIndicadoresSiAbierto();

    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) downloadBtn.disabled = false;

    const downloadCallesBtn = document.getElementById('downloadCallesBtn');
    if (downloadCallesBtn) downloadCallesBtn.disabled = (state.callesFiltradas.length === 0);
}

export function habilitarCapasDependientesApagadas(filterName) {
    ['red_de_gas', 'calles', 'suministros', 'arba'].forEach(capa => {
        const label = document.getElementById(`label-${capa}`);
        const nombres = { red_de_gas: 'Red de Gas', calles: 'Calles', suministros: 'Suministros', arba: 'Parcelas' };
        if (label) {
            label.innerHTML = `<input type="checkbox" id="layer-${capa}" data-table="${capa}"> ${nombres[capa]} (${filterName})`;
            const cb = document.getElementById(`layer-${capa}`);
            if (cb) cb.addEventListener('change', handleCheckboxChange);
        }
    });
}

export function mostrarListaLocalidadesUR(localidades) {
    const container = document.getElementById('localidadesURContainer');
    const list = document.getElementById('localidadesURList');
    if (!container || !list) return;
    list.innerHTML = '';
    
    localidades.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(loc => {
        const item = document.createElement('div');
        item.className = 'localidad-ur-item';
        item.textContent = loc.nombre || `Localidad ${loc.num_fimm}`;
        item.addEventListener('click', async () => {
            const selectLocalidad = document.getElementById('selectLocalidad');
            if (selectLocalidad) selectLocalidad.value = loc.nombre;
            await aplicarFiltroLocalidad(loc.nombre);
        });
        list.appendChild(item);
    });
    container.style.display = 'block';
}

/**
 * Filtro por Producto y Turno
 */
export function populateProductoTurnoSelects() {
    const selectProducto = document.getElementById('selectProducto');
    const selectTurno = document.getElementById('selectTurno');
    if (!selectProducto || !selectTurno) return;

    const productos = [...new Set(state.localidadesData.map(l => l.producto).filter(Boolean))].sort();
    const turnos = [...new Set(state.localidadesData.map(l => l.turno).filter(Boolean))].sort();

    selectProducto.innerHTML = '<option value="">-- Todos los Productos --</option>';
    productos.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        selectProducto.appendChild(option);
    });

    selectTurno.innerHTML = '<option value="">-- Todos los Turnos --</option>';
    turnos.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        selectTurno.appendChild(option);
    });

    selectProducto.disabled = false;
    selectTurno.disabled = false;
    const applyBtn = document.getElementById('applyProductoTurnoFilter');
    const clearBtn = document.getElementById('clearProductoTurnoFilter');
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

export async function applyProductoTurnoFilter() {
    const selectProducto = document.getElementById('selectProducto');
    const selectTurno = document.getElementById('selectTurno');

    const producto = selectProducto.value;
    const turno = selectTurno.value;

    if (!producto && !turno) {
        showStatus('Seleccione al menos un tipo de producto o turno', 'error');
        return;
    }

    console.log(`Aplicando filtro: Producto=${producto}, Turno=${turno}`);
    showStatus('Filtrando áreas de servicio...', 'loading');

    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    selectProducto.closest('.filter-section').classList.add('active-filter');

    const localidadesFiltradas = state.localidadesData.filter(l => {
        const matchProducto = !producto || l.producto === producto;
        const matchTurno = !turno || l.turno === turno;
        return matchProducto && matchTurno;
    });

    if (localidadesFiltradas.length === 0) {
        showStatus('No se encontraron localidades con esos criterios', 'error');
        return;
    }

    state.currentFilter = {
        type: 'producto_turno',
        name: `Prod: ${producto || 'Todos'} / Turno: ${turno || 'Todos'}`,
        num_fimm: localidadesFiltradas.map(l => l.num_fimm).filter(n => n != null)
    };

    state.layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', localidadesFiltradas, state.filteredStyle.localidades);
    if (!state.map.hasLayer(state.layerGroups.localidades)) state.layerGroups.localidades.addTo(state.map);
    
    const localidadesCheckbox = document.getElementById('layer-localidades');
    if (localidadesCheckbox) {
        localidadesCheckbox.checked = true;
        localidadesCheckbox.disabled = false;
    }

    const municipiosUnicos = [...new Set(localidadesFiltradas.map(l => l.municipio))];
    const municipiosFiltrados = state.municipiosData.filter(m => municipiosUnicos.includes(m.municipio));
    state.layerGroups.municipios.clearLayers();
    if (municipiosFiltrados.length > 0) {
        renderDataToLayer('municipios', municipiosFiltrados, state.filteredStyle.municipios);
        if (state.map.hasLayer(state.layerGroups.municipios)) state.map.removeLayer(state.layerGroups.municipios);
        const municipiosCheckbox = document.getElementById('layer-municipios');
        if (municipiosCheckbox) municipiosCheckbox.checked = false;
    }

    setTimeout(() => fitViewToLayerGroup('localidades'), 500);
    habilitarCapasDependientesApagadas(state.currentFilter.name);

    state.layerGroups.calles.clearLayers();
    state.layerGroups.red_de_gas.clearLayers();

    // Suministros
    let nombresFilter = [];
    const numFimmsFilter = (state.currentFilter.num_fimm || []).map(String);
    nombresFilter = state.localidadesData
        .filter(l => numFimmsFilter.includes(String(l.num_fimm)))
        .map(l => l.nombre).filter(Boolean);
        
    const suministrosFiltro = state.suministrosData.filter(s => nombresFilter.includes(s.localidad));

    if (suministrosFiltro.length > 0) {
        renderDataToLayer('suministros', suministrosFiltro);
        if (state.map.hasLayer(state.layerGroups.suministros)) state.map.removeLayer(state.layerGroups.suministros);
        inicializarModuloRuteo(suministrosFiltro, state.currentFilter.name);
    }

    const containerTitle = document.getElementById('localidadesURTitle');
    if (containerTitle) containerTitle.textContent = 'Áreas de Servicio Filtradas';
    mostrarListaLocalidadesUR(localidadesFiltradas);

    showStatus(`${localidadesFiltradas.length} localidades encontradas`, 'success');
    actualizarIndicadoresSiAbierto();

    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) downloadBtn.disabled = false;

    const downloadCallesBtn = document.getElementById('downloadCallesBtn');
    if (downloadCallesBtn) downloadCallesBtn.disabled = true;
}

/**
 * Limpia todos los filtros y restaura la visualización completa
 */
export function clearFilter() {
    console.log('Limpiando filtro');

    state.currentFilter = null;

    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) downloadBtn.disabled = true;

    const downloadCallesBtn = document.getElementById('downloadCallesBtn');
    if (downloadCallesBtn) downloadCallesBtn.disabled = true;

    const selectLocalidad = document.getElementById('selectLocalidad');
    const selectUnidadRegional = document.getElementById('selectUnidadRegional');
    const selectProducto = document.getElementById('selectProducto');
    const selectTurno = document.getElementById('selectTurno');

    if (selectLocalidad) selectLocalidad.value = '';
    if (selectUnidadRegional) selectUnidadRegional.value = '';
    if (selectProducto) selectProducto.value = '';
    if (selectTurno) selectTurno.value = '';

    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });

    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    const arbaLabel = document.getElementById('label-arba');

    if (redGasLabel) {
        redGasLabel.innerHTML = `<input type="checkbox" id="layer-red_de_gas" data-table="red_de_gas" disabled> Red de Gas (requiere filtro)`;
    }
    if (callesLabel) {
        callesLabel.innerHTML = `<input type="checkbox" id="layer-calles" data-table="calles" disabled> Calles (requiere filtro)`;
    }
    if (suministrosLabel) {
        suministrosLabel.innerHTML = `<input type="checkbox" id="layer-suministros" data-table="suministros" disabled> Suministros (requiere filtro)`;
    }
    if (arbaLabel) {
        arbaLabel.innerHTML = `<input type="checkbox" id="layer-arba" data-table="arba" disabled> Parcelas (requiere filtro)`;
    }

    const redGasCheckbox = document.getElementById('layer-red_de_gas');
    const callesCheckbox = document.getElementById('layer-calles');
    const suministrosCheckbox = document.getElementById('layer-suministros');
    const arbaCheckbox = document.getElementById('layer-arba');

    if (redGasCheckbox) { redGasCheckbox.checked = false; redGasCheckbox.disabled = true; }
    if (callesCheckbox) { callesCheckbox.checked = false; callesCheckbox.disabled = true; }
    if (suministrosCheckbox) { suministrosCheckbox.checked = false; suministrosCheckbox.disabled = true; }
    if (arbaCheckbox) { arbaCheckbox.checked = false; arbaCheckbox.disabled = true; }

    if (state.layerGroups.red_de_gas && state.map.hasLayer(state.layerGroups.red_de_gas)) state.map.removeLayer(state.layerGroups.red_de_gas);
    if (state.layerGroups.calles && state.map.hasLayer(state.layerGroups.calles)) state.map.removeLayer(state.layerGroups.calles);
    if (state.layerGroups.suministros && state.map.hasLayer(state.layerGroups.suministros)) state.map.removeLayer(state.layerGroups.suministros);
    if (state.layerGroups.arba && state.map.hasLayer(state.layerGroups.arba)) state.map.removeLayer(state.layerGroups.arba);

    if (state.layerGroups.red_de_gas) state.layerGroups.red_de_gas.clearLayers();
    if (state.layerGroups.calles) state.layerGroups.calles.clearLayers();
    if (state.layerGroups.suministros) state.layerGroups.suministros.clearLayers();
    if (state.layerGroups.arba) state.layerGroups.arba.clearLayers();
    
    state.callesFiltradas = [];
    ocultarBuscadorCalles();
    removeArbaWMS();

    if (state.suministrosData.length > 0) {
        renderDataToLayer('suministros', state.suministrosData);
    }

    if (state.municipiosData.length > 0) renderDataToLayer('municipios', state.municipiosData);
    if (state.localidadesData.length > 0) renderDataToLayer('localidades', state.localidadesData);

    if (!state.map.hasLayer(state.layerGroups.municipios)) state.layerGroups.municipios.addTo(state.map);

    const municipiosCheckbox = document.getElementById('layer-municipios');
    if (municipiosCheckbox) municipiosCheckbox.checked = true;

    document.getElementById('toggleLegendBtn').style.display = 'none';
    document.getElementById('legend').style.display = 'none';

    const localidadesURContainer = document.getElementById('localidadesURContainer');
    if (localidadesURContainer) {
        localidadesURContainer.style.display = 'none';
        document.getElementById('localidadesURList').innerHTML = '';
    }

    limpiarModuloRuteo();
    state.map.setView([-36.14685, -60.28183], 6);
    showStatus('Filtro limpiado', 'success');
}

export function actualizarIndicadoresSiAbierto() {
    const panel = document.getElementById('indicadoresPanel');
    if (panel && panel.classList.contains('open')) renderIndicadores();
}
