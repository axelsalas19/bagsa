// Variables globales
let supabaseClient;
let municipiosData = [];
let localidadesData = [];
let callesData = [];
let redGasData = [];
let suministrosData = [];   // Cache completo — nunca se limpia con clearFilter
let currentFilter = null;
let map;
let layerGroups;
let styles;
let filteredStyle;

// Variables módulo de ruteo
let ruteoLayerGroup       = null;  // Capa de rutas en el mapa
let ruteoSinAsignarLayer  = null;  // Capa de puntos sin asignar
let suministrosConRuta    = [];    // Suministros con ruta+orden completos
let suministrosSinRuta    = [];    // Suministros sin ruta o sin orden
let borrador              = [];    // Cambios pendientes de confirmar
let suministrosBorradorMap = {};   // medidor → {ruta, orden} estado en borrador
let modoEdicion           = false; // true cuando el usuario está asignando puntos
let localidadFiltroActual = null;  // nombre de la localidad activa
let rutasVisibles         = new Map(); // Para controlar qué rutas están visibles
let capaRutasGroup        = null;  // Capa para las rutas visualizadas

// Paleta de colores para rutas
const RUTA_COLORES = [
    '#e63946','#2a9d8f','#e9c46a','#f4a261','#6a4c93',
    '#1982c4','#8ac926','#ff595e','#6a0572','#0077b6',
    '#d90429','#2b2d42','#ffb703','#fb8500','#06d6a0'
];

// Configuración
const SUPABASE_URL = 'https://ahuxvjoykgzimshlcjsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodXh2am95a2d6aW1zaGxjanNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAxODcsImV4cCI6MjA4NTYxNjE4N30.oI32sXf5PoQIRg9wz6thjEFPngvw7FwzN4_hxHLM3m4';

// Esperar a que todo esté cargado
window.addEventListener('load', function() {
    console.log('Iniciando aplicación...');
    initApp();
});

function initApp() {
    try {
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase conectado');
        
        initMap();
        initStyles();
        initLayerGroups();
        initEventListeners();
        initSearchPanel();
        
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        showStatus('Error al inicializar: ' + error.message, 'error');
    }
}

function initMap() {
    map = L.map('map').setView([-36.14685, -60.28183], 6);
    console.log('Mapa inicializado');
    
    // Capas base
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });
    
    const argenmapLayer = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
        tms: true
    });
    
    const googleHybridLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    
    osmLayer.addTo(map);
    
    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satélite": satelliteLayer,
        "Google Híbrido": googleHybridLayer,
        "ArgenMap Gris": argenmapLayer
    };
    
    // Agregar control de zoom
    L.control.zoom({ position: 'topleft' }).addTo(map);
    
    // Agregar control de capas base
    L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);
    
    console.log('Capas base y controles agregados');
}

function initStyles() {
    styles = {
        municipios: { color: '#232323', weight: 1, fillOpacity: 0.1, fillColor: '#FFFFFF' },
        localidades: { color: '#0078ff', weight: 2, fillOpacity: 0.1, fillColor: '#5da6f8' },
        red_de_gas: { color: '#ff0000', weight: 2, opacity: 0.7 },
        calles: { color: '#333333', weight: 2, opacity: 0.6 }
    };
    
    filteredStyle = {
        municipios: { color: '#232323', weight: 1, fillOpacity: 0.1, fillColor: '#ffffff' },
        localidades: { color: '#2466e9', weight: 2, fillOpacity: 0.2, fillColor: '#e3e6eb' }
    };
}

function initLayerGroups() {
    layerGroups = {
        municipios: L.layerGroup().addTo(map),
        localidades: L.layerGroup().addTo(map),
        red_de_gas: L.layerGroup(),
        calles: L.layerGroup(),
        suministros: L.layerGroup()
    };

    map.on('zoomend', function() {
        const zoom = map.getZoom();
        const radius = zoom >= 16 ? 6 : zoom >= 14 ? 5 : zoom >= 12 ? 4 : 3;
        if (layerGroups.suministros) {
            layerGroups.suministros.eachLayer(function(layer) {
                if (layer.eachLayer) {
                    layer.eachLayer(function(subLayer) {
                        if (subLayer.setRadius) subLayer.setRadius(radius);
                    });
                } else if (layer.setRadius) {
                    layer.setRadius(radius);
                }
            });
        }
    });
}

function initEventListeners() {
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.getElementById('sidebar');
    
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.id = 'sidebarOverlay';
    document.body.appendChild(sidebarOverlay);
    
    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            this.textContent = sidebar.classList.contains('active') ? '✕' : '☰';
            sidebarOverlay.classList.toggle('active');
        });
    }
    
    sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        if (mobileToggleBtn) mobileToggleBtn.textContent = '☰';
        sidebarOverlay.classList.remove('active');
    });
    
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });
    
    const applyLocalidadFilterBtn = document.getElementById('applyLocalidadFilter');
    const applyUnidadRegionalFilterBtn = document.getElementById('applyUnidadRegionalFilter');
    const clearLocalidadFilterBtn = document.getElementById('clearLocalidadFilter');
    const clearUnidadRegionalFilterBtn = document.getElementById('clearUnidadRegionalFilter');
    const loadDataBtn = document.getElementById('loadDataBtn');
    const toggleLegendBtn = document.getElementById('toggleLegendBtn');
    
    if (applyLocalidadFilterBtn) applyLocalidadFilterBtn.addEventListener('click', applyLocalidadFilter);
    if (applyUnidadRegionalFilterBtn) applyUnidadRegionalFilterBtn.addEventListener('click', applyUnidadRegionalFilter);
    if (clearLocalidadFilterBtn) clearLocalidadFilterBtn.addEventListener('click', clearFilter);
    if (clearUnidadRegionalFilterBtn) clearUnidadRegionalFilterBtn.addEventListener('click', clearFilter);
    
    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', async function() {
            this.disabled = true;
            await loadBaseData();
            this.disabled = false;
        });
    }
    
    if (toggleLegendBtn) {
        toggleLegendBtn.addEventListener('click', function() {
            const legend = document.getElementById('legend');
            if (legend) {
                if (legend.style.display === 'block') {
                    legend.style.display = 'none';
                    this.textContent = 'Referencia de Diámetros';
                } else {
                    legend.style.display = 'block';
                    this.textContent = 'Ocultar Referencia';
                }
            }
        });
    }
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = type;
        status.style.display = 'block';
        if (type !== 'loading') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }
}

