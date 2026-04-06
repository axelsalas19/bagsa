// Variables globales
let supabaseClient;
let municipiosData = [];
let localidadesData = [];
let callesData = [];
let redGasData = [];
let suministrosData = [];
let currentFilter = null;
let map;
let layerGroups;
let styles;
let filteredStyle;

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
        // Inicializar Supabase
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase conectado');
        
        // Inicializar mapa
        initMap();
        
        // Inicializar estilos
        initStyles();
        
        // Inicializar grupos de capas
        initLayerGroups();
        
        // Inicializar event listeners
        initEventListeners();

        // Inicializar panel de búsqueda
        initSearchPanel();
        
        
        
        
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        showStatus('Error al inicializar: ' + error.message, 'error');
    }
}

function initMap() {
    // Inicializar mapa centrado en Buenos Aires
    map = L.map('map').setView([-36.14685, -60.28183], 6);
    console.log('Mapa inicializado');
    
    // Definir capas base
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
    
    // Agregar capa base por defecto (OpenStreetMap)
    osmLayer.addTo(map);
    
    // Crear control de capas base
    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satélite": satelliteLayer,
        "Google Híbrido": googleHybridLayer,
        "ArgenMap Gris": argenmapLayer
    };
    
    L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);
    
    console.log('Capas base agregadas');
}

function initStyles() {
    styles = {
        municipios: {
            color: '#232323',
            weight: 1,
            fillOpacity: 0.1,
            fillColor: '#FFFFFF'
        },
        localidades: {
            color: '#0078ff',
            weight: 2,
            fillOpacity: 0.1,
            fillColor: '#5da6f8'
        },
        red_de_gas: {
            color: '#ff0000',
            weight: 2,
            opacity: 0.7
        },
        calles: {
            color: '#333333',
            weight: 2,
            opacity: 0.6
        }
    };
    
    filteredStyle = {
        municipios: {
            color: '#232323',
            weight: 1,
            fillOpacity: 0.1,
            fillColor: '#ffffff'
        },
        localidades: {
            color: '#2466e9',
            weight: 2,
            fillOpacity: 0.2,
            fillColor: '#e3e6eb'
        }
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

    // Ajustar radio de suministros según zoom
    map.on('zoomend', function() {
        const zoom = map.getZoom();
        const radius = zoom >= 16 ? 5 : zoom >= 14 ? 4 : zoom >= 12 ? 3 : 2;
        layerGroups.suministros.eachLayer(function(layer) {
            if (layer.eachLayer) {
                layer.eachLayer(function(subLayer) {
                    if (subLayer.setRadius) subLayer.setRadius(radius);
                });
            } else if (layer.setRadius) {
                layer.setRadius(radius);
            }
        });
    });
}

function initEventListeners() {
    
    // Crear botón toggle para móvil
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.getElementById('sidebar');
    
    // Crear overlay dinámicamente
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.id = 'sidebarOverlay';
    document.body.appendChild(sidebarOverlay);
    
    // Event listener para el botón móvil
    mobileToggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        this.textContent = sidebar.classList.contains('active') ? '✕' : '☰';
    });
    
    // Cerrar sidebar al hacer clic en el overlay
    sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        mobileToggleBtn.textContent = '☰';
    });
    
    // Cerrar sidebar al hacer clic en un enlace dentro del sidebar
    sidebar.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
            // Cerrar sidebar después de un breve retraso en móvil
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    sidebar.classList.remove('active');
                    mobileToggleBtn.textContent = '☰';
                }, 300);
            }
        }
    });
    
    // Inicializar event listeners para checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });
    
    // Event listeners para filtros
    //document.getElementById('applyMunicipioFilter').addEventListener('click', applyMunicipioFilter);
    document.getElementById('applyLocalidadFilter').addEventListener('click', applyLocalidadFilter);
    document.getElementById('applyUnidadRegionalFilter').addEventListener('click',applyUnidadRegionalFilter );
    //document.getElementById('clearMunicipioFilter').addEventListener('click', clearFilter);
    document.getElementById('clearLocalidadFilter').addEventListener('click', clearFilter);
    document.getElementById('clearUnidadRegionalFilter').addEventListener('click', clearFilter);

    // Botón para verificar tablas
    /*document.getElementById('checkTablesBtn').addEventListener('click', async function() {
        this.disabled = true;
        showStatus('Verificando tablas disponibles...', 'loading');
        
        const tablesToCheck = ['municipios', 'localidades', 'red_de_gas', 'calles'];
        let availableTables = [];
        
        for (const table of tablesToCheck) {
            try {
                const { count, error } = await supabaseClient
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                if (!error && count !== null) {
                    availableTables.push(`${table} (${count} registros)`);
                }
            } catch (e) {
                console.log(`Tabla ${table}: Error`);
            }
        }
        
        showStatus('Disponibles: ' + availableTables.join(', '), 'success');
        this.disabled = false;
    });*/
    
    // Botón para cargar datos base
    document.getElementById('loadDataBtn').addEventListener('click', async function() {
        this.disabled = true;
        await loadBaseData();
        this.disabled = false;
    });
    
    // Botón para mostrar/ocultar leyenda
    document.getElementById('toggleLegendBtn').addEventListener('click', function() {
        const legend = document.getElementById('legend');
        if (legend.style.display === 'block') {
            legend.style.display = 'none';
            this.textContent = 'Mostrar Leyenda';
        } else {
            legend.style.display = 'block';
            this.textContent = 'Ocultar Leyenda';
        }
    });
}

// Función para mostrar estado
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

