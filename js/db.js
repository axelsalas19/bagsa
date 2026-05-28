// Operaciones de lectura y escritura en la base de datos Supabase y WFS
import { state } from './state.js';
import { SUPABASE_URL, SUPABASE_KEY, ARBA_WMS_URL, ARBA_WMS_LAYER } from './config.js';
import { showStatus, obtenerColorRuta } from './utils.js';
import { renderDataToLayer, actualizarColorPuntoByMedidor, handleCheckboxChange, setArbaToWMS } from './map.js';
import { 
    populateLocalidadSelect, 
    enableLocalidadFilter, 
    populateUnidadRegionalSelect, 
    populateProductoTurnoSelects, 
    enableDependentLayers,
    actualizarIndicadoresSiAbierto 
} from './filters.js';
import { 
    inicializarModuloRuteo, 
    limpiarModuloRuteo, 
    desplazarOrdenEnBorrador, 
    renderPuntosSinAsignar, 
    renderPanelRuteo 
} from './routing.js';

/**
 * Carga genérica de tablas de Supabase con limitación de registros
 */
export async function loadTableData(tableName, options = {}) {
    try {
        const { limit } = options;
        console.log(`Cargando ${tableName}`);
        showStatus(`Cargando ${tableName}...`, 'loading');

        let query = state.supabaseClient.from(tableName).select('*');
        const queryLimit = limit || 5000;
        query = query.limit(queryLimit);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            console.log(`${tableName} - No hay datos`);
            return [];
        }
        console.log(`${tableName} - ${data.length} registros`);
        return data;
    } catch (error) {
        console.error(`Error cargando ${tableName}:`, error);
        showStatus(`Error al cargar ${tableName}: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Carga e inicialización de los datos base (municipios, localidades, suministros)
 */
export async function loadBaseData() {
    try {
        console.log('Iniciando carga de datos base');

        state.municipiosData = await loadTableData('municipios', { limit: 200 });
        if (state.municipiosData.length > 0) {
            renderDataToLayer('municipios', state.municipiosData);
            if (!state.map.hasLayer(state.layerGroups.municipios)) {
                state.layerGroups.municipios.addTo(state.map);
            }
            const cb = document.getElementById('layer-municipios');
            if (cb) { cb.checked = true; cb.disabled = false; }
        }

        state.localidadesData = await loadTableData('localidades', { limit: 500 });
        if (state.localidadesData.length > 0) {
            renderDataToLayer('localidades', state.localidadesData);
            populateLocalidadSelect();
            enableLocalidadFilter();
            if (!state.map.hasLayer(state.layerGroups.localidades)) {
                state.layerGroups.localidades.addTo(state.map);
            }
            const cb = document.getElementById('layer-localidades');
            if (cb) { cb.checked = true; cb.disabled = false; }
            populateUnidadRegionalSelect();
            populateProductoTurnoSelects();
        }

        state.suministrosData = await loadTableData('v_suministros_activos', { limit: 10000 });
        console.log('📊 Suministros cargados en cache:', state.suministrosData.length);
        if (state.suministrosData.length > 0) {
            renderDataToLayer('suministros', state.suministrosData);
            const cb = document.getElementById('layer-suministros');
            if (cb) { cb.disabled = false; cb.checked = false; }
            const label = document.getElementById('label-suministros');
            if (label) {
                label.innerHTML = `<input type="checkbox" id="layer-suministros" data-table="suministros"> Suministros (${state.suministrosData.length})`;
                const newCb = document.getElementById('layer-suministros');
                if (newCb) newCb.addEventListener('change', handleCheckboxChange);
            }
        }

        showStatus('Datos base cargados. Seleccione un filtro para ver más información.', 'success');
        actualizarIndicadoresSiAbierto();
    } catch (error) {
        console.error('Error cargando datos base:', error);
    }
}

/**
 * Consulta a la base de datos utilizando funciones RPC/PostGIS
 */
export async function loadFilteredPostGIS(tableName, filterType, filterValue) {
    try {
        console.log(`Cargando ${tableName} con PostGIS para ${filterType}: ${filterValue}`);
        let functionName, params = {};

        if (filterType === 'localidad') {
            if (tableName === 'arba') {
                return await loadParcelasDirect(filterValue);
            }
            if (tableName === 'calles') functionName = 'get_streets_by_localidad';
            else if (tableName === 'red_de_gas') functionName = 'get_gas_network_by_localidad';
            else return [];
            params = { localidad_name: filterValue };
        } else {
            return [];
        }

        if (!functionName) return [];

        const { data, error } = await state.supabaseClient.rpc(functionName, params).range(0, 9999);
        if (error) {
            console.error(`Error en RPC ${functionName}:`, error);
            return [];
        }
        console.log(`${tableName} RPC devolvió ${(data || []).length} registros`);
        return data || [];
    } catch (error) {
        console.error(`Error cargando ${tableName}:`, error);
        return [];
    }
}

/**
 * Carga directa de parcelas sin campo geométrico para evitar errores de serialización
 */
export async function loadParcelasDirect(localidadNombre) {
    try {
        console.log(`🏠 Parcelas: cargando por localidad = "${localidadNombre}"`);

        // 1. Intentar con RPC (devuelve wkt_geom como texto)
        let allData = [];
        let from = 0;
        const pageSize = 1000;

        const { data: rpcData, error: rpcError } = await state.supabaseClient
            .rpc('get_parcelas_by_localidad', { localidad_name: localidadNombre });

        if (!rpcError && rpcData && rpcData.length > 0) {
            console.log(`🏠 Parcelas (RPC): ${rpcData.length} registros`);
            showStatus(`✓ ${rpcData.length} parcelas cargadas`, 'success');
            return rpcData;
        }

        if (rpcError) {
            console.warn('RPC get_parcelas_by_localidad falló, intentando tabla directa sin geom:', rpcError.message);
            showStatus('⚠️ Parcelas sin geometría — creá el índice: CREATE INDEX ON parcelas (localidad)', 'warning');
        }

        // 2. Fallback: tabla directa sin geom
        while (true) {
            const { data: page, error } = await state.supabaseClient
                .from('parcelas')
                .select('gid, localidad, partida, partida_, pda')
                .eq('localidad', localidadNombre)
                .range(from, from + pageSize - 1);
            if (error) {
                console.error('Error cargando parcelas:', error);
                showStatus(`❌ Parcelas: ${error.message}`, 'error');
                return [];
            }
            if (page && page.length > 0) allData = allData.concat(page);
            if (!page || page.length < pageSize) break;
            from += pageSize;
        }

        if (allData.length > 0) {
            console.log(`🏠 Parcelas (sin geom): ${allData.length} registros`);
            return allData;
        }

        // 3. ilike fallback
        console.log('Parcelas: sin resultados con eq(), intentando ilike...');
        let allData2 = [];
        let from2 = 0;
        while (true) {
            const { data: page2, error: err2 } = await state.supabaseClient
                .from('parcelas')
                .select('gid, localidad, partida, partida_, pda')
                .ilike('localidad', localidadNombre)
                .range(from2, from2 + 999);
            if (err2) break;
            if (page2 && page2.length > 0) allData2 = allData2.concat(page2);
            if (!page2 || page2.length < 1000) break;
            from2 += 1000;
        }

        if (allData2.length > 0) {
            console.log(`🏠 ARBA (ilike): ${allData2.length} registros encontrados`);
            return allData2;
        }
        console.log('🏠 ARBA: sin resultados para esta localidad');
        return [];
    } catch (e) {
        console.error('loadParcelasDirect exception:', e);
        return [];
    }
}

/**
 * Carga parcelas desde un servidor WFS de ARBA
 */
export async function loadParcelasFromWFS(filterValue, geomWKT = null, attributeName = 'localidad') {
    try {
        console.log(`Cargando parcelas desde WFS por ${attributeName}='${filterValue}'`);
        const baseUrl = ARBA_WMS_URL.replace('/wms', '/ows');
        const params = new URLSearchParams();
        params.set('service', 'WFS');
        params.set('version', '1.0.0');
        params.set('request', 'GetFeature');
        params.set('typename', ARBA_WMS_LAYER);
        params.set('outputFormat', 'application/json');
        params.set('maxFeatures', '5000');

        let useBBoxFilter = false;
        if (filterValue) {
            let propertyName = null;
            try {
                const props = await describeArbaFeatureType();
                if (props && props.length > 0) {
                    const mapped = findBestPropertyMatch(props, attributeName);
                    if (mapped) propertyName = mapped;
                }
            } catch (e) {
                console.warn('No se pudo mapear propiedad ARBA, intentando filtro espacial si es posible:', e);
            }

            if (propertyName) {
                const safeVal = String(filterValue).replace(/'/g, "''");
                const isPartidaLike = /partid/i.test(propertyName) || /partid/i.test(attributeName);
                const needsQuotes = !isPartidaLike || isNaN(Number(safeVal));
                params.set('CQL_FILTER', `${propertyName}=${needsQuotes ? "'" + safeVal + "'" : safeVal}`);
            } else if (geomWKT) {
                console.warn(`Atributo ARBA '${attributeName}' no válido para WFS; usando filtro espacial por bbox.`);
                useBBoxFilter = true;
            } else {
                console.warn(`Atributo ARBA '${attributeName}' no válido y no hay geometría disponible.`);
            }
        }

        let url;
        if (useBBoxFilter) {
            const bbox = getBBoxFromWKT(geomWKT);
            if (!bbox) {
                console.warn('No se pudo calcular bbox para la geometría de localidad.');
                showStatus('No se pudo filtrar parcelas ARBA espacialmente.', 'warning');
                return [];
            }
            params.set('service', 'WFS');
            params.set('version', '1.1.0');
            params.set('request', 'GetFeature');
            params.set('typename', ARBA_WMS_LAYER);
            params.set('outputFormat', 'json');
            params.set('bbox', bbox.join(','));
            params.set('srsName', 'EPSG:4326');
            params.set('maxFeatures', '5000');
            url = baseUrl + '?' + params.toString();
        } else {
            url = baseUrl + '?' + params.toString();
        }

        let response = await fetch(url);
        let text = await response.text();

        // Si la respuesta es XML (ej. Exception), intentar fallback
        if (text && text.trim().startsWith('<')) {
            try {
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'application/xml');
                const servExc = xml.querySelector('ServiceException, ExceptionText, Exception');
                if (servExc && servExc.textContent) {
                    const msg = servExc.textContent.trim();
                    console.error('WFS ServiceException:', msg);
                    showStatus('WFS error: ' + msg, 'error');
                    
                    if (geomWKT) {
                        const bbox = getBBoxFromWKT(geomWKT);
                        if (bbox) {
                            const p2 = new URLSearchParams();
                            p2.set('service', 'WFS');
                            p2.set('version', '1.1.0');
                            p2.set('request', 'GetFeature');
                            p2.set('typename', ARBA_WMS_LAYER);
                            p2.set('outputFormat', 'json');
                            p2.set('bbox', bbox.join(','));
                            p2.set('srsName', 'EPSG:4326');
                            p2.set('maxFeatures', '5000');
                            const url2 = baseUrl + '?' + p2.toString();
                            const resp2 = await fetch(url2);
                            const text2 = await resp2.text();
                            if (text2 && text2.trim().startsWith('{')) {
                                const geojson2 = JSON.parse(text2);
                                if (geojson2 && geojson2.features && geojson2.features.length > 0) {
                                    const items = geojson2.features.map(f => ({ geom: f.geometry, ...(f.properties || {}) }));
                                    state.arbaDatosFiltrados = items.slice();
                                    state.layerGroups.arba.clearLayers();
                                    renderDataToLayer('arba', items);
                                    if (!state.map.hasLayer(state.layerGroups.arba)) state.layerGroups.arba.addTo(state.map);
                                    showStatus(`✓ ${items.length} parcelas cargadas desde WFS (fallback)`, 'success');
                                    return items;
                                }
                            }
                        }
                    }
                    return [];
                }
            } catch (e) {
                console.warn('No se pudo parsear XML de WFS:', e);
            }
        }

        let geojson = null;
        try {
            geojson = JSON.parse(text);
        } catch (err) {
            console.error('Respuesta WFS no es JSON válido:', err);
            showStatus('Respuesta WFS no es JSON válido. Revisar CORS/endpoint.', 'error');
            return [];
        }

        if (!geojson || !geojson.features || geojson.features.length === 0) {
            console.log('WFS: sin features');
            showStatus('No se encontraron parcelas en WFS para el filtro', 'warning');
            return [];
        }

        const items = geojson.features.map(f => ({ geom: f.geometry, ...(f.properties || {}) }));
        state.arbaDatosFiltrados = items.slice();

        state.layerGroups.arba.clearLayers();
        renderDataToLayer('arba', items);
        if (!state.map.hasLayer(state.layerGroups.arba)) state.layerGroups.arba.addTo(state.map);
        console.log(`✓ ${items.length} parcelas WFS cargadas`);
        showStatus(`✓ ${items.length} parcelas cargadas desde WFS`, 'success');
        return items;
    } catch (e) {
        console.error('Error en loadParcelasFromWFS:', e);
        showStatus('Error cargando parcelas desde WFS', 'error');
        return [];
    }
}

/**
 * DescribeFeatureType para ARBA (para mapear atributos)
 */
let arbaFeatureProperties = null;
export async function describeArbaFeatureType() {
    try {
        if (arbaFeatureProperties) return arbaFeatureProperties;
        const url = ARBA_WMS_URL.replace('/wms', '/ows') + `?service=WFS&request=DescribeFeatureType&version=1.0.0&typename=${ARBA_WMS_LAYER}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const text = await resp.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');

        const elems = [];
        const nodeList = xml.getElementsByTagName('element');
        for (let i = 0; i < nodeList.length; i++) {
            const n = nodeList[i];
            const name = n.getAttribute('name');
            if (name) elems.push(name);
        }

        if (elems.length === 0) {
            const re = /<\w+:element\s+name="([^"]+)"/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                if (m[1]) elems.push(m[1]);
            }
        }

        const layerLocal = ARBA_WMS_LAYER && ARBA_WMS_LAYER.includes(':') ? ARBA_WMS_LAYER.split(':').pop() : ARBA_WMS_LAYER;
        let filtered = elems.filter(n => n && n.trim());
        if (layerLocal) {
            filtered = filtered.filter(n => n.toLowerCase() !== layerLocal.toLowerCase());
        }
        
        const seen = new Set();
        const unique = [];
        for (const p of filtered) {
            const key = p.toLowerCase();
            if (!seen.has(key)) { seen.add(key); unique.push(p); }
        }

        arbaFeatureProperties = unique;
        return arbaFeatureProperties;
    } catch (e) {
        console.warn('describeArbaFeatureType failed:', e);
        return null;
    }
}

