
// Incluye: Filtros por municipio y localidad con PostGIS + Clasificación por diámetro

// Variables globales
let supabaseClient;
let municipiosData = [];
let localidadesData = [];
let callesData = [];
let redGasData = [];
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
    
    const argenmapLayer = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/cartografia_base@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '&copy; <a href="https://www.ign.gob.ar/">IGN Argentina</a>',
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
        "ArgenMap": argenmapLayer
    };
    
    L.control.layers(baseMaps).addTo(map);
    
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
            color: '#ff5500',
            weight: 2,
            fillOpacity: 0.1,
            fillColor: '#f59745'
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
        calles: L.layerGroup()
    };
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
    // ===== FIN DEL CÓDIGO NUEVO =====
    // Inicializar event listeners para checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });
    
    // Event listeners para filtros
    document.getElementById('applyMunicipioFilter').addEventListener('click', applyMunicipioFilter);
    document.getElementById('applyLocalidadFilter').addEventListener('click', applyLocalidadFilter);
    document.getElementById('clearMunicipioFilter').addEventListener('click', clearFilter);
    document.getElementById('clearLocalidadFilter').addEventListener('click', clearFilter);
    
    // Botón para verificar tablas
    document.getElementById('checkTablesBtn').addEventListener('click', async function() {
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
    });
    
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