// Función para convertir WKT a GeoJSON
function wktToGeoJSON(wkt) {
    try {
        if (!wkt || typeof wkt !== 'string') {
            console.warn('wktToGeoJSON: WKT no es string o está vacío');
            return null;
        }
        
        // Limpiar coordenadas Z
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

// Función para crear popup
function createPopup(properties, tableName) {
    let content = `<strong>Capa: ${tableName}</strong><br>`;
    for (const [key, value] of Object.entries(properties)) {
        if (value && key !== 'wkt_geom' && key !== 'geom' && key !== 'the_geom') {
            content += `<strong>${key}:</strong> ${value}<br>`;
        }
    }
    return content;
}

// Popups personalizados por capa
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
    let content = `<strong>Suministro</strong><br>`;
    if (properties.medidor)   content += `<strong>Medidor:</strong> ${properties.medidor}<br>`;
    if (properties.Cliente)   content += `<strong>Cliente:</strong> ${properties.Cliente}<br>`;
    if (properties.Nombre)    content += `<strong>Nombre:</strong> ${properties.Nombre}<br>`;
    if (properties.Direccion) content += `<strong>Dirección:</strong> ${properties.Direccion}<br>`;
    content += `<strong>Estado:</strong> ${properties.estado || '-'}<br>`;
    content += `
        <hr style="margin:6px 0; border-color:#eee;">
        <strong>Cambiar estado:</strong>
        <select class="popup-estado-select" id="estado-select-${safeKey}">
            <option value="Conectado" ${properties.estado === 'Conectado' ? 'selected' : ''}>Conectado</option>
            <option value="Cortado"   ${properties.estado === 'Cortado'   ? 'selected' : ''}>Cortado</option>
            <option value="Anomalia"  ${properties.estado === 'Anomalia'  ? 'selected' : ''}>Anomalia</option>
        </select>
        <button class="popup-save-btn" onclick="updateEstado('${safeKey}', '${medidor}')">Guardar</button>
        <div class="popup-save-msg" id="popup-msg-${safeKey}"></div>
    `;
    return content;
}

function createCallesPopup(properties) {
    let content = `<strong>Calle</strong><br>`;
    if (properties.name) content += `<strong>Nombre:</strong> ${properties.name}<br>`;
    if (properties.fclass) content += `<strong>Tipo:</strong> ${properties.fclass}<br>`;
    return content;
}

function createLocalidadPopup(properties) {    let content = `<strong>Localidad</strong><br>`;
    if (properties.nombre) content += `<strong>Nombre localidad:</strong> ${properties.nombre}<br>`;
    if (properties.partido) content += `<strong>Partido:</strong> ${properties.partido}<br>`;
    if (properties.unidad_regional) content += `<strong>Unidad Regional:</strong> ${properties.unidad_regional}<br>`;
    if (properties.zona_fria) content += `<strong>Zona Fría:</strong> ${properties.zona_fria}<br>`;
    if (properties.num_fimm) content += `<strong>Núm. Localidad:</strong> ${properties.num_fimm}<br>`;
    if (properties.turno) content += `<strong>Turno:</strong> ${properties.turno}<br>`;
    if (properties.producto) content +=  `<strong>Tipo Producto: </strong> ${properties.producto}<br>`;
    if (properties.cant_conect) content +=  `<strong>Capacidad máxima: </strong> ${properties.cant_conect}<br>`;
    if (properties.cant_tanques) content +=  `<strong>Cantidad tanques: </strong> ${properties.cant_tanques}<br>`;
    return content;
}

// Función para obtener bounds de un grupo de capas
function getLayerGroupBounds(layerGroup) {
    try {
        const layers = layerGroup.getLayers();
        if (layers.length === 0) return null;
        
        let bounds = null;
        
        layers.forEach(layer => {
            const layerBounds = layer.getBounds ? layer.getBounds() : null;
            if (layerBounds) {
                if (bounds === null) {
                    bounds = layerBounds;
                } else {
                    bounds.extend(layerBounds);
                }
            }
        });
        
        return bounds;
        
    } catch (error) {
        console.error('Error obteniendo bounds del grupo:', error);
        return null;
    }
}

// Función para hacer zoom a una geometría
function zoomToGeometry(geometryWKT) {
    try {
        if (!geometryWKT) {
            console.log('No hay geometría para hacer zoom');
            return;
        }
        
        console.log('Intentando hacer zoom a geometría');
        const geometryGeoJSON = wktToGeoJSON(geometryWKT);
        
        if (!geometryGeoJSON) {
            console.log('No se pudo convertir geometría a GeoJSON');
            return;
        }
        
        // Crear capa temporal para obtener bounds
        const tempLayer = L.geoJSON(geometryGeoJSON);
        const bounds = tempLayer.getBounds();
        
        if (bounds && bounds.isValid()) {
            console.log('Haciendo zoom a bounds:', bounds);
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 15
            });
        } else {
            console.log('Bounds no válidos');
        }
        
    } catch (error) {
        console.error('Error haciendo zoom:', error);
    }
}