export function findBestPropertyMatch(props, desired) {
    if (!props || props.length === 0) return null;
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const d = norm(desired);
    
    for (const p of props) if (norm(p) === d) return p;
    for (const p of props) if (norm(p).includes(d) || d.includes(norm(p))) return p;
    
    const d2 = d.replace(/_+$/,'');
    for (const p of props) if (norm(p) === d2) return p;
    
    if (d.includes('partid')) {
        for (const p of props) if (norm(p).includes('partid')) return p;
    }
    return null;
}

/**
 * Descubrimiento automático del nombre de capa de parcelas
 */
export async function discoverArbaLayer() {
    try {
        const url = ARBA_WMS_URL.replace('/wms', '/ows') + '?service=WFS&request=GetCapabilities';
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const text = await resp.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');

        const nameNodes = xml.querySelectorAll('Name');
        for (let i = 0; i < nameNodes.length; i++) {
            const txt = (nameNodes[i].textContent || '').toLowerCase();
            if (txt.includes('parcela') || txt.includes('parc') || txt.includes('parcels')) {
                return nameNodes[i].textContent.trim();
            }
        }
        return null;
    } catch (e) {
        console.warn('discoverArbaLayer failed:', e);
        return null;
    }
}

/**
 * Actualiza el estado del contrato de un suministro en la base de datos
 */