function createLocalidadPopup(properties) {
    let content = `<strong>Localidad</strong><br>`;
    if (properties.nombre) content += `<strong>Nombre localidad:</strong> ${properties.nombre}<br>`;
    if (properties.partido) content += `<strong>Partido:</strong> ${properties.partido}<br>`;
    if (properties.unidad_regional) content += `<strong>Unidad Regional:</strong> ${properties.unidad_regional}<br>`;
    if (properties.zona_fria) content += `<strong>Zona Fría:</strong> ${properties.zona_fria}<br>`;
    if (properties.num_fimm) content += `<strong>Núm. Localidad:</strong> ${properties.num_fimm}<br>`;
    if (properties.turno) content += `<strong>Turno:</strong> ${properties.turno}<br>`;
    if (properties.producto) content +=  `<strong>Tipo Producto: </strong> ${properties.producto}<br>`;
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
            geojson = typeof itemGeometry === 'string' ? 
                      wktToGeoJSON(itemGeometry) : itemGeometry;
        }
        
        if (geojson) {
            try {
                const layerStyle = style || styles[tableName] || {};
                const layer = L.geoJSON(geojson, {
        style: layerStyle,
        onEachFeature: (feature, layer) => {
        let popupContent;
        
        // Usar popup personalizado según la capa
        if (tableName === 'municipios') {
            popupContent = createMunicipioPopup(item);
        } else if (tableName === 'localidades') {
            popupContent = createLocalidadPopup(item);
        } else {
            // Para otras capas usar el popup genérico
            popupContent = createPopup(item, tableName);
        }
        
        layer.bindPopup(popupContent);
    }
        });
                
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
                    weight: 4, // Más grueso para mejor visibilidad
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
            }
            params = { municipio_name: filterValue };
            
        } else if (filterType === 'localidad') {
            if (tableName === 'calles') {
                functionName = 'get_streets_by_localidad';
            } else if (tableName === 'red_de_gas') {
                functionName = 'get_gas_network_by_localidad';
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
            .rpc(functionName, params);
        
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

async function loadBaseData() {
    try {
        console.log('Iniciando carga de datos base');
        
        // Cargar municipios
        municipiosData = await loadTableData('municipios', { limit: 200 });
        console.log('Municipios cargados:', municipiosData.length);
        
        if (municipiosData.length > 0) {
            // Renderizar municipios inicialmente
            renderDataToLayer('municipios', municipiosData);
            populateMunicipioSelect();
            enableMunicipioFilter();
            console.log('Filtro municipio habilitado');
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
        }
        
        // NO cargar calles y red de gas inicialmente - se cargarán con PostGIS
        console.log('Calles y red de gas se cargarán dinámicamente con PostGIS');
        
        console.log('Datos base cargados completamente');
        showStatus('Datos base cargados. Seleccione un filtro para ver calles y red de gas.', 'success');
        
    } catch (error) {
        console.error('Error cargando datos base:', error);
    }
}

// ===============================
// FUNCIONES PARA DROPDOWNS
// ===============================

// Poblar select de municipios
function populateMunicipioSelect() {
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
}

// Poblar select de localidades
function populateLocalidadSelect() {
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccione una localidad --</option>';
    
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
function enableMunicipioFilter() {
    const select = document.getElementById('selectMunicipio');
    const applyBtn = document.getElementById('applyMunicipioFilter');
    const clearBtn = document.getElementById('clearMunicipioFilter');
    
    if (select) select.disabled = false;
    if (applyBtn) applyBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
}

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
    
    // Asegurar que las capas estén en el mapa
    setTimeout(() => {
        if (!map.hasLayer(layerGroups.red_de_gas)) {
            layerGroups.red_de_gas.addTo(map);
        }
        if (!map.hasLayer(layerGroups.calles)) {
            layerGroups.calles.addTo(map);
        }
    }, 100);
}

// ===============================
// APLICAR FILTROS
// ===============================

// Aplicar filtro por municipio CON POSTGIS
async function applyMunicipioFilter() {
    console.log('Aplicando filtro municipio con PostGIS...');
    
    const select = document.getElementById('selectMunicipio');
    if (!select) return;
    
    const municipioNombre = select.value;
    
    if (!municipioNombre) {
        showStatus('Seleccione un municipio', 'error');
        return;
    }
    
    // Buscar municipio - usar 'nam' que es el campo real
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
    
    updateElementList();
    
    // Mostrar resumen
    const summary = `${municipioNombre}: ${callesFiltradas.length} calles, ${redGasFiltrada.length} red gas`;
    showStatus(summary, 'success');
    
    console.log('Filtro municipio aplicado completamente con PostGIS');
}

// Aplicar filtro por localidad CON POSTGIS
async function applyLocalidadFilter() {
    console.log('Aplicando filtro localidad con PostGIS...');
    
    const select = document.getElementById('selectLocalidad');
    if (!select) return;
    
    const localidadNombre = select.value;
    
    if (!localidadNombre) {
        showStatus('Seleccione una localidad', 'error');
        return;
    }
    
    // Buscar localidad
    const localidad = localidadesData.find(l => l.nombre === localidadNombre);
    
    if (!localidad) {
        showStatus('Localidad no encontrada', 'error');
        return;
    }
    
    currentFilter = {
        type: 'localidad',
        name: localidadNombre,
        data: localidad,
        geometry: localidad.geom
    };
    
    showStatus(`Filtrando ${localidadNombre} con PostGIS...`, 'loading');
    
    // Resaltar filtro activo
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    select.parentElement.classList.add('active-filter');
    
    // 1. Habilitar capas dependientes
    enableDependentLayers(localidadNombre);
    
    // 2. Activar checkboxes
    document.getElementById('layer-municipios').checked = true;
    document.getElementById('layer-localidades').checked = true;
    document.getElementById('layer-red_de_gas').checked = true;
    document.getElementById('layer-calles').checked = true;
    
    // 3. Renderizar solo la localidad seleccionada
    layerGroups.localidades.clearLayers();
    renderDataToLayer('localidades', [localidad], filteredStyle.localidades);
    
    // 4. Encontrar y renderizar municipio padre
    const municipioPadre = municipiosData.find(municipio => {
        return municipio.nam === localidad.partido || 
               municipio.nam === localidad.partido_ig;
    });
    
    if (municipioPadre) {
        layerGroups.municipios.clearLayers();
        renderDataToLayer('municipios', [municipioPadre]);
    } else {
        layerGroups.municipios.clearLayers();
    }
    
    // 5. Hacer zoom a la localidad
    if (localidad.geom) {
        zoomToGeometry(localidad.geom);
    }
    
    // 6. CARGAR Y RENDERIZAR CALLES CON POSTGIS (LOCALIDAD)
    console.log('Cargando calles de la localidad con PostGIS...');
    const callesFiltradas = await loadFilteredPostGIS('calles', 'localidad', localidadNombre);
    layerGroups.calles.clearLayers();
    if (callesFiltradas.length > 0) {
        renderDataToLayer('calles', callesFiltradas);
        if (!map.hasLayer(layerGroups.calles)) {
            layerGroups.calles.addTo(map);
        }
        console.log(`✓ ${callesFiltradas.length} calles cargadas`);
    } else {
        console.log('✗ No se encontraron calles en la localidad');
        showStatus(`No se encontraron calles en ${localidadNombre}`, 'warning');
    }
    
    // 7. CARGAR Y RENDERIZAR RED DE GAS CON POSTGIS (LOCALIDAD)
    console.log('Cargando red de gas de la localidad con PostGIS...');
    const redGasFiltrada = await loadFilteredPostGIS('red_de_gas', 'localidad', localidadNombre);
    layerGroups.red_de_gas.clearLayers();
    if (redGasFiltrada.length > 0) {
        // Usar estilo clasificado por diámetro
        renderRedGasWithDiameterClassification(redGasFiltrada);
        if (!map.hasLayer(layerGroups.red_de_gas)) {
            layerGroups.red_de_gas.addTo(map);
        }
        console.log(`✓ ${redGasFiltrada.length} elementos de red de gas cargados`);
    } else {
        console.log('✗ No se encontró red de gas en la localidad');
        showStatus(`No se encontró red de gas en ${localidadNombre}`, 'warning');
    }
    
    // Ajustar vista
    setTimeout(() => {
        fitViewToLayerGroup('localidades');
    }, 500);
    
    updateElementList();
    
    // Mostrar resumen
    const summary = `${localidadNombre}: ${callesFiltradas.length} calles, ${redGasFiltrada.length} red gas`;
    showStatus(summary, 'success');
    
    console.log('Filtro localidad aplicado completamente con PostGIS');
}

// ===============================
// LIMPIAR FILTRO
// ===============================

// Limpiar filtro - Restaurar estado inicial
function clearFilter() {
    console.log('Limpiando filtro');
    
    currentFilter = null;
    
    // Limpiar selects
    const selectMunicipio = document.getElementById('selectMunicipio');
    const selectLocalidad = document.getElementById('selectLocalidad');
    
    if (selectMunicipio) selectMunicipio.value = '';
    if (selectLocalidad) selectLocalidad.value = '';
    
    // Remover resaltado
    document.querySelectorAll('.filter-section').forEach(section => {
        section.classList.remove('active-filter');
    });
    
    // Restaurar texto original de las etiquetas
    const redGasLabel = document.getElementById('label-red_de_gas');
    const callesLabel = document.getElementById('label-calles');
    
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
    
    // Desactivar checkboxes de calles y red de gas
    const redGasCheckbox = document.getElementById('layer-red_de_gas');
    const callesCheckbox = document.getElementById('layer-calles');
    
    if (redGasCheckbox) {
        redGasCheckbox.checked = false;
        redGasCheckbox.disabled = true;
    }
    
    if (callesCheckbox) {
        callesCheckbox.checked = false;
        callesCheckbox.disabled = true;
    }
    
    // Remover capas de calles y red de gas del mapa
    map.removeLayer(layerGroups.red_de_gas);
    map.removeLayer(layerGroups.calles);
    
    // Limpiar capas de calles y red de gas
    layerGroups.red_de_gas.clearLayers();
    layerGroups.calles.clearLayers();
    
    // Limpiar arrays de datos
    callesData = [];
    redGasData = [];
    
    // Restaurar todas las capas de municipios y localidades
    if (municipiosData.length > 0) {
        renderDataToLayer('municipios', municipiosData);
    }
    if (localidadesData.length > 0) {
        renderDataToLayer('localidades', localidadesData);
    }
    
    // Ocultar leyenda
    document.getElementById('toggleLegendBtn').style.display = 'none';
    document.getElementById('legend').style.display = 'none';
    
    // Restaurar vista inicial
    map.setView([-36.14685, -60.28183], 6);
    
    // Actualizar lista
    updateElementList();
    
    showStatus('Filtro limpiado', 'success');
}

// ===============================
// FUNCIONES AUXILIARES
// ===============================

// Actualizar lista de elementos
function updateElementList() {
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
}

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
    
    updateElementList();
}