// Función para cargar datos de una tabla (sin filtro)
async function loadTableData(tableName, options = {}) {
    try {
        const { limit } = options;
        
        console.log(`Cargando ${tableName}`);
        showStatus(`Cargando ${tableName}...`, 'loading');
        
        let query = supabaseClient.from(tableName).select('*');
        
        // Aplicar límite
        const queryLimit = limit || 5000;
        query = query.limit(queryLimit);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            console.log(`${tableName} - No hay datos`);
            showStatus(`No se encontraron datos en ${tableName}`, 'warning');
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

// Función para obtener color según estado del suministro
function getColorByEstado(estado) {
    if (!estado) return '#28a745';
    const e = estado.trim().toLowerCase();
    if (e === 'cortado') return '#dc3545';
    if (e === 'anomalia' || e === 'anomalía') return '#ffc107';
    return '#28a745';
}

// Función para renderizar datos en una capa
function renderDataToLayer(tableName, data, style = null) {
    console.log(`Renderizando ${tableName} - ${data.length} elementos`);
    
    // Limpiar capa anterior
    layerGroups[tableName].clearLayers();
    
    let featuresAdded = 0;
    
    data.forEach(item => {
        let geojson = null;
        
        // Obtener geometría
        const itemGeometry = item.wkt_geom || item.geom || item.the_geom;
        
        if (itemGeometry) {
            const rawGeom = typeof itemGeometry === 'string' ? 
                      wktToGeoJSON(itemGeometry) : itemGeometry;
            
            // Envolver en Feature GeoJSON con propiedades para que pointToLayer funcione
            if (rawGeom) {
                if (rawGeom.type === 'Feature') {
                    geojson = rawGeom;
                    if (!geojson.properties) geojson.properties = {};
                    Object.assign(geojson.properties, item);
                } else {
                    geojson = {
                        type: 'Feature',
                        geometry: rawGeom,
                        properties: item
                    };
                }
            }
        }
        
        if (geojson) {
            try {
                const layerStyle = style || styles[tableName] || {};

                const layerOptions = {
                    style: tableName === 'suministros' ? null : layerStyle,
                    onEachFeature: (feature, layer) => {
                        let popupContent;
                        if (tableName === 'municipios') {
                            popupContent = createMunicipioPopup(item);
                        } else if (tableName === 'localidades') {
                            popupContent = createLocalidadPopup(item);
                        } else if (tableName === 'suministros') {
                            popupContent = createSuministroPopup(item);
                        } else if (tableName === 'calles') {
                            popupContent = createCallesPopup(item);
                        } else {
                            popupContent = createPopup(item, tableName);
                        }
                        layer.bindPopup(popupContent);
                    }
                };

                // Para capas de puntos usar CircleMarker
                if (tableName === 'suministros') {
                    layerOptions.pointToLayer = (feature, latlng) => {
                        const estado = (feature.properties && feature.properties.estado) || item.estado;
                        const color = getColorByEstado(estado);
                        const borderColor = color === '#ffc107' ? '#cc9a00' : color === '#dc3545' ? '#a71d2a' : '#1a7a32';
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

// Función para ajustar vista a un grupo de capas
function fitViewToLayerGroup(tableName) {
    try {
        const bounds = getLayerGroupBounds(layerGroups[tableName]);
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
            console.log(`Vista ajustada a ${tableName}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error ajustando vista a ${tableName}:`, error);
        return false;
    }
}


// Función para obtener color según diámetro
function getColorByDiameter(diametro) {
    if (!diametro) return '#FFFFFF';
    
    const diametroNum = Number(diametro);
    
    if (diametroNum === 50) return '#f3a120';    
    if (diametroNum === 63) return '#0e2eea';    
    if (diametroNum === 90) return '#df0c0c';    
    if (diametroNum === 125) return '#15960b';    
    if (diametroNum === 180) return '#da21cb';    
    
    return '#FFFFFF'; // 
}

// Función para obtener clase CSS según diámetro
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

// Función para renderizar red de gas con clasificación por diámetro
function renderRedGasWithDiameterClassification(data) {
    console.log(`Renderizando red de gas con clasificación - ${data.length} elementos`);
    
    // Limpiar capa anterior
    layerGroups.red_de_gas.clearLayers();
    
    let featuresAdded = 0;
    
    data.forEach(item => {
        let geojson = null;
        
        // Obtener geometría
        const itemGeometry = item.wkt_geom || item.geom;
        
        if (itemGeometry) {
            geojson = typeof itemGeometry === 'string' ? 
                      wktToGeoJSON(itemGeometry) : itemGeometry;
        }
        
        if (geojson) {
            try {
                const diametro = item.diametro || item.diametro_mm;
                const color = getColorByDiameter(diametro);
                
                const layerStyle = {
                    color: color,
                    weight: 4, // 
                    opacity: 0.8,
                    className: getDiameterClass(diametro) // Agregar clase CSS
                };
                
                const layer = L.geoJSON(geojson, {
                    style: layerStyle,
                    onEachFeature: (feature, layer) => {
                        // Popup mejorado con diámetro
                        let popupContent = `<strong>Red de Gas</strong><br>`;
                        
                        if (diametro) {
                            popupContent += `<strong>Diámetro:</strong> Ø ${diametro} mm<br>`;
                        }
                        
                        if (item.material) {
                            popupContent += `<strong>Material:</strong> ${item.material}<br>`;
                        }
                        
                        if (item.estado) {
                            popupContent += `<strong>Estado:</strong> ${item.estado}<br>`;
                        }
                        
                        if (item.localidad) {
                            popupContent += `<strong>Localidad:</strong> ${item.localidad}<br>`;
                        }
                        
                        if (item.name || item.Name) {
                            popupContent += `<strong>Nombre:</strong> ${item.name || item.Name}<br>`;
                        }
                        
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
    
    // Mostrar botón de leyenda si hay elementos
    const toggleBtn = document.getElementById('toggleLegendBtn');
    if (featuresAdded > 0) {
        toggleBtn.style.display = 'block';
    }
    
    return featuresAdded;
}

// ===============================
// FUNCIONES POSTGIS - FILTRADO
// ===============================

// Función para cargar datos filtrados con PostGIS
async function loadFilteredPostGIS(tableName, filterType, filterValue) {
    try {
        console.log(`Cargando ${tableName} con PostGIS para ${filterType}: ${filterValue}`);
        
        let functionName;
        let params = {};
        
        if (filterType === 'municipio') {
            if (tableName === 'calles') {
                functionName = 'get_streets_by_municipio';
            } else if (tableName === 'red_de_gas') {
                functionName = 'get_gas_network_by_municipio';
            } else if (tableName === 'suministros') {
                functionName = 'get_suministros_by_municipio';
            }
            params = { municipio_name: filterValue };
            
        } else if (filterType === 'localidad') {
            if (tableName === 'calles') {
                functionName = 'get_streets_by_localidad';
            } else if (tableName === 'red_de_gas') {
                functionName = 'get_gas_network_by_localidad';
            } else if (tableName === 'suministros') {
                functionName = 'get_suministros_by_localidad';
            }
            params = { localidad_name: filterValue };
            
        } else {
            console.warn(`Tipo de filtro no soportado: ${filterType}`);
            return [];
        }
        
        if (!functionName) {
            console.warn(`No hay función PostGIS para ${tableName} con filtro ${filterType}`);
            return [];
        }
        
        console.log(`Ejecutando RPC: ${functionName}`, params);
        
        const { data, error } = await supabaseClient
            .rpc(functionName, params)
            .range(0, 9999);
        
        if (error) {
            console.error(`Error en RPC ${functionName}:`, error);
            showStatus(`Error: ${error.message}`, 'error');
            return [];
        }
        
        console.log(`${tableName}: ${data?.length || 0} elementos encontrados`);
        return data || [];
        
    } catch (error) {
        console.error(`Error cargando ${tableName}:`, error);
        return [];
    }
}

// ===============================
// CARGA DE DATOS BASE
// ===============================

async function loadBaseData(){
    try {
        console.log('Iniciando carga de datos base');
        
        // Cargar municipios
        municipiosData = await loadTableData('municipios', { limit: 200 });
        console.log('Municipios cargados:', municipiosData.length);
        
        if (municipiosData.length > 0) {
            // Renderizar municipios inicialmente
            renderDataToLayer('municipios', municipiosData);
            //populateMunicipioSelect();
            //enableMunicipioFilter();
            //console.log('Filtro municipio habilitado');
             if (!map.hasLayer(layerGroups.municipios)) {
            layerGroups.municipios.addTo(map);
            }
        // ==== ACTIVAR Y MARCAR CHECKBOX DE MUNICIPIOS ====
            const municipiosCheckbox = document.getElementById('layer-municipios');
            if (municipiosCheckbox) {
                municipiosCheckbox.checked = true;
                municipiosCheckbox.disabled = false;
            }

        }
        
        // Cargar localidades
        localidadesData = await loadTableData('localidades', { limit: 500 });
        console.log('Localidades cargadas:', localidadesData.length);
        
        if (localidadesData.length > 0) {
            // Renderizar localidades inicialmente
            renderDataToLayer('localidades', localidadesData);
            populateLocalidadSelect();
            enableLocalidadFilter();
            console.log('Filtro localidad habilitado');
            if (!map.hasLayer(layerGroups.localidades)) {
            layerGroups.localidades.addTo(map);
            }
         // ==== ACTIVAR Y MARCAR CHECKBOX DE LOCALIDADES ====
            const localidadesCheckbox = document.getElementById('layer-localidades');
            if (localidadesCheckbox) {
                localidadesCheckbox.checked = true;
                localidadesCheckbox.disabled = false;
            }
            populateUnidadRegionalSelect();
            console.log('Filtro unidad regional habilitado');

        // NO cargar calles y red de gas inicialmente - se cargarán con PostGIS
        console.log('Calles y red de gas se cargarán dinámicamente con PostGIS');

        // Cargar suministros (capa de puntos, habilitada pero apagada por defecto)
        showStatus('Cargando suministros...', 'loading');
        suministrosData = await loadTableData('suministros', { limit: 10000 });
        console.log('Suministros cargados:', suministrosData.length);

        if (suministrosData.length > 0) {
            renderDataToLayer('suministros', suministrosData);
            // No agregar al mapa todavía - el usuario lo activa con el checkbox
            const suministrosCheckbox = document.getElementById('layer-suministros');
            if (suministrosCheckbox) {
                suministrosCheckbox.disabled = false;
                suministrosCheckbox.checked = false;
            }
            // Actualizar etiqueta para indicar que está disponible
            const suministrosLabel = document.getElementById('label-suministros');
            if (suministrosLabel) {
                suministrosLabel.innerHTML = `
                    <input type="checkbox" id="layer-suministros" data-table="suministros">
                    Suministros (${suministrosData.length})
                `;
                const cb = document.getElementById('layer-suministros');
                if (cb) cb.addEventListener('change', handleCheckboxChange);
            }
        }
        
        console.log('Datos base cargados completamente');
        showStatus('Datos base cargados. Seleccione un filtro para ver calles y red de gas.', 'success');
        }
}catch (error) {
    console.error('Error cargando datos base:', error);
    }
}

// ===============================
// FUNCIONES PARA DROPDOWNS
// ===============================

// Poblar select de municipios
/*function populateMunicipioSelect() {
    const select = document.getElementById('selectMunicipio');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccione un municipio --</option>';
    
    // Usar 'nam' que es el campo real en la base de datos
    municipiosData.sort((a, b) => {
        const nameA = (a.nam || '').toLowerCase();
        const nameB = (b.nam || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    municipiosData.forEach((item) => {
        if (!item.nam) return;
        
        const nombre = item.nam;
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        option.dataset.id = item.id || item.fid;
        select.appendChild(option);
    });
    
    const debugInfo = document.getElementById('municipioDebug');
    if (debugInfo) {
        debugInfo.textContent = `${municipiosData.length} municipios cargados`;
    }
}*/

function populateUnidadRegionalSelect(){
    const selectUnidadRegional = document.getElementById('selectUnidadRegional');
    if (selectUnidadRegional)
    selectUnidadRegional.innerHTML = '<option value="">-- Seleccione unidad regional --</option>';
    
    // Extraer valores únicos del campo unidad_regional
    const unidadesRegionales = [...new Set(
        localidadesData
            .map(l => l.unidad_regional)
            .filter(ur => ur) // Filtrar valores vacíos o null
    )].sort();
    
    unidadesRegionales.forEach(unidad => {
        const option = document.createElement('option');
        option.value = unidad;
        option.textContent = unidad;
        selectUnidadRegional.appendChild(option);
    });
    
    selectUnidadRegional.disabled = false;
    document.getElementById('applyUnidadRegionalFilter').disabled = false;
    document.getElementById('clearUnidadRegionalFilter').disabled = false;
}

// Poblar select de localidades
function populateLocalidadSelect() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccione un Área de Servicio --</option>';
    
    // Usar 'nombre' que es el campo real en localidades
    localidadesData.sort((a, b) => {
        const nameA = (a.nombre || '').toLowerCase();
        const nameB = (b.nombre || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    
    localidadesData.forEach((item) => {
        if (!item.nombre) return;
        
        const nombre = item.nombre;
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        option.dataset.id = item.id || item.fid;
        select.appendChild(option);
    });
    
    const debugInfo = document.getElementById('localidadDebug');
    if (debugInfo) {
        debugInfo.textContent = `${localidadesData.length} localidades cargadas`;
    }
}

// Habilitar filtro de municipio
/*function enableMunicipioFilter() {
    const select = document.getElementById('selectMunicipio');
    const applyBtn = document.getElementById('applyMunicipioFilter');
    const clearBtn = document.getElementById('clearMunicipioFilter');
    
    if (select) select.disabled = false;
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}*/

// Habilitar filtro de localidad
function enableLocalidadFilter() {
    const select = document.getElementById('selectLocalidad');
    const applyBtn = document.getElementById('applyLocalidadFilter');
    const clearBtn = document.getElementById('clearLocalidadFilter');
    
    if (select) select.disabled = false;
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

// Habilitar capas dependientes
function enableDependentLayers(filterName) {
    console.log('Habilitando capas dependientes para:', filterName);
    
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    
    if (redGasLabel) {
        redGasLabel.innerHTML = `
            <input type="checkbox" id="layer-red_de_gas" data-table="red_de_gas" checked>
            Red de Gas (${filterName})
        `;
        
        // Re-asignar event listener
        const newRedGasCheckbox = document.getElementById('layer-red_de_gas');
        if (newRedGasCheckbox) {
            newRedGasCheckbox.addEventListener('change', handleCheckboxChange);
        }
    }
    
    if (callesLabel) {
        callesLabel.innerHTML = `
            <input type="checkbox" id="layer-calles" data-table="calles" checked>
            Calles (${filterName})
        `;
        
        // Re-asignar event listener
        const newCallesCheckbox = document.getElementById('layer-calles');
        if (newCallesCheckbox) {
            newCallesCheckbox.addEventListener('change', handleCheckboxChange);
        }
    }

    if (suministrosLabel) {
        suministrosLabel.innerHTML = `
            <input type="checkbox" id="layer-suministros" data-table="suministros" checked>
            Suministros (${filterName})
        `;
        
        const newSuministrosCheckbox = document.getElementById('layer-suministros');
        if (newSuministrosCheckbox) {
            newSuministrosCheckbox.addEventListener('change', handleCheckboxChange);
        }
    }
    
    // Asegurar que las capas estén en el mapa
    setTimeout(() => {
        if (!map.hasLayer(layerGroups.red_de_gas)) {
            layerGroups.red_de_gas.addTo(map);
        }
        if (!map.hasLayer(layerGroups.calles)) {
            layerGroups.calles.addTo(map);
        }
        if (!map.hasLayer(layerGroups.suministros)) {
            layerGroups.suministros.addTo(map);
        }
    }, 100);
}

// ===============================
// APLICAR FILTROS
// ===============================

// Aplicar filtro por municipio CON POSTGIS
/*async function applyMunicipioFilter() {
    console.log('Aplicando filtro municipio con PostGIS...');
    
    const select = document.getElementById('selectMunicipio');
    if (!select) return;
    
    const municipioNombre = select.value;
    
    if (!municipioNombre) {
        showStatus('Seleccione un municipio', 'error');
        return;
    }
    
    // Buscar municipio
    const municipio = municipiosData.find(m => m.nam === municipioNombre);
    
    if (!municipio) {
        showStatus('Municipio no encontrado', 'error');
        return;
    }
    
    currentFilter = {
        type: 'municipio',
        name: municipioNombre,
        data: municipio,
        geometry: municipio.geom
    };
    
    showStatus(`Filtrando ${municipioNombre} con PostGIS...`, 'loading');
    
    // Resaltar filtro activo
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    select.parentElement.classList.add('active-filter');
    
    // 1. Habilitar capas dependientes
    enableDependentLayers(municipioNombre);
    
    // 2. Activar checkboxes
    document.getElementById('layer-municipios').checked = true;
    document.getElementById('layer-localidades').checked = true;
    document.getElementById('layer-red_de_gas').checked = true;
    document.getElementById('layer-calles').checked = true;
    
    // 3. Renderizar solo el municipio seleccionado
    layerGroups.municipios.clearLayers();
    renderDataToLayer('municipios', [municipio], filteredStyle.municipios);
    
    // ==== AGREGAR ESTAS 2 LÍNEAS DESPUÉS ====
    if (!map.hasLayer(layerGroups.municipios)) {
    layerGroups.municipios.addTo(map);
    }
    // 4. Filtrar localidades del municipio (en cliente por ahora)
    const localidadesEnMunicipio = localidadesData.filter(localidad => {
        return localidad.partido === municipioNombre || 
               localidad.partido_ig === municipioNombre;
    });
    
    layerGroups.localidades.clearLayers();
    if (localidadesEnMunicipio.length > 0) {
        renderDataToLayer('localidades', localidadesEnMunicipio);
    }
    
    // 5. Hacer zoom al municipio
    if (municipio.geom) {
        zoomToGeometry(municipio.geom);
    }
    
    // 6. CARGAR Y RENDERIZAR CALLES CON POSTGIS
    console.log('Cargando calles con PostGIS...');
    const callesFiltradas = await loadFilteredPostGIS('calles', 'municipio', municipioNombre);
    layerGroups.calles.clearLayers();
    if (callesFiltradas.length > 0) {
        renderDataToLayer('calles', callesFiltradas);
        if (!map.hasLayer(layerGroups.calles)) {
            layerGroups.calles.addTo(map);
        }
        console.log(`✓ ${callesFiltradas.length} calles cargadas`);
    } else {
        console.log('✗ No se encontraron calles');
        showStatus(`No se encontraron calles en ${municipioNombre}`, 'warning');
    }
    
    // 7. CARGAR Y RENDERIZAR RED DE GAS CON POSTGIS
    console.log('Cargando red de gas con PostGIS...');
    const redGasFiltrada = await loadFilteredPostGIS('red_de_gas', 'municipio', municipioNombre);
    layerGroups.red_de_gas.clearLayers();
    if (redGasFiltrada.length > 0) {
        // Usar estilo clasificado por diámetro
        renderRedGasWithDiameterClassification(redGasFiltrada);
        if (!map.hasLayer(layerGroups.red_de_gas)) {
            layerGroups.red_de_gas.addTo(map);
        }
        console.log(`✓ ${redGasFiltrada.length} elementos de red de gas cargados`);
    } else {
        console.log('✗ No se encontró red de gas');
        showStatus(`No se encontró red de gas en ${municipioNombre}`, 'warning');
    }
    
    // Ajustar vista si es necesario
    setTimeout(() => {
        fitViewToLayerGroup('municipios');
    }, 500);
    
    //updateElementList();
    
    // Mostrar resumen
    const summary = `${municipioNombre}: ${callesFiltradas.length} calles, ${redGasFiltrada.length} red gas`;
    showStatus(summary, 'success');
    
    console.log('Filtro municipio aplicado completamente con PostGIS');
}*/

// Aplicar filtro por localidad CON POSTGIS
async function applyLocalidadFilter() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    const localidadNombre = select.value;
    if (!localidadNombre) {
        showStatus('Seleccione una localidad', 'error');
        return;
    }
    // Resaltar filtro activo
    document.querySelectorAll('.filter-section').forEach(s => s.classList.remove('active-filter'));
    select.parentElement.classList.add('active-filter');

    await aplicarFiltroLocalidad(localidadNombre);
}

async function aplicarFiltroLocalidad(localidadNombre) {
    console.log('Aplicando filtro localidad con PostGIS...');

    const localidad = localidadesData.find(l => l.nombre === localidadNombre);
    if (!localidad) {
        showStatus('Localidad no encontrada', 'error');
        return;
    }

    currentFilter = {
        type: 'localidad',
        name: localidadNombre,
        data: localidad,
        geometry: localidad.geom,
        num_fimm: localidad.num_fimm ? [localidad.num_fimm] : []
    };

    showStatus(`Filtrando ${localidadNombre}...`, 'loading');

    // 1. Habilitar capas dependientes
    enableDependentLayers(localidadNombre);

    // 2. Renderizar solo la localidad seleccionada
    layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', [localidad], filteredStyle.localidades);
    if (!map.hasLayer(layerGroups.localidades)) layerGroups.localidades.addTo(map);
    const localidadesCheckbox = document.getElementById('layer-localidades');
    if (localidadesCheckbox) localidadesCheckbox.checked = true;

    // 3. Municipio padre: cargar pero apagado
    const municipioPadre = municipiosData.find(m => m.nam === localidad.partido || m.nam === localidad.partido_ig);
    layerGroups.municipios.clearLayers();
    if (municipioPadre) {
        renderDataToLayer('municipios', [municipioPadre], filteredStyle.municipios);
        if (map.hasLayer(layerGroups.municipios)) map.removeLayer(layerGroups.municipios);
        const municipiosCheckbox = document.getElementById('layer-municipios');
        if (municipiosCheckbox) { municipiosCheckbox.checked = false; municipiosCheckbox.disabled = false; }
    }

    // 4. Zoom a la localidad
    if (localidad.geom) zoomToGeometry(localidad.geom);

    // 5. Calles
    const callesFiltradas = await loadFilteredPostGIS('calles', 'localidad', localidadNombre);
    layerGroups.calles.clearLayers();
    if (callesFiltradas.length > 0) {
        renderDataToLayer('calles', callesFiltradas);
        if (!map.hasLayer(layerGroups.calles)) layerGroups.calles.addTo(map);
        console.log(`✓ ${callesFiltradas.length} calles cargadas`);
    }

    // 6. Red de gas
    const redGasFiltrada = await loadFilteredPostGIS('red_de_gas', 'localidad', localidadNombre);
    layerGroups.red_de_gas.clearLayers();
    if (redGasFiltrada.length > 0) {
        renderRedGasWithDiameterClassification(redGasFiltrada);
        if (!map.hasLayer(layerGroups.red_de_gas)) layerGroups.red_de_gas.addTo(map);
        console.log(`✓ ${redGasFiltrada.length} red de gas cargada`);
    }

    // 7. Suministros
    const suministrosFiltrados = await loadFilteredPostGIS('suministros', 'localidad', localidadNombre);
    layerGroups.suministros.clearLayers();
    if (suministrosFiltrados.length > 0) {
        renderDataToLayer('suministros', suministrosFiltrados);
        if (!map.hasLayer(layerGroups.suministros)) layerGroups.suministros.addTo(map);
        console.log(`✓ ${suministrosFiltrados.length} suministros cargados`);
    }

    setTimeout(() => fitViewToLayerGroup('localidades'), 500);

    const summary = `${localidadNombre}: ${callesFiltradas.length} calles, ${redGasFiltrada.length} red gas, ${suministrosFiltrados.length} suministros`;
    showStatus(summary, 'success');
    console.log('Filtro localidad aplicado completamente');
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
    
    // Resaltar sección activa
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    selectUnidadRegional.closest('.filter-section').classList.add('active-filter');
    
    // Guardar filtro actual
    currentFilter = {
        type: 'unidad_regional',
        name: unidadRegional,
        num_fimm: []
    };
    
    // 1. Filtrar localidades por unidad regional
    const localidadesFiltradas = localidadesData.filter(l => l.unidad_regional === unidadRegional);
    
    if (localidadesFiltradas.length === 0) {
        showStatus(`No se encontraron localidades para ${unidadRegional}`, 'error');
        return;
    }
    
    console.log(`Localidades encontradas: ${localidadesFiltradas.length}`);
    currentFilter.num_fimm = localidadesFiltradas.map(l => l.num_fimm).filter(n => n != null);
    
    // 2. Limpiar y renderizar localidades filtradas
    layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', localidadesFiltradas, filteredStyle.localidades);
    if (!map.hasLayer(layerGroups.localidades)) {
        layerGroups.localidades.addTo(map);
    }
    const localidadesCheckbox = document.getElementById('layer-localidades');
    if (localidadesCheckbox) {
        localidadesCheckbox.checked = true;
        localidadesCheckbox.disabled = false;
    }
    
    // 3. Municipios: cargar pero APAGAR
    const municipiosUnicos = [...new Set(localidadesFiltradas.map(l => l.municipio))];
    const municipiosFiltrados = municipiosData.filter(m => municipiosUnicos.includes(m.municipio));
    layerGroups.municipios.clearLayers();
    if (municipiosFiltrados.length > 0) {
        renderDataToLayer('municipios', municipiosFiltrados, filteredStyle.municipios);
        if (map.hasLayer(layerGroups.municipios)) map.removeLayer(layerGroups.municipios);
        const municipiosCheckbox = document.getElementById('layer-municipios');
        if (municipiosCheckbox) municipiosCheckbox.checked = false;
    }
    
    // 4. Ajustar vista
    setTimeout(() => fitViewToLayerGroup('localidades'), 500);
    
    // 5. Habilitar labels de capas dependientes pero dejarlas APAGADAS
    habilitarCapasDependientesApagadas(unidadRegional);

    // 6. Cargar calles (en memoria, apagada)
    console.log('Cargando calles...');
    const callesUR = await loadFilteredPostGIS('calles', 'localidad', unidadRegional);
    layerGroups.calles.clearLayers();
    if (callesUR.length > 0) {
        renderDataToLayer('calles', callesUR);
        if (map.hasLayer(layerGroups.calles)) map.removeLayer(layerGroups.calles);
        console.log(`✓ ${callesUR.length} calles cargadas (apagadas)`);
    }

    // 7. Cargar red de gas (en memoria, apagada)
    console.log('Cargando red de gas...');
    const redGasUR = await loadFilteredPostGIS('red_de_gas', 'localidad', unidadRegional);
    layerGroups.red_de_gas.clearLayers();
    if (redGasUR.length > 0) {
        renderRedGasWithDiameterClassification(redGasUR);
        if (map.hasLayer(layerGroups.red_de_gas)) map.removeLayer(layerGroups.red_de_gas);
        // Ocultar botón de leyenda (capa apagada)
        document.getElementById('toggleLegendBtn').style.display = 'none';
        document.getElementById('legend').style.display = 'none';
        console.log(`✓ ${redGasUR.length} red de gas cargada (apagada)`);
    }

    // 8. Cargar suministros (en memoria, apagada)
    console.log('Cargando suministros...');
    const suministrosUR = await loadFilteredPostGIS('suministros', 'localidad', unidadRegional);
    layerGroups.suministros.clearLayers();
    if (suministrosUR.length > 0) {
        renderDataToLayer('suministros', suministrosUR);
        if (map.hasLayer(layerGroups.suministros)) map.removeLayer(layerGroups.suministros);
        console.log(`✓ ${suministrosUR.length} suministros cargados (apagados)`);
    }

    // 9. Mostrar lista de localidades en sidebar
    mostrarListaLocalidadesUR(localidadesFiltradas);
    
    showStatus(`${localidadesFiltradas.length} localidades en ${unidadRegional}`, 'success');
    console.log('Filtro por unidad regional aplicado');
}

// ===============================
// LIMPIAR FILTRO
// ===============================

// Habilitar capas dependientes con checkboxes DESMARCADOS (apagadas)
function habilitarCapasDependientesApagadas(filterName) {
    ['red_de_gas', 'calles', 'suministros'].forEach(capa => {
        const label = document.getElementById(`label-${capa}`);
        const nombres = { red_de_gas: 'Red de Gas', calles: 'Calles', suministros: 'Suministros' };
        if (label) {
            label.innerHTML = `
                <input type="checkbox" id="layer-${capa}" data-table="${capa}">
                ${nombres[capa]} (${filterName})
            `;
            const cb = document.getElementById(`layer-${capa}`);
            if (cb) cb.addEventListener('change', handleCheckboxChange);
        }
    });
}

// Mostrar lista de localidades de la unidad regional en el sidebar
function mostrarListaLocalidadesUR(localidades) {
    const container = document.getElementById('localidadesURContainer');
    const list      = document.getElementById('localidadesURList');
    if (!container || !list) return;

    list.innerHTML = '';
    localidades.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(loc => {
        const item = document.createElement('div');
        item.className = 'localidad-ur-item';
        item.textContent = loc.nombre || `Localidad ${loc.num_fimm}`;
        item.addEventListener('click', async () => {
            // Actualizar el select de área de servicio
            const selectLocalidad = document.getElementById('selectLocalidad');
            if (selectLocalidad) selectLocalidad.value = loc.nombre;
            // Aplicar el filtro completo de localidad
            await aplicarFiltroLocalidad(loc.nombre);
        });
        list.appendChild(item);
    });

    container.style.display = 'block';
}

// Limpiar filtro - Restaurar estado inicial
function clearFilter() {
    console.log('Limpiando filtro');
    
    currentFilter = null;
    
    // Limpiar selects
    //const selectMunicipio = document.getElementById('selectMunicipio');
    const selectLocalidad = document.getElementById('selectLocalidad');
    const selectUnidadRegional = document.getElementById('selectUnidadRegional');
    
    //if (selectMunicipio) selectMunicipio.value = '';
    if (selectLocalidad) selectLocalidad.value = '';
    if (selectUnidadRegional) selectUnidadRegional.value = '';
    
    // Remover resaltado
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    
    // Restaurar texto original de las etiquetas
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    const suministrosLabel = document.getElementById('label-suministros');
    
    if (redGasLabel) {
        redGasLabel.innerHTML = `
            <input type="checkbox" id="layer-red_de_gas" data-table="red_de_gas" disabled>
            Red de Gas (requiere filtro)
        `;
    }
    
    if (callesLabel) {
        callesLabel.innerHTML = `
            <input type="checkbox" id="layer-calles" data-table="calles" disabled>
            Calles (requiere filtro)
        `;
    }

    if (suministrosLabel) {
        suministrosLabel.innerHTML = `
            <input type="checkbox" id="layer-suministros" data-table="suministros" disabled>
            Suministros (requiere filtro)
        `;
    }
    
    // Desactivar checkboxes de calles, red de gas y suministros
    const redGasCheckbox = document.getElementById('layer-red_de_gas');
    const callesCheckbox = document.getElementById('layer-calles');
    const suministrosCheckbox = document.getElementById('layer-suministros');
    
    if (redGasCheckbox) {
        redGasCheckbox.checked = false;
        redGasCheckbox.disabled = true;
    }
    
    if (callesCheckbox) {
        callesCheckbox.checked = false;
        callesCheckbox.disabled = true;
    }

    if (suministrosCheckbox) {
        suministrosCheckbox.checked = false;
        suministrosCheckbox.disabled = true;
    }
    
    // Remover capas de calles, red de gas y suministros del mapa
    map.removeLayer(layerGroups.red_de_gas);
    map.removeLayer(layerGroups.calles);
    if (map.hasLayer(layerGroups.suministros)) {
        map.removeLayer(layerGroups.suministros);
    }
    
    // Limpiar capas de calles, red de gas y suministros
    layerGroups.red_de_gas.clearLayers();
    layerGroups.calles.clearLayers();
    layerGroups.suministros.clearLayers();
    
    // Limpiar arrays de datos
    callesData = [];
    redGasData = [];
    suministrosData = [];
    
    // Restaurar todas las capas de municipios y localidades
    if (municipiosData.length > 0) {
        renderDataToLayer('municipios', municipiosData);
    }
    if (localidadesData.length > 0) {
        renderDataToLayer('localidades', localidadesData);
    }
    
    // ==== AGREGAR: Asegurar que municipios esté visible y checkbox marcado ====
    if (!map.hasLayer(layerGroups.municipios)) {
    layerGroups.municipios.addTo(map);
    }

    // Marcar checkbox de municipios
    const municipiosCheckbox = document.getElementById('layer-municipios');
    if (municipiosCheckbox) {
    municipiosCheckbox.checked = true;
}
// ========================================================================

    // Ocultar leyenda
    document.getElementById('toggleLegendBtn').style.display = 'none';
    document.getElementById('legend').style.display = 'none';

    // Ocultar lista de localidades de unidad regional
    const localidadesURContainer = document.getElementById('localidadesURContainer');
    if (localidadesURContainer) {
        localidadesURContainer.style.display = 'none';
        document.getElementById('localidadesURList').innerHTML = '';
    }
    
    // Restaurar vista inicial
    map.setView([-36.14685, -60.28183], 6);
    
    // Actualizar lista
    //updateElementList();
    
    showStatus('Filtro limpiado', 'success');
    }

// ===============================
// FUNCIONES AUXILIARES
// ===============================

// Actualizar lista de elementos
/*function updateElementList() {
    const elementList = document.getElementById('elementList');
    if (!elementList) return;
    
    elementList.innerHTML = '';
    
    let totalElements = 0;
    
    for (const [name, group] of Object.entries(layerGroups)) {
        const count = group.getLayers().length;
        if (count > 0) {
            const item = document.createElement('div');
            item.className = 'element-item';
            
            let displayName = name.replace('_', ' ');
            
            // Personalizar nombres según el filtro
            if (currentFilter) {
                if (name === 'calles' || name === 'red_de_gas') {
                    displayName = `${displayName} (${currentFilter.name})`;
                } else if (name === 'municipios' && currentFilter.type === 'municipio') {
                    displayName = `Municipio (${currentFilter.name})`;
                } else if (name === 'localidades' && currentFilter.type === 'localidad') {
                    displayName = `Localidad (${currentFilter.name})`;
                }
            }
            
            item.textContent = `${displayName}: ${count} elementos`;
            item.onclick = () => {
                if (group.getLayers().length > 0) {
                    const bounds = getLayerGroupBounds(group);
                    if (bounds && bounds.isValid()) {
                        map.fitBounds(bounds.pad(0.1));
                    }
                }
            };
            elementList.appendChild(item);
            totalElements += count;
        }
    }
    
    if (totalElements === 0) {
        elementList.innerHTML = '<div style="padding: 10px; text-align: center; color: #999;">Sin elementos cargados</div>';
    }
}*/

// Manejar cambios en checkboxes
function handleCheckboxChange() {
    const tableName = this.dataset.table;
    const isChecked = this.checked;
    
    console.log(`Checkbox ${tableName}: ${isChecked ? 'activado' : 'desactivado'}`);
    
    if (isChecked) {
        if (!map.hasLayer(layerGroups[tableName])) {
            layerGroups[tableName].addTo(map);
        }
    } else {
        if (map.hasLayer(layerGroups[tableName])) {
            map.removeLayer(layerGroups[tableName]);
        }
    }

    // Mostrar/ocultar botón de leyenda según estado de red_de_gas
    if (tableName === 'red_de_gas') {
        const toggleBtn = document.getElementById('toggleLegendBtn');
        const legend    = document.getElementById('legend');
        if (isChecked) {
            toggleBtn.style.display = 'block';
        } else {
            toggleBtn.style.display = 'none';
            legend.style.display = 'none';
            toggleBtn.textContent = 'Mostrar Leyenda';
        }
    }
}
// ===============================
// EDICIÓN DE ESTADO EN SUPABASE
// ===============================

async function updateEstado(safeKey, medidor) {
    const select = document.getElementById(`estado-select-${safeKey}`);
    const msgDiv = document.getElementById(`popup-msg-${safeKey}`);
    if (!select || !msgDiv) return;

    const nuevoEstado = select.value;
    msgDiv.textContent = 'Guardando...';
    msgDiv.style.color = '#856404';

    try {
        const { error } = await supabaseClient
            .from('suministros')
            .update({ estado: nuevoEstado })
            .eq('medidor', parseInt(medidor, 10));

        if (error) throw error;

        // Actualizar en el array local
        const item = suministrosData.find(s => String(s.medidor) === String(medidor));
        if (item) item.estado = nuevoEstado;

        // Actualizar color del punto en el mapa
        actualizarColorPuntoByMedidor(medidor, nuevoEstado);

        msgDiv.textContent = '✓ Guardado correctamente';
        msgDiv.style.color = '#155724';

    } catch (err) {
        console.error('Error actualizando estado:', err);
        msgDiv.textContent = '✗ ' + (err.message || 'Error al guardar');
        msgDiv.style.color = '#721c24';
    }
}

function actualizarColorPuntoByMedidor(medidor, nuevoEstado) {
    const color = getColorByEstado(nuevoEstado);
    const borderColor = color === '#ffc107' ? '#cc9a00' : color === '#dc3545' ? '#a71d2a' : '#1a7a32';

    layerGroups.suministros.eachLayer(function(geoJsonLayer) {
        geoJsonLayer.eachLayer(function(circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.medidor) === String(medidor)) {
                circleLayer.setStyle({ fillColor: color, color: borderColor });
            }
        });
    });
}

// ===============================
// PANEL DE BÚSQUEDA
// ===============================

function initSearchPanel() {
    const toggleBtn = document.getElementById('toggleSearchBtn');
    const closeBtn  = document.getElementById('closeSearchBtn');
    const panel     = document.getElementById('searchPanel');
    const searchBtn = document.getElementById('searchBtn');
    const input     = document.getElementById('searchInput');

    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', () => panel.classList.toggle('open'));
    closeBtn.addEventListener('click',  () => panel.classList.remove('open'));
    searchBtn.addEventListener('click', buscarSuministro);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') buscarSuministro(); });
}

function buscarSuministro() {
    const campo      = document.getElementById('searchField').value;
    const texto      = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');

    if (!texto) {
        resultsDiv.innerHTML = '<div class="search-no-results">Ingresá un texto para buscar.</div>';
        return;
    }
    if (suministrosData.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Primero cargá los datos base.</div>';
        return;
    }

    // Todos los que coinciden con el texto
    const todoEncontrado = suministrosData.filter(s => {
        const valor = s[campo];
        return valor && String(valor).toLowerCase().includes(texto);
    });

    if (todoEncontrado.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Sin resultados.</div>';
        return;
    }

    // Si hay filtro activo, separar en "en esta localidad" y "en otra"
    let enFiltro = todoEncontrado;
    let enOtra   = [];

    if (currentFilter && currentFilter.num_fimm && currentFilter.num_fimm.length > 0) {
        const numFimms = currentFilter.num_fimm.map(String);
        enFiltro = todoEncontrado.filter(s => numFimms.includes(String(s.Localidad)));
        enOtra   = todoEncontrado.filter(s => !numFimms.includes(String(s.Localidad)));
    }

    resultsDiv.innerHTML = '';

    // Resultados en la localidad filtrada
    if (enFiltro.length > 0) {
        const mostrar = enFiltro.slice(0, 20);
        if (enFiltro.length > 20) {
            const aviso = document.createElement('div');
            aviso.className = 'search-no-results';
            aviso.textContent = `Mostrando 20 de ${enFiltro.length} resultados en ${currentFilter.name}.`;
            resultsDiv.appendChild(aviso);
        }
        mostrar.forEach(item => renderResultItem(item, resultsDiv));
    } else if (currentFilter && currentFilter.num_fimm && currentFilter.num_fimm.length > 0) {
        const aviso = document.createElement('div');
        aviso.className = 'search-no-results';
        aviso.textContent = `No se encontró en ${currentFilter.name}.`;
        resultsDiv.appendChild(aviso);
    }

    // Resultados en otras localidades
    if (enOtra.length > 0) {
        const separador = document.createElement('div');
        separador.style.cssText = 'font-size:11px; color:#856404; background:#fff3cd; padding:5px 8px; border-radius:3px; margin-top:6px;';
        separador.textContent = `⚠️ ${enOtra.length} resultado(s) encontrado(s) en otra localidad:`;
        resultsDiv.appendChild(separador);

        enOtra.slice(0, 5).forEach(item => {
            // Buscar nombre de la localidad
            const loc = localidadesData.find(l => String(l.num_fimm) === String(item.Localidad));
            renderResultItem(item, resultsDiv, loc ? loc.nombre : `Localidad ${item.Localidad}`);
        });
    }

    // Sin filtro activo — mostrar todo
    if (!currentFilter || !currentFilter.num_fimm || currentFilter.num_fimm.length === 0) {
        const mostrar = todoEncontrado.slice(0, 20);
        if (todoEncontrado.length > 20) {
            const aviso = document.createElement('div');
            aviso.className = 'search-no-results';
            aviso.textContent = `Mostrando 20 de ${todoEncontrado.length} resultados.`;
            resultsDiv.appendChild(aviso);
        }
        mostrar.forEach(item => renderResultItem(item, resultsDiv));
    }
}

function renderResultItem(item, container, otraLocalidad = null) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
        <div class="result-main">${item.Nombre || item.medidor || '-'}</div>
        <div class="result-sub">Medidor: ${item.medidor || '-'} | Estado: ${item.estado || '-'}</div>
        <div class="result-sub">${item.Direccion || ''}${otraLocalidad ? ` <em style="color:#856404">— ${otraLocalidad}</em>` : ''}</div>
    `;
    div.addEventListener('click', () => zoomASuministro(item));
    container.appendChild(div);
}

function zoomASuministro(item) {
    const geom = item.geom || item.wkt_geom || item.the_geom;
    if (!geom) return;

    let coords;
    if (typeof geom === 'object' && geom.coordinates) {
        coords = geom.coordinates;
    } else if (typeof geom === 'string') {
        const gj = wktToGeoJSON(geom);
        if (gj && gj.coordinates) coords = gj.coordinates;
    }

    if (!coords) return;

    const latlng = L.latLng(coords[1], coords[0]);
    map.setView(latlng, 17);

    // Buscar el layer, resaltarlo y abrir su popup
    layerGroups.suministros.eachLayer(function(geoJsonLayer) {
        geoJsonLayer.eachLayer(function(circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.medidor) === String(item.medidor)) {
                setTimeout(() => {
                    // Guardar estilo original
                    const colorOriginal = circleLayer.options.fillColor;
                    const borderOriginal = circleLayer.options.color;
                    const radioOriginal = circleLayer.options.radius;

                    // Aplicar estilo resaltado
                    circleLayer.setStyle({
                        fillColor: '#ffffff',
                        color: '#0000ff',
                        weight: 3,
                        radius: 10,
                        fillOpacity: 0.9
                    });
                    circleLayer.setRadius(10);

                    // Abrir popup
                    circleLayer.openPopup();

                    // Restaurar estilo original después de 2 segundos
                    setTimeout(() => {
                        circleLayer.setStyle({
                            fillColor: colorOriginal,
                            color: borderOriginal,
                            weight: 1,
                            fillOpacity: 0.85
                        });
                        circleLayer.setRadius(radioOriginal || 3);
                    }, 2000);

                }, 400);
            }
        });
    });

    document.getElementById('searchPanel').classList.remove('open');
}
