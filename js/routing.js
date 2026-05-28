// Módulo de Gestión y Optimización de Rutas (Ruteo de Suministros)
import { state } from './state.js';
import { showStatus, obtenerColorRuta } from './utils.js';
import { renderDataToLayer, actualizarColorPuntoByMedidor } from './map.js';

/**
 * Inicializa el módulo de ruteo con un listado de suministros y localidad
 */
export function inicializarModuloRuteo(suministros, localidadNombre) {
    console.log('📦 Inicializando módulo de ruteo con', suministros.length, 'suministros');

    state.localidadFiltroActual = localidadNombre;
    state.borrador = [];
    state.suministrosBorradorMap = {};
    state.modoEdicion = false;
    state.rutasVisibles.clear();

    // Clasificar suministros
    state.suministrosConRuta = suministros.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
    state.suministrosSinRuta = suministros.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');

    console.log(`📊 Clasificación: ${state.suministrosConRuta.length} con ruta+orden, ${state.suministrosSinRuta.length} sin asignar`);

    // Inicializar mapa de borrador
    suministros.forEach(s => {
        state.suministrosBorradorMap[s.numero_medidor] = { ruta: s.ruta ?? null, orden: s.orden ?? null };
    });

    // Inicializar visibilidad de rutas (todas visibles por defecto)
    const rutasUnicas = [...new Set(state.suministrosConRuta.map(s => String(s.ruta)))];
    rutasUnicas.forEach(ruta => state.rutasVisibles.set(ruta, true));

    if (state.layerGroups.suministros) {
        renderDataToLayer('suministros', suministros);
    }

    renderPanelRuteo();
}

/**
 * Limpia el estado de ruteo y remueve capas temporales
 */
export function limpiarModuloRuteo() {
    if (state.ruteoLayerGroup) { state.map.removeLayer(state.ruteoLayerGroup); state.ruteoLayerGroup = null; }
    if (state.ruteoSinAsignarLayer) { state.map.removeLayer(state.ruteoSinAsignarLayer); state.ruteoSinAsignarLayer = null; }
    if (state.capaRutasGroup) { state.map.removeLayer(state.capaRutasGroup); state.capaRutasGroup = null; }

    state.suministrosConRuta = [];
    state.suministrosSinRuta = [];
    state.borrador = [];
    state.suministrosBorradorMap = {};
    state.modoEdicion = false;
    state.localidadFiltroActual = null;
    state.rutasVisibles.clear();

    const panel = document.getElementById('ruteoModuloPanel');
    if (panel) panel.style.display = 'none';
}

/**
 * Genera y muestra la sección de Gestión de Rutas en la barra lateral
 */