function wktToGeoJSON(wkt) {
    try {
        if (!wkt || typeof wkt !== 'string') return null;
        let cleanWkt = wkt.replace(' Z ', ' ');
        cleanWkt = cleanWkt.replace(/(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g, '$1 $2');
        cleanWkt = cleanWkt.replace(/(-\d+\.?\d*)\s+(-\d+\.?\d*)\s+(-\d+\.?\d*)/g, '$1 $2');
        const wicket = new Wkt.Wkt();
        wicket.read(cleanWkt);
        return wicket.toJson();
    } catch (error) {
        console.error('Error convirtiendo WKT:', error);
        return null;
    }
}

function createMunicipioPopup(properties) {
    let content = `<strong>Municipio</strong><br>`;
    if (properties.fna) content += `<strong>Nombre:</strong> ${properties.fna}<br>`;
    if (properties.zona_fria) content += `<strong>Zona Fría:</strong> ${properties.zona_fria}<br>`;
    if (properties.empre_distribu) content += `<strong>Empresa Distribuidora:</strong> ${properties.empre_distribu}<br>`;
    return content;
}

function createSuministroPopup(properties) {
    const medidor = properties.medidor || '';
    const safeKey = medidor.toString().replace(/[^a-zA-Z0-9]/g, '_');
    const ruta = properties.ruta;
    const orden = properties.orden;
    const tieneRuta = ruta && ruta !== null && ruta !== '';
    const tieneOrden = orden && orden !== null && orden !== 0;
    
    let content = `<strong>📋 Suministro</strong><br><hr style="margin:5px 0;">`;
    if (properties.medidor) content += `<strong>Num. Medidor:</strong> ${properties.medidor}<br>`;
    if (properties.Cliente) content += `<strong>Cliente:</strong> ${properties.Cliente}<br>`;
    if (properties.Nombre) content += `<strong>Nombre:</strong> ${properties.Nombre}<br>`;
    if (properties.Direccion) content += `<strong>Dirección:</strong> ${properties.Direccion}<br>`;
    content += `<strong>Estado:</strong> ${properties.estado || '-'}<br>`;
    
    if (tieneRuta && tieneOrden) {
        const colorRuta = obtenerColorRuta(String(ruta));
        content += `<strong>Ruta:</strong> <span style="color:${colorRuta}; font-weight:bold;">${ruta}</span><br>`;
        content += `<strong>Orden:</strong> <span style="color:#383838; font-weight:bold;">${orden}</span><br>`;
    } else {
        content += `<strong>Ruta:</strong> <span style="color:#ff9800;">No asignada</span><br>`;
        content += `<strong>Orden:</strong> <span style="color:#ff9800;">No asignado</span><br>`;
    }
    
    content += `
        <hr style="margin:8px 0; border-color:#ddd;">
        <strong>Cambiar estado:</strong>
        <select id="estado-select-${safeKey}" style="margin:5px 0; padding:5px; width:100%;">
            <option value="Conectado" ${properties.estado === 'Conectado' ? 'selected' : ''}>🟢 Conectado</option>
            <option value="Cortado" ${properties.estado === 'Cortado' ? 'selected' : ''}>🔴 Cortado</option>
            <option value="Anomalia" ${properties.estado === 'Anomalia' ? 'selected' : ''}>🟡 Anomalia</option>
        </select>
        <button class="popup-save-btn" onclick="updateEstado('${safeKey}', '${medidor}')" style="width:100%;">💾 Guardar Estado</button>
        <div id="popup-msg-${safeKey}" style="margin-top:5px;"></div>
    `;
    return content;
}

function createCallesPopup(properties) {
    let content = `<strong>Calle</strong><br>`;
    if (properties.name) content += `<strong>Nombre:</strong> ${properties.name}<br>`;
    if (properties.fclass) content += `<strong>Tipo:</strong> ${properties.fclass}<br>`;
    return content;
}

function createLocalidadPopup(properties) {
    let content = `<strong>Área de Servicio</strong><br>`;
    if (properties.nombre) content += `<strong>Nombre:</strong> ${properties.nombre}<br>`;
    if (properties.partido) content += `<strong>Partido:</strong> ${properties.partido}<br>`;
    if (properties.unidad_regional) content += `<strong>Unidad Regional:</strong> ${properties.unidad_regional}<br>`;
    if (properties.zona_fria) content += `<strong>Zona Fría:</strong> ${properties.zona_fria}<br>`;
    if (properties.num_fimm) content += `<strong>Núm. Localidad:</strong> ${properties.num_fimm}<br>`;
    if (properties.turno) content += `<strong>Turno:</strong> ${properties.turno}<br>`;
    if (properties.producto) content += `<strong>Tipo Producto:</strong> ${properties.producto}<br>`;
    if (properties.cant_conect) content += `<strong>Capacidad máxima:</strong> ${properties.cant_conect}<br>`;
    if (properties.cant_tanques) content += `<strong>Cantidad tanques:</strong> ${properties.cant_tanques}<br>`;
    return content;
}

function getLayerGroupBounds(layerGroup) {
    try {
        const layers = layerGroup.getLayers();
        if (layers.length === 0) return null;
        let bounds = null;
        layers.forEach(layer => {
            const layerBounds = layer.getBounds ? layer.getBounds() : null;
            if (layerBounds) {
                if (bounds === null) bounds = layerBounds;
                else bounds.extend(layerBounds);
            }
        });
        return bounds;
    } catch (error) {
        console.error('Error obteniendo bounds del grupo:', error);
        return null;
    }
}

function zoomToGeometry(geometryWKT) {
    try {
        if (!geometryWKT) return;
        const geometryGeoJSON = wktToGeoJSON(geometryWKT);
        if (!geometryGeoJSON) return;
        const tempLayer = L.geoJSON(geometryGeoJSON);
        const bounds = tempLayer.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    } catch (error) {
        console.error('Error haciendo zoom:', error);
    }
}

async function loadTableData(tableName, options = {}) {
    try {
        const { limit } = options;
        console.log(`Cargando ${tableName}`);
        showStatus(`Cargando ${tableName}...`, 'loading');
        
        let query = supabaseClient.from(tableName).select('*');
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

function getColorByEstado(estado) {
    if (!estado) return '#28a745';
    const e = estado.trim().toLowerCase();
    if (e === 'cortado') return '#dc3545';
    if (e === 'anomalia' || e === 'anomalía') return '#ffc107';
    return '#28a745';
}

function obtenerColorRuta(ruta) {
    let hash = 0;
    const str = String(ruta);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % RUTA_COLORES.length;
    return RUTA_COLORES[index];
}

function renderDataToLayer(tableName, data, style = null) {
    console.log(`Renderizando ${tableName} - ${data.length} elementos`);
    if (!layerGroups[tableName]) return 0;
    layerGroups[tableName].clearLayers();
    
    let featuresAdded = 0;
    
    data.forEach(item => {
        let geojson = null;
        const itemGeometry = item.wkt_geom || item.geom || item.the_geom;
        
        if (itemGeometry) {
            const rawGeom = typeof itemGeometry === 'string' ? wktToGeoJSON(itemGeometry) : itemGeometry;
            if (rawGeom) {
                if (rawGeom.type === 'Feature') {
                    geojson = rawGeom;
                    if (!geojson.properties) geojson.properties = {};
                    Object.assign(geojson.properties, item);
                } else {
                    geojson = { type: 'Feature', geometry: rawGeom, properties: item };
                }
            }
        }
        
        if (geojson) {
            try {
                const layerOptions = {
                    style: tableName === 'suministros' ? null : (style || styles[tableName] || {}),
                    onEachFeature: (feature, layer) => {
                        let popupContent;
                        if (tableName === 'municipios') popupContent = createMunicipioPopup(item);
                        else if (tableName === 'localidades') popupContent = createLocalidadPopup(item);
                        else if (tableName === 'suministros') popupContent = createSuministroPopup(item);
                        else if (tableName === 'calles') popupContent = createCallesPopup(item);
                        else popupContent = `<strong>Capa: ${tableName}</strong><br>${JSON.stringify(item)}`;
                        layer.bindPopup(popupContent);
                    }
                };
                
                if (tableName === 'suministros') {
                    layerOptions.pointToLayer = (feature, latlng) => {
                        const ruta = item.ruta;
                        const orden = item.orden;
                        const tieneRuta = ruta && ruta !== null && ruta !== '';
                        const tieneOrden = orden && orden !== null && orden !== 0;
                        let color = (tieneRuta && tieneOrden) ? obtenerColorRuta(String(ruta)) : '#aaaaaa';
                        const borderColor = color === '#aaaaaa' ? '#666666' : color;
                        return L.circleMarker(latlng, {
                            radius: 3,
                            fillColor: color,
                            color: borderColor,
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.85
                        });
                    };
                }
                
                const layer = L.geoJSON(geojson, layerOptions);
                layerGroups[tableName].addLayer(layer);
                featuresAdded++;
            } catch (e) {
                console.error('Error agregando geometría:', e);
            }
        }
    });
    
    console.log(`${tableName} - ${featuresAdded} elementos renderizados`);
    return featuresAdded;
}

function fitViewToLayerGroup(tableName) {
    try {
        if (!layerGroups[tableName]) return false;
        const bounds = getLayerGroupBounds(layerGroups[tableName]);
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error ajustando vista a ${tableName}:`, error);
        return false;
    }
}

function getColorByDiameter(diametro) {
    if (!diametro) return '#FFFFFF';
    const diametroNum = Number(diametro);
    if (diametroNum === 50) return '#f3a120';
    if (diametroNum === 63) return '#0e2eea';
    if (diametroNum === 90) return '#df0c0c';
    if (diametroNum === 125) return '#15960b';
    if (diametroNum === 180) return '#da21cb';
    return '#FFFFFF';
}

function getDiameterClass(diametro) {
    if (!diametro) return 'diameter-other';
    const diametroNum = Number(diametro);
    if (diametroNum === 50) return 'diameter-50';
    if (diametroNum === 63) return 'diameter-63';
    if (diametroNum === 90) return 'diameter-90';
    if (diametroNum === 125) return 'diameter-125';
    if (diametroNum === 180) return 'diameter-180';
    return 'diameter-other';
}

function renderRedGasWithDiameterClassification(data) {
    console.log(`Renderizando red de gas con clasificación - ${data.length} elementos`);
    if (!layerGroups.red_de_gas) return 0;
    layerGroups.red_de_gas.clearLayers();
    
    let featuresAdded = 0;
    data.forEach(item => {
        let geojson = null;
        const itemGeometry = item.wkt_geom || item.geom;
        if (itemGeometry) {
            geojson = typeof itemGeometry === 'string' ? wktToGeoJSON(itemGeometry) : itemGeometry;
        }
        if (geojson) {
            try {
                const diametro = item.diametro || item.diametro_mm;
                const color = getColorByDiameter(diametro);
                const layerStyle = { color: color, weight: 4, opacity: 0.8, className: getDiameterClass(diametro) };
                const layer = L.geoJSON(geojson, {
                    style: layerStyle,
                    onEachFeature: (feature, layer) => {
                        let popupContent = `<strong>Red de Gas</strong><br>`;
                        if (diametro) popupContent += `<strong>Diámetro:</strong> Ø ${diametro} mm<br>`;
                        if (item.material) popupContent += `<strong>Material:</strong> ${item.material}<br>`;
                        if (item.estado) popupContent += `<strong>Estado:</strong> ${item.estado}<br>`;
                        if (item.localidad) popupContent += `<strong>Localidad:</strong> ${item.localidad}<br>`;
                        layer.bindPopup(popupContent);
                    }
                });
                layerGroups.red_de_gas.addLayer(layer);
                featuresAdded++;
            } catch (e) {
                console.error('Error agregando geometría de red de gas:', e);
            }
        }
    });
    
    console.log(`Red de gas: ${featuresAdded} elementos renderizados`);
    const toggleBtn = document.getElementById('toggleLegendBtn');
    if (toggleBtn && featuresAdded > 0) toggleBtn.style.display = 'block';
    return featuresAdded;
}

async function loadBaseData() {
    try {
        console.log('Iniciando carga de datos base');
        
        municipiosData = await loadTableData('municipios', { limit: 200 });
        if (municipiosData.length > 0) {
            renderDataToLayer('municipios', municipiosData);
            if (!map.hasLayer(layerGroups.municipios)) layerGroups.municipios.addTo(map);
            const cb = document.getElementById('layer-municipios');
            if (cb) { cb.checked = true; cb.disabled = false; }
        }
        
        localidadesData = await loadTableData('localidades', { limit: 500 });
        if (localidadesData.length > 0) {
            renderDataToLayer('localidades', localidadesData);
            populateLocalidadSelect();
            enableLocalidadFilter();
            if (!map.hasLayer(layerGroups.localidades)) layerGroups.localidades.addTo(map);
            const cb = document.getElementById('layer-localidades');
            if (cb) { cb.checked = true; cb.disabled = false; }
            populateUnidadRegionalSelect();
        }
        
        suministrosData = await loadTableData('suministros', { limit: 10000 });
        console.log('📊 Suministros cargados en cache:', suministrosData.length);
        if (suministrosData.length > 0) {
            console.log('📊 Ejemplo de suministro con ruta/orden:', suministrosData.slice(0, 3).map(s => ({
                medidor: s.medidor, ruta: s.ruta, orden: s.orden
            })));
            renderDataToLayer('suministros', suministrosData);
            const cb = document.getElementById('layer-suministros');
            if (cb) { cb.disabled = false; cb.checked = false; }
            const label = document.getElementById('label-suministros');
            if (label) {
                label.innerHTML = `<input type="checkbox" id="layer-suministros" data-table="suministros"> Suministros (${suministrosData.length})`;
                const newCb = document.getElementById('layer-suministros');
                if (newCb) newCb.addEventListener('change', handleCheckboxChange);
            }
        }
        
        showStatus('Datos base cargados. Seleccione un filtro para ver más información.', 'success');
    } catch (error) {
        console.error('Error cargando datos base:', error);
    }
}

function populateUnidadRegionalSelect() {
    const select = document.getElementById('selectUnidadRegional');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccione unidad regional --</option>';
    const unidades = [...new Set(localidadesData.map(l => l.unidad_regional).filter(ur => ur))].sort();
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

function populateLocalidadSelect() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccione un Área de Servicio --</option>';
    localidadesData.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    localidadesData.forEach(item => {
        if (!item.nombre) return;
        const option = document.createElement('option');
        option.value = item.nombre;
        option.textContent = item.nombre;
        select.appendChild(option);
    });
}

function enableLocalidadFilter() {
    const select = document.getElementById('selectLocalidad');
    const applyBtn = document.getElementById('applyLocalidadFilter');
    const clearBtn = document.getElementById('clearLocalidadFilter');
    if (select) select.disabled = false;
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

function enableDependentLayers(filterName) {
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    
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
    
    setTimeout(() => {
        if (layerGroups.red_de_gas && !map.hasLayer(layerGroups.red_de_gas)) layerGroups.red_de_gas.addTo(map);
        if (layerGroups.calles && !map.hasLayer(layerGroups.calles)) layerGroups.calles.addTo(map);
        if (layerGroups.suministros && !map.hasLayer(layerGroups.suministros)) layerGroups.suministros.addTo(map);
    }, 100);
}

async function loadFilteredPostGIS(tableName, filterType, filterValue) {
    try {
        console.log(`Cargando ${tableName} con PostGIS para ${filterType}: ${filterValue}`);
        let functionName, params = {};
        
        if (filterType === 'localidad') {
            if (tableName === 'calles') functionName = 'get_streets_by_localidad';
            else if (tableName === 'red_de_gas') functionName = 'get_gas_network_by_localidad';
            else return [];
            params = { localidad_name: filterValue };
        } else {
            return [];
        }
        
        if (!functionName) return [];
        
        const { data, error } = await supabaseClient.rpc(functionName, params).range(0, 9999);
        if (error) {
            console.error(`Error en RPC ${functionName}:`, error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error(`Error cargando ${tableName}:`, error);
        return [];
    }
}

async function applyLocalidadFilter() {
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

async function aplicarFiltroLocalidad(localidadNombre) {
    console.log('Aplicando filtro localidad...');
    
    const localidad = localidadesData.find(l => l.nombre === localidadNombre);
    if (!localidad) {
        showStatus('Localidad no encontrada', 'error');
        return;
    }
    
    const numFimm = localidad.num_fimm;
    console.log(`Localidad: ${localidadNombre}, num_fimm: ${numFimm}`);
    
    currentFilter = {
        type: 'localidad',
        name: localidadNombre,
        data: localidad,
        geometry: localidad.geom,
        num_fimm: [numFimm]
    };
    
    showStatus(`Filtrando ${localidadNombre}...`, 'loading');
    enableDependentLayers(localidadNombre);
    
    layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', [localidad], filteredStyle.localidades);
    if (!map.hasLayer(layerGroups.localidades)) layerGroups.localidades.addTo(map);
    
    const municipioPadre = municipiosData.find(m => m.nam === localidad.partido || m.nam === localidad.partido_ig);
    layerGroups.municipios.clearLayers();
    if (municipioPadre) {
        renderDataToLayer('municipios', [municipioPadre], filteredStyle.municipios);
        if (map.hasLayer(layerGroups.municipios)) map.removeLayer(layerGroups.municipios);
        const cb = document.getElementById('layer-municipios');
        if (cb) { cb.checked = false; cb.disabled = false; }
    }
    
    if (localidad.geom) zoomToGeometry(localidad.geom);
    
    // Cargar calles
    const callesFiltradas = await loadFilteredPostGIS('calles', 'localidad', localidadNombre);
    layerGroups.calles.clearLayers();
    if (callesFiltradas.length > 0) {
        renderDataToLayer('calles', callesFiltradas);
        if (!map.hasLayer(layerGroups.calles)) layerGroups.calles.addTo(map);
        console.log(`✓ ${callesFiltradas.length} calles cargadas`);
    }
    
    // Cargar red de gas
    const redGasFiltrada = await loadFilteredPostGIS('red_de_gas', 'localidad', localidadNombre);
    layerGroups.red_de_gas.clearLayers();
    if (redGasFiltrada.length > 0) {
        renderRedGasWithDiameterClassification(redGasFiltrada);
        if (!map.hasLayer(layerGroups.red_de_gas)) layerGroups.red_de_gas.addTo(map);
        console.log(`✓ ${redGasFiltrada.length} red de gas cargada`);
    }
    
    // Cargar suministros filtrando por num_fimm desde el cache
    console.log(`Filtrando suministros por Localidad = ${numFimm}`);
    const suministrosFiltrados = suministrosData.filter(s => s.Localidad === numFimm);
    console.log(`📊 Suministros encontrados en filtro: ${suministrosFiltrados.length}`);
    
    if (suministrosFiltrados.length > 0) {
        console.log('📊 Muestra de suministros filtrados (primeros 3):', suministrosFiltrados.slice(0, 3).map(s => ({
            medidor: s.medidor, ruta: s.ruta, orden: s.orden, Localidad: s.Localidad
        })));
        
        renderDataToLayer('suministros', suministrosFiltrados);
        if (!map.hasLayer(layerGroups.suministros)) layerGroups.suministros.addTo(map);
        
        inicializarModuloRuteo(suministrosFiltrados, localidadNombre);
    } else {
        console.log('⚠️ No se encontraron suministros para esta localidad');
        limpiarModuloRuteo();
    }
    
    setTimeout(() => fitViewToLayerGroup('localidades'), 500);
    
    const summary = `${localidadNombre}: ${callesFiltradas.length} calles, ${redGasFiltrada.length} red gas, ${suministrosFiltrados.length} suministros`;
    showStatus(summary, 'success');
}

async function applyUnidadRegionalFilter() {
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
    
    currentFilter = {
        type: 'unidad_regional',
        name: unidadRegional,
        num_fimm: []
    };
    
    const localidadesFiltradas = localidadesData.filter(l => l.unidad_regional === unidadRegional);
    
    if (localidadesFiltradas.length === 0) {
        showStatus(`No se encontraron localidades para ${unidadRegional}`, 'error');
        return;
    }
    
    console.log(`Localidades encontradas: ${localidadesFiltradas.length}`);
    currentFilter.num_fimm = localidadesFiltradas.map(l => l.num_fimm).filter(n => n != null);
    
    layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', localidadesFiltradas, filteredStyle.localidades);
    if (!map.hasLayer(layerGroups.localidades)) layerGroups.localidades.addTo(map);
    const localidadesCheckbox = document.getElementById('layer-localidades');
    if (localidadesCheckbox) {
        localidadesCheckbox.checked = true;
        localidadesCheckbox.disabled = false;
    }
    
    const municipiosUnicos = [...new Set(localidadesFiltradas.map(l => l.municipio))];
    const municipiosFiltrados = municipiosData.filter(m => municipiosUnicos.includes(m.municipio));
    layerGroups.municipios.clearLayers();
    if (municipiosFiltrados.length > 0) {
        renderDataToLayer('municipios', municipiosFiltrados, filteredStyle.municipios);
        if (map.hasLayer(layerGroups.municipios)) map.removeLayer(layerGroups.municipios);
        const municipiosCheckbox = document.getElementById('layer-municipios');
        if (municipiosCheckbox) municipiosCheckbox.checked = false;
    }
    
    setTimeout(() => fitViewToLayerGroup('localidades'), 500);
    habilitarCapasDependientesApagadas(unidadRegional);
    
    // Cargar calles
    const callesUR = await loadFilteredPostGIS('calles', 'localidad', unidadRegional);
    layerGroups.calles.clearLayers();
    if (callesUR.length > 0) {
        renderDataToLayer('calles', callesUR);
        if (map.hasLayer(layerGroups.calles)) map.removeLayer(layerGroups.calles);
        console.log(`✓ ${callesUR.length} calles cargadas (apagadas)`);
    }
    
    // Cargar red de gas
    const redGasUR = await loadFilteredPostGIS('red_de_gas', 'localidad', unidadRegional);
    layerGroups.red_de_gas.clearLayers();
    if (redGasUR.length > 0) {
        renderRedGasWithDiameterClassification(redGasUR);
        if (map.hasLayer(layerGroups.red_de_gas)) map.removeLayer(layerGroups.red_de_gas);
        document.getElementById('toggleLegendBtn').style.display = 'none';
        document.getElementById('legend').style.display = 'none';
        console.log(`✓ ${redGasUR.length} red de gas cargada (apagada)`);
    }
    
    // Cargar suministros filtrados por las localidades
    const numFimms = localidadesFiltradas.map(l => l.num_fimm).filter(n => n != null);
    const suministrosUR = suministrosData.filter(s => numFimms.includes(s.Localidad));
    console.log(`📊 Suministros encontrados: ${suministrosUR.length}`);
    
    if (suministrosUR.length > 0) {
        renderDataToLayer('suministros', suministrosUR);
        if (map.hasLayer(layerGroups.suministros)) map.removeLayer(layerGroups.suministros);
        inicializarModuloRuteo(suministrosUR, unidadRegional);
    }
    
    mostrarListaLocalidadesUR(localidadesFiltradas);
    showStatus(`${localidadesFiltradas.length} localidades en ${unidadRegional}`, 'success');
}

function habilitarCapasDependientesApagadas(filterName) {
    ['red_de_gas', 'calles', 'suministros'].forEach(capa => {
        const label = document.getElementById(`label-${capa}`);
        const nombres = { red_de_gas: 'Red de Gas', calles: 'Calles', suministros: 'Suministros' };
        if (label) {
            label.innerHTML = `<input type="checkbox" id="layer-${capa}" data-table="${capa}"> ${nombres[capa]} (${filterName})`;
            const cb = document.getElementById(`layer-${capa}`);
            if (cb) cb.addEventListener('change', handleCheckboxChange);
        }
    });
}

function mostrarListaLocalidadesUR(localidades) {
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

function clearFilter() {
    console.log('Limpiando filtro');
    
    currentFilter = null;
    
    const selectLocalidad = document.getElementById('selectLocalidad');
    const selectUnidadRegional = document.getElementById('selectUnidadRegional');
    
    if (selectLocalidad) selectLocalidad.value = '';
    if (selectUnidadRegional) selectUnidadRegional.value = '';
    
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    
    if (redGasLabel) {
        redGasLabel.innerHTML = `<input type="checkbox" id="layer-red_de_gas" data-table="red_de_gas" disabled> Red de Gas (requiere filtro)`;
    }
    if (callesLabel) {
        callesLabel.innerHTML = `<input type="checkbox" id="layer-calles" data-table="calles" disabled> Calles (requiere filtro)`;
    }
    if (suministrosLabel) {
        suministrosLabel.innerHTML = `<input type="checkbox" id="layer-suministros" data-table="suministros" disabled> Suministros (requiere filtro)`;
    }
    
    const redGasCheckbox = document.getElementById('layer-red_de_gas');
    const callesCheckbox = document.getElementById('layer-calles');
    const suministrosCheckbox = document.getElementById('layer-suministros');
    
    if (redGasCheckbox) { redGasCheckbox.checked = false; redGasCheckbox.disabled = true; }
    if (callesCheckbox) { callesCheckbox.checked = false; callesCheckbox.disabled = true; }
    if (suministrosCheckbox) { suministrosCheckbox.checked = false; suministrosCheckbox.disabled = true; }
    
    if (layerGroups.red_de_gas && map.hasLayer(layerGroups.red_de_gas)) map.removeLayer(layerGroups.red_de_gas);
    if (layerGroups.calles && map.hasLayer(layerGroups.calles)) map.removeLayer(layerGroups.calles);
    if (layerGroups.suministros && map.hasLayer(layerGroups.suministros)) map.removeLayer(layerGroups.suministros);
    
    if (layerGroups.red_de_gas) layerGroups.red_de_gas.clearLayers();
    if (layerGroups.calles) layerGroups.calles.clearLayers();
    if (layerGroups.suministros) layerGroups.suministros.clearLayers();
    
    // Volver a renderizar todos los suministros (sin filtro)
    if (suministrosData.length > 0) {
        renderDataToLayer('suministros', suministrosData);
    }
    
    if (municipiosData.length > 0) renderDataToLayer('municipios', municipiosData);
    if (localidadesData.length > 0) renderDataToLayer('localidades', localidadesData);
    
    if (!map.hasLayer(layerGroups.municipios)) layerGroups.municipios.addTo(map);
    
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
    map.setView([-36.14685, -60.28183], 6);
    showStatus('Filtro limpiado', 'success');
}

function handleCheckboxChange() {
    const tableName = this.dataset.table;
    const isChecked = this.checked;
    
    if (isChecked) {
        if (layerGroups[tableName] && !map.hasLayer(layerGroups[tableName])) layerGroups[tableName].addTo(map);
    } else {
        if (layerGroups[tableName] && map.hasLayer(layerGroups[tableName])) map.removeLayer(layerGroups[tableName]);
    }
    
    if (tableName === 'red_de_gas') {
        const toggleBtn = document.getElementById('toggleLegendBtn');
        const legend = document.getElementById('legend');
        if (toggleBtn && legend) {
            if (isChecked) {
                toggleBtn.style.display = 'block';
            } else {
                toggleBtn.style.display = 'none';
                legend.style.display = 'none';
                toggleBtn.textContent = 'Mostrar Leyenda';
            }
        }
    }
}

async function updateEstado(safeKey, medidor) {
    const select = document.getElementById(`estado-select-${safeKey}`);
    const msgDiv = document.getElementById(`popup-msg-${safeKey}`);
    if (!select || !msgDiv) return;
    
    const nuevoEstado = select.value;
    msgDiv.innerHTML = '⏳ Guardando...';
    msgDiv.style.color = '#856404';
    
    try {
        const { error } = await supabaseClient
            .from('suministros')
            .update({ estado: nuevoEstado })
            .eq('medidor', parseInt(medidor, 10));
        
        if (error) throw error;
        
        const item = suministrosData.find(s => String(s.medidor) === String(medidor));
        if (item) item.estado = nuevoEstado;
        
        actualizarColorPuntoByMedidor(medidor);
        msgDiv.innerHTML = '✅ Guardado correctamente';
        msgDiv.style.color = '#155724';
    } catch (err) {
        console.error('Error actualizando estado:', err);
        msgDiv.innerHTML = '❌ ' + (err.message || 'Error al guardar');
        msgDiv.style.color = '#721c24';
    }
}

function actualizarColorPuntoByMedidor(medidor) {
    layerGroups.suministros.eachLayer(function(geoJsonLayer) {
        geoJsonLayer.eachLayer(function(circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.medidor) === String(medidor)) {
                const ruta = props.ruta;
                const orden = props.orden;
                const tieneRuta = ruta && ruta !== null && ruta !== '';
                const tieneOrden = orden && orden !== null && orden !== 0;
                let color = (tieneRuta && tieneOrden) ? obtenerColorRuta(String(ruta)) : '#aaaaaa';
                const borderColor = color === '#aaaaaa' ? '#666666' : color;
                circleLayer.setStyle({ fillColor: color, color: borderColor });
            }
        });
    });
}

function initSearchPanel() {
    const toggleBtn = document.getElementById('toggleSearchBtn');
    const closeBtn = document.getElementById('closeSearchBtn');
    const panel = document.getElementById('searchPanel');
    const searchBtn = document.getElementById('searchBtn');
    const input = document.getElementById('searchInput');
    
    if (!toggleBtn || !panel) return;
    toggleBtn.addEventListener('click', () => panel.classList.toggle('open'));
    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('open'));
    if (searchBtn) searchBtn.addEventListener('click', buscarSuministro);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') buscarSuministro(); });
}

function buscarSuministro() {
    const campo = document.getElementById('searchField').value;
    const texto = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    if (!texto) { if (resultsDiv) resultsDiv.innerHTML = '<div class="search-no-results">Ingresá un texto para buscar.</div>'; return; }
    if (suministrosData.length === 0) { if (resultsDiv) resultsDiv.innerHTML = '<div class="search-no-results">Primero cargá los datos base.</div>'; return; }
    
    const todoEncontrado = suministrosData.filter(s => { const valor = s[campo]; return valor && String(valor).toLowerCase().includes(texto); });
    if (!resultsDiv) return;
    if (todoEncontrado.length === 0) { resultsDiv.innerHTML = '<div class="search-no-results">Sin resultados.</div>'; return; }
    
    let enFiltro = todoEncontrado, enOtra = [];
    if (currentFilter && currentFilter.num_fimm && currentFilter.num_fimm.length > 0) {
        const numFimms = currentFilter.num_fimm.map(String);
        enFiltro = todoEncontrado.filter(s => numFimms.includes(String(s.Localidad)));
        enOtra = todoEncontrado.filter(s => !numFimms.includes(String(s.Localidad)));
    }
    
    resultsDiv.innerHTML = '';
    if (enFiltro.length > 0) {
        enFiltro.slice(0, 20).forEach(item => renderResultItem(item, resultsDiv));
        if (enFiltro.length > 20) resultsDiv.innerHTML += '<div class="search-no-results">Mostrando 20 de ' + enFiltro.length + ' resultados.</div>';
    } else if (currentFilter && currentFilter.num_fimm && currentFilter.num_fimm.length > 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No se encontró en ' + currentFilter.name + '.</div>';
    }
    if (enOtra.length > 0) {
        resultsDiv.innerHTML += '<div style="font-size:11px; color:#856404; background:#fff3cd; padding:5px; margin-top:6px;">⚠️ ' + enOtra.length + ' resultado(s) en otra localidad:</div>';
        enOtra.slice(0, 5).forEach(item => {
            const loc = localidadesData.find(l => String(l.num_fimm) === String(item.Localidad));
            renderResultItem(item, resultsDiv, loc ? loc.nombre : `Localidad ${item.Localidad}`);
        });
    }
    if (!currentFilter || !currentFilter.num_fimm || currentFilter.num_fimm.length === 0) {
        todoEncontrado.slice(0, 20).forEach(item => renderResultItem(item, resultsDiv));
        if (todoEncontrado.length > 20) resultsDiv.innerHTML += '<div class="search-no-results">Mostrando 20 de ' + todoEncontrado.length + ' resultados.</div>';
    }
}

function renderResultItem(item, container, otraLocalidad = null) {
    const ruta = item.ruta || '-';
    const orden = item.orden || '-';
    const colorRuta = (ruta && ruta !== '-') ? obtenerColorRuta(String(ruta)) : '#666';
    
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<div class="result-main">${item.Nombre || item.medidor || '-'}</div>
        <div class="result-sub">🔢 Medidor: ${item.medidor || '-'} | Estado: ${item.estado || '-'}</div>
        <div class="result-sub">🚚 Ruta: <span style="color:${colorRuta}; font-weight:bold;">${ruta}</span> | 🔢 Orden: ${orden}</div>
        <div class="result-sub">📍 ${item.Direccion || ''}${otraLocalidad ? ` <em style="color:#856404">— ${otraLocalidad}</em>` : ''}</div>`;
    div.addEventListener('click', () => zoomASuministro(item));
    container.appendChild(div);
}

function zoomASuministro(item) {
    const geom = item.geom || item.wkt_geom || item.the_geom;
    if (!geom) return;
    let coords;
    if (typeof geom === 'object' && geom.coordinates) coords = geom.coordinates;
    else if (typeof geom === 'string') { const gj = wktToGeoJSON(geom); if (gj && gj.coordinates) coords = gj.coordinates; }
    if (!coords) return;
    const latlng = L.latLng(coords[1], coords[0]);
    map.setView(latlng, 18);
    layerGroups.suministros.eachLayer(function(geoJsonLayer) {
        geoJsonLayer.eachLayer(function(circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.medidor) === String(item.medidor)) {
                setTimeout(() => {
                    const colorOriginal = circleLayer.options.fillColor, borderOriginal = circleLayer.options.color, radioOriginal = circleLayer.options.radius;
                    circleLayer.setStyle({ fillColor: '#ffffff', color: '#0000ff', weight: 3, radius: 12, fillOpacity: 0.9 });
                    circleLayer.setRadius(12);
                    circleLayer.openPopup();
                    setTimeout(() => {
                        circleLayer.setStyle({ fillColor: colorOriginal, color: borderOriginal, weight: 1.5, fillOpacity: 0.85 });
                        circleLayer.setRadius(radioOriginal || 4);
                    }, 2500);
                }, 400);
            }
        });
    });
    const searchPanel = document.getElementById('searchPanel');
    if (searchPanel) searchPanel.classList.remove('open');
}

// ================================================================
// MÓDULO DE RUTEO CON PANEL DE RUTAS Y TOGGLES POR RUTA
// ================================================================

function inicializarModuloRuteo(suministros, localidadNombre) {
    console.log('📦 Inicializando módulo de ruteo con', suministros.length, 'suministros');
    
    localidadFiltroActual = localidadNombre;
    borrador = [];
    suministrosBorradorMap = {};
    modoEdicion = false;
    rutasVisibles.clear();
    
    // Clasificar suministros basado en ruta y orden
    suministrosConRuta = suministros.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
    suministrosSinRuta = suministros.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');
    
    console.log(`📊 Clasificación: ${suministrosConRuta.length} con ruta+orden, ${suministrosSinRuta.length} sin asignar`);
    
    // Inicializar mapa de borrador
    suministros.forEach(s => {
        suministrosBorradorMap[s.medidor] = { ruta: s.ruta ?? null, orden: s.orden ?? null };
    });
    
    // Inicializar visibilidad de rutas (todas visibles por defecto)
    const rutasUnicas = [...new Set(suministrosConRuta.map(s => String(s.ruta)))];
    rutasUnicas.forEach(ruta => rutasVisibles.set(ruta, true));
    
    // Asegurar que los puntos se muestren correctamente en el mapa
    if (layerGroups.suministros) {
        renderDataToLayer('suministros', suministros);
    }
    
    renderPanelRuteo();
}

function limpiarModuloRuteo() {
    if (ruteoLayerGroup) { map.removeLayer(ruteoLayerGroup); ruteoLayerGroup = null; }
    if (ruteoSinAsignarLayer) { map.removeLayer(ruteoSinAsignarLayer); ruteoSinAsignarLayer = null; }
    if (capaRutasGroup) { map.removeLayer(capaRutasGroup); capaRutasGroup = null; }
    
    suministrosConRuta = [];
    suministrosSinRuta = [];
    borrador = [];
    suministrosBorradorMap = {};
    modoEdicion = false;
    localidadFiltroActual = null;
    rutasVisibles.clear();
    
    const panel = document.getElementById('ruteoModuloPanel');
    if (panel) panel.style.display = 'none';
}

function renderPanelRuteo() {
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
    
    const rutasUnicas = [...new Set(suministrosConRuta.map(s => String(s.ruta)))].sort((a, b) => Number(a) - Number(b));
    const yaAsignadosEnBorrador = new Set(borrador.map(b => String(b.medidor)));
    const sinAsignarCount = suministrosSinRuta.filter(s => !yaAsignadosEnBorrador.has(String(s.medidor))).length;
    const hayBorrador = borrador.length > 0;
    
    panel.innerHTML = `
        <h3>🗺️ Gestión de Rutas</h3>
        
        <div style="font-size:0.82em; color:#555; margin-bottom:8px;">
            ${localidadFiltroActual || ''} · ${rutasUnicas.length} ruta(s) · 
            <span style="color:${sinAsignarCount > 0 ? '#c0392b' : '#27ae60'}; font-weight:bold;">
                ${sinAsignarCount} sin asignar
            </span>
        </div>
        
        ${rutasUnicas.length > 0 ? `
        <div style="margin-bottom:10px; max-height:200px; overflow-y:auto;">
            ${rutasUnicas.map(ruta => {
                const sumisEnRuta = suministrosConRuta.filter(s => String(s.ruta) === ruta);
                const color = obtenerColorRuta(ruta);
                const esVisible = rutasVisibles.get(ruta) !== false;
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
                            <strong style="color: ${color};font-size: 12px;">🚚 Ruta ${ruta}</strong>
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
        <button id="ruteoModoEdicionBtn" class="filter-btn" style="background:${modoEdicion ? '#c0392b' : '#2980b9'}; margin-bottom:4px;">
            ${modoEdicion ? '⏹ Salir de asignación' : '✏️ Asignar puntos sin ruta'}
        </button>
        ` : ''}
        
        ${hayBorrador ? `
        <div style="background:#fff3cd; border:1px solid #ffc107; border-radius:4px; padding:6px 8px; font-size:0.8em; margin-bottom:6px;">
            <strong>⚠️ Borrador:</strong> ${borrador.length} cambio(s) pendiente(s)
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
    
    // Event listeners para los toggles de ruta
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

function handleRutaToggle(e) {
    e.stopPropagation();
    const ruta = e.currentTarget.getAttribute('data-ruta');
    toggleVisibilidadRuta(ruta);
}

function toggleVisibilidadRuta(ruta) {
    const esVisible = rutasVisibles.get(ruta);
    rutasVisibles.set(ruta, !esVisible);
    
    // Actualizar los puntos de suministros de esta ruta
    layerGroups.suministros.eachLayer(function(geoJsonLayer) {
        geoJsonLayer.eachLayer(function(circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.ruta) === String(ruta)) {
                if (esVisible) {
                    // Estaba visible, ahora ocultar
                    if (map.hasLayer(circleLayer)) map.removeLayer(circleLayer);
                } else {
                    // Estaba oculta, ahora mostrar
                    if (!map.hasLayer(circleLayer)) circleLayer.addTo(map);
                }
            }
        });
    });
    
    // Actualizar UI del panel
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

function toggleModoEdicion() {
    modoEdicion = !modoEdicion;
    
    if (modoEdicion) {
        renderPuntosSinAsignar();
        map.getContainer().style.cursor = 'crosshair';
        showStatus('✏️ Modo edición activado. Haga clic en un punto sin asignar para asignarlo.', 'loading');
    } else {
        if (ruteoSinAsignarLayer) { map.removeLayer(ruteoSinAsignarLayer); ruteoSinAsignarLayer = null; }
        map.getContainer().style.cursor = '';
        showStatus('Modo edición desactivado.', 'success');
    }
    
    renderPanelRuteo();
}

function renderPuntosSinAsignar() {
    if (ruteoSinAsignarLayer) { map.removeLayer(ruteoSinAsignarLayer); ruteoSinAsignarLayer = null; }
    ruteoSinAsignarLayer = L.layerGroup().addTo(map);
    
    const yaAsignados = new Set(borrador.map(b => String(b.medidor)));
    const pendientes = suministrosSinRuta.filter(s => !yaAsignados.has(String(s.medidor)));
    
    console.log(`📍 Puntos sin asignar a renderizar: ${pendientes.length}`);
    
    pendientes.forEach(s => {
        const latlng = getLatLngFromSuministro(s);
        if (!latlng) return;
        
        const marker = L.circleMarker(latlng, {
            radius: 8,
            fillColor: '#e74c3c',
            color: '#922b21',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
        }).bindTooltip(`Sin asignar<br>Medidor: ${s.medidor}<br>${s.Nombre || ''}`, { permanent: false });
        
        marker.on('click', () => abrirPopupAsignacion(s, marker));
        ruteoSinAsignarLayer.addLayer(marker);
    });
    
    if (pendientes.length === 0 && modoEdicion) {
        showStatus('✓ Todos los puntos están asignados.', 'success');
        modoEdicion = false;
        renderPanelRuteo();
    }
}

function abrirPopupAsignacion(suministro, marker) {
    const rutasExistentes = [...new Set(suministrosConRuta.map(s => String(s.ruta)))].sort((a, b) => Number(a) - Number(b));
    const siguienteOrden = {};
    rutasExistentes.forEach(r => { siguienteOrden[r] = getSiguienteOrden(r); });
    
    const popupId = `asig_${suministro.medidor}`;
    
    const html = `
        <div style="min-width:220px; font-size:0.85em;">
            <strong>✏️ Asignar suministro</strong><br>
            <span style="color:#555;">Medidor: ${suministro.medidor}</span><br>
            <span style="color:#555;">${suministro.Nombre || ''}</span>
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
            
            <button onclick="confirmarAsignacionPopup('${suministro.medidor}', '${popupId}')"
                style="width:100%; padding:6px; background:#2980b9; color:white; border:none; border-radius:4px; cursor:pointer;">
                ✓ Confirmar Asignación
            </button>
        </div>
    `;
    
    const popup = L.popup({ maxWidth: 260 }).setLatLng(marker.getLatLng()).setContent(html).openOn(map);
    
    setTimeout(() => {
        const selectRuta = document.getElementById(`${popupId}_ruta`);
        const nuevaDiv = document.getElementById(`${popupId}_nuevaRutaDiv`);
        const ordenInput = document.getElementById(`${popupId}_orden`);
        if (!selectRuta) return;
        
        selectRuta.addEventListener('change', function() {
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

window.confirmarAsignacionPopup = function(medidor, popupId) {
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
    
    const suministro = suministrosSinRuta.find(s => String(s.medidor) === String(medidor));
    if (!suministro) return;
    
    // Desplazar órdenes en borrador
    desplazarOrdenEnBorrador(String(rutaNueva), ordenNuevo, medidor);
    
    const entrada = {
        medidor,
        rutaAnterior: suministro.ruta ?? null,
        ordenAnterior: suministro.orden ?? null,
        rutaNueva: String(rutaNueva),
        ordenNuevo
    };
    const existente = borrador.findIndex(b => String(b.medidor) === String(medidor));
    if (existente >= 0) borrador[existente] = entrada;
    else borrador.push(entrada);
    
    suministrosBorradorMap[medidor] = { ruta: String(rutaNueva), orden: ordenNuevo };
    
    // Mover de sinRuta a conRuta en memoria
    const idx = suministrosSinRuta.findIndex(s => String(s.medidor) === String(medidor));
    if (idx >= 0) {
        const s = suministrosSinRuta.splice(idx, 1)[0];
        s.ruta = String(rutaNueva);
        s.orden = ordenNuevo;
        suministrosConRuta.push(s);
        
        // Actualizar visibilidad de la nueva ruta
        if (!rutasVisibles.has(String(rutaNueva))) {
            rutasVisibles.set(String(rutaNueva), true);
        }
    }
    
    map.closePopup();
    renderPuntosSinAsignar();
    renderPanelRuteo();
    
    // Actualizar el color del punto en el mapa
    actualizarColorPuntoByMedidor(medidor);
    
    showStatus(`✅ Medidor ${medidor} → Ruta ${rutaNueva}, Orden ${ordenNuevo} (borrador)`, 'success');
};

function desplazarOrdenEnBorrador(ruta, ordenDesde, medidorNuevo) {
    const afectados = [];
    
    suministrosConRuta.forEach(s => {
        const est = suministrosBorradorMap[s.medidor] || { ruta: s.ruta, orden: s.orden };
        if (String(est.ruta) === String(ruta) && Number(est.orden) >= ordenDesde && String(s.medidor) !== String(medidorNuevo)) {
            afectados.push({ medidor: s.medidor, ordenActual: Number(est.orden) });
        }
    });
    
    borrador.forEach(b => {
        if (String(b.rutaNueva) === String(ruta) && Number(b.ordenNuevo) >= ordenDesde && String(b.medidor) !== String(medidorNuevo)) {
            if (!afectados.find(a => String(a.medidor) === String(b.medidor))) {
                afectados.push({ medidor: b.medidor, ordenActual: Number(b.ordenNuevo) });
            }
        }
    });
    
    afectados.sort((a, b) => b.ordenActual - a.ordenActual);
    
    afectados.forEach(({ medidor, ordenActual }) => {
        suministrosBorradorMap[medidor] = { ...suministrosBorradorMap[medidor], orden: ordenActual + 1 };
        
        const enBorrador = borrador.findIndex(b => String(b.medidor) === String(medidor));
        if (enBorrador >= 0) {
            borrador[enBorrador].ordenNuevo = ordenActual + 1;
        } else {
            const original = suministrosConRuta.find(s => String(s.medidor) === String(medidor));
            if (original) {
                borrador.push({
                    medidor,
                    rutaAnterior: original.ruta,
                    ordenAnterior: original.orden,
                    rutaNueva: String(ruta),
                    ordenNuevo: ordenActual + 1
                });
            }
        }
    });
}

async function confirmarBorrador() {
    if (borrador.length === 0) return;
    
    const btn = document.getElementById('ruteoConfirmarBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    
    let errores = 0;
    
    for (const cambio of borrador) {
        try {
            const { error } = await supabaseClient
                .from('suministros')
                .update({ ruta: cambio.rutaNueva, orden: cambio.ordenNuevo })
                .eq('medidor', cambio.medidor);
            
            if (error) {
                console.error(`Error actualizando medidor ${cambio.medidor}:`, error);
                errores++;
            } else {
                const idx = suministrosData.findIndex(s => String(s.medidor) === String(cambio.medidor));
                if (idx >= 0) {
                    suministrosData[idx].ruta = cambio.rutaNueva;
                    suministrosData[idx].orden = cambio.ordenNuevo;
                }
            }
        } catch (e) {
            console.error(e);
            errores++;
        }
    }
    
    if (errores === 0) {
        showStatus(`✓ ${borrador.length} cambio(s) guardados correctamente.`, 'success');
        borrador = [];
        suministrosBorradorMap = {};
        suministrosConRuta = suministrosData.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
        suministrosSinRuta = suministrosData.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');
        
        // Re-renderizar suministros en el mapa
        if (layerGroups.suministros && currentFilter && currentFilter.num_fimm) {
            const suministrosFiltrados = suministrosData.filter(s => currentFilter.num_fimm.includes(s.Localidad));
            renderDataToLayer('suministros', suministrosFiltrados);
            inicializarModuloRuteo(suministrosFiltrados, localidadFiltroActual);
        } else if (layerGroups.suministros) {
            renderDataToLayer('suministros', suministrosData);
        }
    } else {
        showStatus(`⚠️ ${errores} error(es) al guardar.`, 'error');
    }
    
    modoEdicion = false;
    if (ruteoSinAsignarLayer) { map.removeLayer(ruteoSinAsignarLayer); ruteoSinAsignarLayer = null; }
    map.getContainer().style.cursor = '';
    renderPanelRuteo();
}

function descartarBorrador() {
    if (!confirm(`¿Descartar ${borrador.length} cambio(s) pendiente(s)?`)) return;
    
    borrador = [];
    suministrosBorradorMap = {};
    suministrosConRuta = suministrosData.filter(s => s.ruta != null && s.ruta !== '' && s.orden != null && s.orden !== 0 && s.orden !== '');
    suministrosSinRuta = suministrosData.filter(s => s.ruta == null || s.ruta === '' || s.orden == null || s.orden === 0 || s.orden === '');
    
    modoEdicion = false;
    if (ruteoSinAsignarLayer) { map.removeLayer(ruteoSinAsignarLayer); ruteoSinAsignarLayer = null; }
    map.getContainer().style.cursor = '';
    
    // Re-renderizar
    if (currentFilter && currentFilter.num_fimm) {
        const suministrosFiltrados = suministrosData.filter(s => currentFilter.num_fimm.includes(s.Localidad));
        renderDataToLayer('suministros', suministrosFiltrados);
        inicializarModuloRuteo(suministrosFiltrados, localidadFiltroActual);
    }
    
    renderPanelRuteo();
    showStatus('Cambios descartados.', 'success');
}

function getLatLngFromSuministro(s) {
    const geomField = s.wkt_geom || s.geom || s.the_geom;
    if (!geomField) return null;
    const geojson = typeof geomField === 'string' ? wktToGeoJSON(geomField) : geomField;
    if (!geojson) return null;
    if (geojson.type === 'Point') return L.latLng(geojson.coordinates[1], geojson.coordinates[0]);
    if (geojson.type === 'Feature' && geojson.geometry?.type === 'Point')
        return L.latLng(geojson.geometry.coordinates[1], geojson.geometry.coordinates[0]);
    return null;
}

function getSiguienteOrden(ruta) {
    let max = 0;
    suministrosConRuta.forEach(s => {
        const est = suministrosBorradorMap[s.medidor] || { ruta: s.ruta, orden: s.orden };
        if (String(est.ruta) === String(ruta) && Number(est.orden) > max) max = Number(est.orden);
    });
    borrador.forEach(b => {
        if (String(b.rutaNueva) === String(ruta) && Number(b.ordenNuevo) > max) max = Number(b.ordenNuevo);
    });
    return max + 1;
}