export async function updateEstado(safeKey, medidor) {
    const select = document.getElementById(`estado-select-${safeKey}`);
    const msgDiv = document.getElementById(`popup-msg-${safeKey}`);
    if (!select || !msgDiv) return;

    const nuevoEstado = select.value;
    msgDiv.innerHTML = '⏳ Guardando...';
    msgDiv.style.color = '#856404';

    try {
        const item = state.suministrosData.find(s => String(s.numero_medidor) === String(medidor));
        if (!item) throw new Error('Suministro no encontrado en cache');

        const suministroIdDb = /^\d+$/.test(item.suministro_id) ? parseInt(item.suministro_id, 10) : item.suministro_id;

        const { error } = await state.supabaseClient
            .from('suministros')
            .update({ estado: nuevoEstado })
            .eq('id', suministroIdDb);

        if (error) throw error;

        item.estado_contrato = nuevoEstado;

        actualizarColorPuntoByMedidor(medidor);
        msgDiv.innerHTML = '✅ Guardado correctamente';
        msgDiv.style.color = '#155724';
    } catch (err) {
        console.error('Error actualizando estado:', err);
        msgDiv.innerHTML = '❌ ' + (err.message || 'Error al guardar');
        msgDiv.style.color = '#721c24';
    }
}

/**
 * Registra una asignación de ruta/orden en el borrador en memoria y actualiza la UI
 */