export function renderPanelRuteo() {
    let panel = document.getElementById('ruteoModuloPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'ruteoModuloPanel';
        panel.className = 'filter-section';
        const capasH3 = [...document.querySelectorAll('#sidebar h3')].find(h => h.textContent.includes('Capas Disponibles'));
        if (capasH3) {
            capasH3.parentNode.insertBefore(panel, capasH3);
        } else {
            document.getElementById('sidebar').appendChild(panel);
        }
    }

    const rutasUnicas = [...new Set(state.suministrosConRuta.map(s => String(s.ruta)))].sort((a, b) => Number(a) - Number(b));
    const yaAsignadosEnBorrador = new Set(state.borrador.map(b => String(b.medidor)));
    const sinAsignarCount = state.suministrosSinRuta.filter(s => !yaAsignadosEnBorrador.has(String(s.numero_medidor))).length;
    const hayBorrador = state.borrador.length > 0;

    panel.innerHTML = `
        <h3>🗺️ Gestión de Rutas</h3>
        
        <div style="font-size:0.82em; color:#555; margin-bottom:8px;">
            ${state.localidadFiltroActual || ''} · ${rutasUnicas.length} ruta(s) · 
            <span style="color:${sinAsignarCount > 0 ? '#c0392b' : '#27ae60'}; font-weight:bold;">
                ${sinAsignarCount} sin asignar
            </span>
        </div>
        
        ${rutasUnicas.length > 0 ? `
        <div style="margin-bottom:10px; max-height:200px; overflow-y:auto;">
            ${rutasUnicas.map(ruta => {
                const sumisEnRuta = state.suministrosConRuta.filter(s => String(s.ruta) === ruta);
                const color = obtenerColorRuta(ruta);
                const esVisible = state.rutasVisibles.get(ruta) !== false;
                return `
                    <div class="ruta-item" data-ruta="${ruta}" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 6px 8px;
                        margin: 4px 0;
                        background: ${color}15;
                        border-left: 4px solid ${color};
                        border-radius: 4px;
                        opacity: ${esVisible ? '1' : '0.5'};
                    ">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="ruta-toggle-btn" data-ruta="${ruta}" style="
                                width: 28px;
                                height: 28px;
                                background: ${color};
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                                margin: 0;
                            ">${esVisible ? '👁️' : '👁️‍🗨️'}</button>
                            <strong style="color: ${color};font-size: 12px;">📭 Ruta ${ruta}</strong>
                        </div>
                        <span style="background: ${color}30; padding: 2px 6px; border-radius: 10px; font-size: 10px;">
                            ${sumisEnRuta.length} sum.
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
        ` : `<div style="font-size:0.82em; color:#888; margin-bottom:8px;">📭 No hay rutas asignadas</div>`}
        
        ${sinAsignarCount > 0 ? `
        <button id="ruteoModoEdicionBtn" class="filter-btn" style="background:${state.modoEdicion ? '#c0392b' : '#2980b9'}; margin-bottom:4px;">
            ${state.modoEdicion ? '⏹ Salir de asignación' : '✏️ Asignar puntos sin ruta'}
        </button>
        ` : ''}
        
        ${hayBorrador ? `
        <div style="background:#fff3cd; border:1px solid #ffc107; border-radius:4px; padding:6px 8px; font-size:0.8em; margin-bottom:6px;">
            <strong>⚠️ Borrador:</strong> ${state.borrador.length} cambio(s) pendiente(s)
        </div>
        <button id="ruteoConfirmarBtn" class="filter-btn" style="background:#27ae60; margin-bottom:3px;">
            💾 Confirmar y guardar
        </button>
        <button id="ruteoDescartarBtn" class="filter-btn clear" style="margin-bottom:4px;">
            ✗ Descartar cambios
        </button>
        ` : ''}
    `;

    panel.style.display = 'block';

    document.querySelectorAll('.ruta-toggle-btn').forEach(btn => {
        btn.removeEventListener('click', handleRutaToggle);
        btn.addEventListener('click', handleRutaToggle);
    });

    document.getElementById('ruteoModoEdicionBtn')?.removeEventListener('click', toggleModoEdicion);
    document.getElementById('ruteoModoEdicionBtn')?.addEventListener('click', toggleModoEdicion);
    
    document.getElementById('ruteoConfirmarBtn')?.removeEventListener('click', confirmarBorrador);
    document.getElementById('ruteoConfirmarBtn')?.addEventListener('click', confirmarBorrador);
    
    document.getElementById('ruteoDescartarBtn')?.removeEventListener('click', descartarBorrador);
    document.getElementById('ruteoDescartarBtn')?.addEventListener('click', descartarBorrador);
}

export function handleRutaToggle(e) {
    e.stopPropagation();
    const ruta = e.currentTarget.getAttribute('data-ruta');
    toggleVisibilidadRuta(ruta);
}

export function toggleVisibilidadRuta(ruta) {
    const esVisible = state.rutasVisibles.get(ruta);
    state.rutasVisibles.set(ruta, !esVisible);

    // Ocultar/mostrar círculos de esta ruta
    state.layerGroups.suministros.eachLayer(function (geoJsonLayer) {
        geoJsonLayer.eachLayer(function (circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.ruta) === String(ruta)) {
                if (esVisible) {
                    if (state.map.hasLayer(circleLayer)) state.map.removeLayer(circleLayer);
                } else {
                    if (!state.map.hasLayer(circleLayer)) circleLayer.addTo(state.map);
                }
            }
        });
    });

    const rutaItem = document.querySelector(`.ruta-item[data-ruta="${ruta}"]`);
    if (rutaItem) {
        const toggleBtn = rutaItem.querySelector('.ruta-toggle-btn');
        if (toggleBtn) {
            toggleBtn.textContent = !esVisible ? '👁️' : '👁️‍🗨️';
        }
        rutaItem.style.opacity = !esVisible ? '1' : '0.5';
    }

    showStatus(`${!esVisible ? 'Mostrando' : 'Ocultando'} ruta ${ruta}`, 'success');
}

export function toggleModoEdicion() {
    state.modoEdicion = !state.modoEdicion;

    if (state.modoEdicion) {
        renderPuntosSinAsignar();
        state.map.getContainer().style.cursor = 'crosshair';
        showStatus('✏️ Modo edición activado. Haga clic en un punto sin asignar para asignarlo.', 'loading');
    } else {
        if (state.ruteoSinAsignarLayer) { state.map.removeLayer(state.ruteoSinAsignarLayer); state.ruteoSinAsignarLayer = null; }
        state.map.getContainer().style.cursor = '';
        showStatus('Modo edición desactivado.', 'success');
    }

    renderPanelRuteo();
}

/**
 * Renderiza los puntos sin asignar con una coloración rosa distintiva
 */
export function renderPuntosSinAsignar() {
    if (state.ruteoSinAsignarLayer) { state.map.removeLayer(state.ruteoSinAsignarLayer); state.ruteoSinAsignarLayer = null; }
    state.ruteoSinAsignarLayer = L.layerGroup().addTo(state.map);

    const yaAsignados = new Set(state.borrador.map(b => String(b.medidor)));
    const pendientes = state.suministrosSinRuta.filter(s => !yaAsignados.has(String(s.numero_medidor)));

    console.log(`📍 Puntos sin asignar a renderizar: ${pendientes.length}`);

    pendientes.forEach(s => {
        const latlng = getLatLngFromSuministro(s);
        if (!latlng) return;

        const marker = L.circleMarker(latlng, {
            radius: 7,
            fillColor: '#c26b8a',
            color: 'rgba(255,255,255,0.35)',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.92
        }).bindTooltip(`Sin asignar<br>Medidor: ${s.numero_medidor}<br>${s.cliente || ''}`, { permanent: false });

        marker.on('click', () => abrirPopupAsignacion(s, marker));
        state.ruteoSinAsignarLayer.addLayer(marker);
    });

    if (pendientes.length === 0 && state.modoEdicion) {
        showStatus('✓ Todos los puntos están asignados.', 'success');
        state.modoEdicion = false;
        renderPanelRuteo();
    }
}

/**
 * Abre la ventana modal interactiva de Leaflet para reasignar el suministro clicado
 */
export function abrirPopupAsignacion(suministro, marker) {
    const rutasExistentes = [...new Set(state.suministrosConRuta.map(s => String(s.ruta)))].sort((a, b) => Number(a) - Number(b));
    const siguienteOrden = {};
    rutasExistentes.forEach(r => { siguienteOrden[r] = getSiguienteOrden(r); });

    const popupId = `asig_${suministro.numero_medidor}`;

    const html = `
        <div style="min-width:220px; font-size:0.85em;">
            <strong>✏️ Asignar suministro</strong><br>
            <span style="color:#555;">Medidor: ${suministro.numero_medidor}</span><br>
            <span style="color:#555;">${suministro.cliente || ''}</span>
            <hr style="margin:6px 0;">
            
            <label style="font-weight:600;">🚚 Ruta:</label>
            <select id="${popupId}_ruta" style="width:100%; margin:3px 0 6px;">
                ${rutasExistentes.map(r => `<option value="${r}">Ruta ${r} (siguiente orden: ${siguienteOrden[r]})</option>`).join('')}
                <option value="__nueva__">+ Crear nueva ruta</option>
            </select>
            
            <div id="${popupId}_nuevaRutaDiv" style="display:none; margin-bottom:6px;">
                <label style="font-weight:600;">Número de nueva ruta:</label>
                <input id="${popupId}_nuevaRuta" type="number" min="1" style="width:100%; margin-top:3px;" placeholder="Ej: 5">
            </div>
            
            <label style="font-weight:600;">🔢 Orden:</label>
            <input id="${popupId}_orden" type="number" min="1" style="width:100%; margin:3px 0 8px;" value="${rutasExistentes.length > 0 ? siguienteOrden[rutasExistentes[0]] : 1}">
            
            <button onclick="confirmarAsignacionPopup('${suministro.numero_medidor}', '${popupId}')"
                style="width:100%; padding:6px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer;">
                ✓ Confirmar Asignación
            </button>
        </div>
    `;

    L.popup({ maxWidth: 260 }).setLatLng(marker.getLatLng()).setContent(html).openOn(state.map);

    setTimeout(() => {
        const selectRuta = document.getElementById(`${popupId}_ruta`);
        const nuevaDiv = document.getElementById(`${popupId}_nuevaRutaDiv`);
        const ordenInput = document.getElementById(`${popupId}_orden`);
        if (!selectRuta) return;

        selectRuta.addEventListener('change', function () {
            if (this.value === '__nueva__') {
                nuevaDiv.style.display = 'block';
                ordenInput.value = 1;
            } else {
                nuevaDiv.style.display = 'none';
                ordenInput.value = siguienteOrden[this.value] ?? 1;
            }
        });
    }, 50);
}

export function confirmarAsignacionPopup(medidor, popupId) {
    const selectEl = document.getElementById(`${popupId}_ruta`);
    const ordenEl = document.getElementById(`${popupId}_orden`);
    const nuevaEl = document.getElementById(`${popupId}_nuevaRuta`);

    if (!selectEl || !ordenEl) return;

    let rutaNueva = selectEl.value;
    if (rutaNueva === '__nueva__') {
        rutaNueva = nuevaEl?.value?.trim();
        if (!rutaNueva) { alert('Ingrese un número de ruta.'); return; }
    }
    const ordenNuevo = parseInt(ordenEl.value, 10);
    if (isNaN(ordenNuevo) || ordenNuevo < 1) { alert('Ingrese un orden válido.'); return; }

    const suministro = state.suministrosSinRuta.find(s => String(s.numero_medidor) === String(medidor));
    if (!suministro) return;

    desplazarOrdenEnBorrador(String(rutaNueva), ordenNuevo, medidor);

    const entrada = {
        medidor,
        sumintId: suministro.suministro_id ?? null, // PK
        rutaAnterior: suministro.ruta ?? null,
        ordenAnterior: suministro.orden ?? null,
        rutaNueva: String(rutaNueva),
        ordenNuevo
    };
    
    // Guardamos en borrador como suministroId para compatibilidad
    entrada.suministroId = entrada.sumintId;

    const existente = state.borrador.findIndex(b => String(b.medidor) === String(medidor));
    if (existente >= 0) state.borrador[existente] = entrada;
    else state.borrador.push(entrada);

    state.suministrosBorradorMap[medidor] = { ruta: String(rutaNueva), orden: ordenNuevo };

    const idx = state.suministrosSinRuta.findIndex(s => String(s.numero_medidor) === String(medidor));
    if (idx >= 0) {
        const s = state.suministrosSinRuta.splice(idx, 1)[0];
        s.ruta = String(rutaNueva);
        s.orden = ordenNuevo;
        state.suministrosConRuta.push(s);

        if (!state.rutasVisibles.has(String(rutaNueva))) {
            state.rutasVisibles.set(String(rutaNueva), true);
        }
    }

    state.map.closePopup();
    renderPuntosSinAsignar();
    renderPanelRuteo();
    actualizarColorPuntoByMedidor(medidor);

    showStatus(`✅ Medidor ${medidor} → Ruta ${rutaNueva}, Orden ${ordenNuevo} (borrador)`, 'success');
}

/**
 * Desplaza automáticamente los índices de orden de suministros de la misma ruta para insertar el nuevo
 */
export function desplazarOrdenEnBorrador(ruta, ordenDesde, medidorNuevo) {
    const afectados = [];

    state.suministrosConRuta.forEach(s => {
        const est = state.suministrosBorradorMap[s.numero_medidor] || { ruta: s.ruta, orden: s.orden };
        if (String(est.ruta) === String(ruta) && Number(est.orden) >= ordenDesde && String(s.numero_medidor) !== String(medidorNuevo)) {
            afectados.push({ medidor: s.numero_medidor, ordenActual: Number(est.orden) });
        }
    });

    state.borrador.forEach(b => {
        if (String(b.rutaNueva) === String(ruta) && Number(b.ordenNuevo) >= ordenDesde && String(b.medidor) !== String(medidorNuevo)) {
            if (!afectados.find(a => String(a.medidor) === String(b.medidor))) {
                afectados.push({ medidor: b.medidor, ordenActual: Number(b.ordenNuevo) });
            }
        }
    });

    afectados.sort((a, b) => b.ordenActual - a.ordenActual);

    afectados.forEach(({ medidor, ordenActual }) => {
        state.suministrosBorradorMap[medidor] = { ...state.suministrosBorradorMap[medidor], orden: ordenActual + 1 };

        const enBorrador = state.borrador.findIndex(b => String(b.medidor) === String(medidor));
        if (enBorrador >= 0) {
            state.borrador[enBorrador].ordenNuevo = ordenActual + 1;
        } else {
            const original = state.suministrosConRuta.find(s => String(s.numero_medidor) === String(medidor));
            if (original) {
                state.borrador.push({
                    medidor,
                    suministroId: original.suministro_id ?? null,
                    rutaAnterior: original.ruta,
                    ordenAnterior: original.orden,
                    rutaNueva: String(ruta),
                    ordenNuevo: ordenActual + 1
                });
            }
        }
    });
}

/**
 * Guarda los cambios pendientes en Supabase
 */
export async function confirmarBorrador() {
    console.log('🏁 [confirmarBorrador] Iniciando guardado. Total cambios:', state.borrador.length);
    console.table(state.borrador.map(b => ({ medidor: b.medidor, rutaNueva: b.rutaNueva, ordenNuevo: b.ordenNuevo })));

    if (state.borrador.length === 0) {
        console.warn('⚠️ [confirmarBorrador] El borrador está vacío.');
        return;
    }

    const btn = document.getElementById('ruteoConfirmarBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    let exitosos = 0;
    let errores = 0;
    let sinFilas = 0;

    for (const cambio of state.borrador) {
        try {
            const rutaDb = /^\d+$/.test(String(cambio.rutaNueva)) ? parseInt(cambio.rutaNueva, 10) : cambio.rutaNueva;
            const ordenDb = typeof cambio.ordenNuevo === 'number' ? cambio.ordenNuevo : parseInt(cambio.ordenNuevo, 10);

            const suministroId = cambio.suministroId != null ? parseInt(cambio.suministroId, 10) : null;
            if (!suministroId) {
                console.warn(`⚠️ [Skip] medidor ${cambio.medidor} no tiene suministro_id — omitido.`);
                sinFilas++;
                errores++;
                continue;
            }

            console.log(`📡 [Write] suministro_id=${suministroId} | medidor=${cambio.medidor} | ruta=${rutaDb} | orden=${ordenDb}`);

            const rutaVal = isNaN(rutaDb) ? null : rutaDb;
            const ordenVal = isNaN(ordenDb) ? null : ordenDb;

            const { data, error } = await state.supabaseClient
                .from('suministros')
                .update({ ruta: rutaVal, orden: ordenVal })
                .eq('id', suministroId)
                .select('id, ruta, orden');

            if (error) {
                console.error(`❌ [Error] medidor ${cambio.medidor}:`, error);
                errores++;
            } else if (!data || data.length === 0) {
                console.warn(`⚠️ [Sin filas afectadas] suministro_id=${suministroId} — no encontrado.`, data);
                sinFilas++;
                errores++;
            } else {
                console.log(`✅ [OK] medidor ${cambio.medidor} → ruta=${data[0].ruta}, orden=${data[0].orden}`);
                exitosos++;
                const idx = state.suministrosData.findIndex(s => String(s.numero_medidor) === String(cambio.medidor));
                if (idx >= 0) {
                    state.suministrosData[idx].ruta = String(cambio.rutaNueva);
                    state.suministrosData[idx].orden = Number(cambio.ordenNuevo);
                }
            }
        } catch (e) {
            console.error('❌ [Exception] Error en confirmarBorrador:', e);
            errores++;
        }
    }

    console.log(`🏁 [confirmarBorrador] Resultado: ${exitosos} exitosos, ${sinFilas} sin filas, ${errores} errores.`);

    if (errores === 0) {
        showStatus(`✓ ${exitosos} cambio(s) guardados correctamente en la base de datos.`, 'success');
        state.borrador = [];
        state.suministrosBorradorMap = {};
        state.suministrosConRuta = state.suministrosData.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
        state.suministrosSinRuta = state.suministrosData.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');

        const suministrosFiltrados = state.suministrosData.filter(s => {
            if (!state.currentFilter) return true;
            if (state.currentFilter.type === 'localidad') return s.localidad === state.currentFilter.name;
            if (state.currentFilter.type === 'unidad_regional') {
                const _nombres = state.localidadesData.filter(l => l.unidad_regional === state.currentFilter.name).map(l => l.nombre);
                return _nombres.includes(s.localidad);
            }
            return true;
        });
        if (state.layerGroups.suministros) {
            renderDataToLayer('suministros', suministrosFiltrados.length > 0 ? suministrosFiltrados : state.suministrosData);
            if (suministrosFiltrados.length > 0) inicializarModuloRuteo(suministrosFiltrados, state.localidadFiltroActual);
        }
    } else if (sinFilas > 0) {
        showStatus(`⚠️ ${sinFilas} medidor(es) no encontrado(s). Consola (F12) para detalles.`, 'error');
    } else {
        showStatus(`⚠️ ${errores} error(es) al guardar. Consola (F12).`, 'error');
    }

    state.modoEdicion = false;
    if (state.ruteoSinAsignarLayer) { state.map.removeLayer(state.ruteoSinAsignarLayer); state.ruteoSinAsignarLayer = null; }
    state.map.getContainer().style.cursor = '';
    renderPanelRuteo();
}

/**
 * Descarta todos los cambios del borrador
 */
export function descartarBorrador() {
    if (!confirm(`¿Descartar ${state.borrador.length} cambio(s) pendiente(s)?`)) return;

    state.borrador = [];
    state.suministrosBorradorMap = {};
    state.suministrosConRuta = state.suministrosData.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
    state.suministrosSinRuta = state.suministrosData.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');

    state.modoEdicion = false;
    if (state.ruteoSinAsignarLayer) { state.map.removeLayer(state.ruteoSinAsignarLayer); state.ruteoSinAsignarLayer = null; }
    state.map.getContainer().style.cursor = '';

    if (state.currentFilter && state.currentFilter.num_fimm) {
        const suministrosFiltrados = state.suministrosData.filter(s => {
            if (!state.currentFilter) return true;
            if (state.currentFilter.type === 'localidad') return s.localidad === state.currentFilter.name;
            if (state.currentFilter.type === 'unidad_regional') {
                const _nombres = state.localidadesData.filter(l => l.unidad_regional === state.currentFilter.name).map(l => l.nombre);
                return _nombres.includes(s.localidad);
            }
            return true;
        });
        renderDataToLayer('suministros', suministrosFiltrados);
        inicializarModuloRuteo(suministrosFiltrados, state.localidadFiltroActual);
    }

    renderPanelRuteo();
    showStatus('Cambios descartados.', 'success');
}

export function getLatLngFromSuministro(s) {
    const geomField = s.wkt_geom || s.geom || s.the_geom;
    if (!geomField) return null;
    const geojson = typeof geomField === 'string' ? wktToGeoJSON(geomField) : geomField;
    if (!geojson) return null;
    if (geojson.type === 'Point') return L.latLng(geojson.coordinates[1], geojson.coordinates[0]);
    if (geojson.type === 'Feature' && geojson.geometry?.type === 'Point')
        return L.latLng(geojson.geometry.coordinates[1], geojson.geometry.coordinates[0]);
    return null;
}

export function getSiguienteOrden(ruta) {
    let max = 0;
    state.suministrosConRuta.forEach(s => {
        const est = state.suministrosBorradorMap[s.numero_medidor] || { ruta: s.ruta, orden: s.orden };
        if (String(est.ruta) === String(ruta) && Number(est.orden) > max) max = Number(est.orden);
    });
    state.borrador.forEach(b => {
        if (String(b.rutaNueva) === String(ruta) && Number(b.ordenNuevo) > max) max = Number(b.ordenNuevo);
    });
    return max + 1;
}

// Exponer en window para compatibilidad con las llamadas onclick del modal dinámico de asignación
window.confirmarAsignacionPopup = confirmarAsignacionPopup;