export async function updateRutaOrden(safeKey, medidor) {
    const rutaInput = document.getElementById(`ruta-input-${safeKey}`);
    const ordenInput = document.getElementById(`orden-input-${safeKey}`);
    const msgDiv = document.getElementById(`popup-msg-ruta-${safeKey}`);
    if (!rutaInput || !ordenInput || !msgDiv) return;

    const nuevaRuta = rutaInput.value.trim();
    const nuevoOrden = parseInt(ordenInput.value, 10);

    if (!nuevaRuta || isNaN(nuevoOrden) || nuevoOrden < 1) {
        msgDiv.innerHTML = '❌ Ingrese ruta y orden válidos';
        msgDiv.style.color = '#721c24';
        return;
    }

    try {
        const suministro = state.suministrosData.find(s => String(s.numero_medidor) === String(medidor));
        if (!suministro) throw new Error('Suministro no encontrado');

        desplazarOrdenEnBorrador(String(nuevaRuta), nuevoOrden, medidor);

        const entrada = {
            medidor,
            suministroId: suministro.suministro_id ?? null,
            rutaAnterior: suministro.ruta ?? null,
            ordenAnterior: suministro.orden ?? null,
            rutaNueva: String(nuevaRuta),
            ordenNuevo: nuevoOrden
        };

        const existente = state.borrador.findIndex(b => String(b.medidor) === String(medidor));
        if (existente >= 0) state.borrador[existente] = entrada;
        else state.borrador.push(entrada);

        state.suministrosBorradorMap[medidor] = { ruta: String(nuevaRuta), orden: nuevoOrden };

        const idxSinRuta = state.suministrosSinRuta.findIndex(s => String(s.numero_medidor) === String(medidor));
        if (idxSinRuta >= 0) {
            const s = state.suministrosSinRuta.splice(idxSinRuta, 1)[0];
            s.ruta = String(nuevaRuta);
            s.orden = nuevoOrden;
            state.suministrosConRuta.push(s);
            if (!state.rutasVisibles.has(String(nuevaRuta))) {
                state.rutasVisibles.set(String(nuevaRuta), true);
            }
            renderPuntosSinAsignar();
        } else {
            const sConRuta = state.suministrosConRuta.find(s => String(s.numero_medidor) === String(medidor));
            if (!sConRuta && suministro.ruta) {
                state.suministrosConRuta.push({ ...suministro });
            }
        }

        actualizarColorPuntoByMedidor(medidor);
        state.layerGroups.suministros.eachLayer(function (geoJsonLayer) {
            geoJsonLayer.eachLayer(function (circleLayer) {
                if (circleLayer.feature && circleLayer.feature.properties && circleLayer.feature.properties.numero_medidor) {
                    actualizarColorPuntoByMedidor(circleLayer.feature.properties.numero_medidor);
                }
            });
        });

        renderPanelRuteo();

        msgDiv.innerHTML = `✅ En borrador (Ruta ${nuevaRuta}, Orden ${nuevoOrden}) — usá "💾 Confirmar y guardar" en el panel`;
        msgDiv.style.color = '#856404';

        const colorRuta = obtenerColorRuta(String(nuevaRuta));
        const infoDiv = document.getElementById(`info-ruta-orden-${safeKey}`);
        if (infoDiv) {
            infoDiv.innerHTML = `<strong>Ruta (Borrador):</strong> <span style="color:${colorRuta}; font-weight:bold;">${nuevaRuta}</span> | <strong>Orden:</strong> <span style="color:#CCCCCC; font-weight:bold;">${nuevoOrden}</span><br>`;
        }
        const btn = document.querySelector(`#ruta-input-${safeKey}`).parentElement.parentElement.nextElementSibling;
        if (btn) btn.textContent = '📝 Actualizar Borrador';

    } catch (err) {
        console.error('Error al agregar a borrador:', err);
        msgDiv.innerHTML = '❌ ' + (err.message || 'Error');
        msgDiv.style.color = '#721c24';
    }
}

// Exponer en window para compatibilidad con las llamadas onclick de Leaflet popups
window.updateEstado = updateEstado;
window.updateRutaOrden = updateRutaOrden;
