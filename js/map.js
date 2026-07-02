// Configuración del mapa Leaflet, estilos y renderizado de capas
import { state } from './state.js';
import { ARBA_WMS_URL, ARBA_WMS_LAYER } from './config.js';
import { wktToGeoJSON, getLayerGroupBounds, obtenerColorRuta, showStatus } from './utils.js';
import { 
    createMunicipioPopup, 
    createLocalidadPopup, 
    createSuministroPopup, 
    createCallesPopup, 
    createArbaPopup 
} from './popups.js';
import { initMeasureTools } from './measure.js';
import { discoverArbaLayer } from './db.js';

/**
 * Inicialización de la instancia de Leaflet y configuración de capas base
 */
export function initMap() {
    state.map = L.map('map').setView([-36.14685, -60.28183], 6);
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

    osmLayer.addTo(state.map);

    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satélite": satelliteLayer,
        "Google Híbrido": googleHybridLayer,
        "ArgenMap Gris": argenmapLayer
    };

    // Agregar control de zoom
    L.control.zoom({ position: 'topleft' }).addTo(state.map);

    // Agregar control de capas base
    L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(state.map);

    // Inicializar herramientas de medición en el mapa
    initMeasureTools();

    console.log('Capas base y controles agregados');

    // Copiar coordenadas con clic derecho
    state.map.on('contextmenu', function (e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        const coordText = `${lat}, ${lng}`;

        navigator.clipboard.writeText(coordText).then(() => {
            const popup = L.popup({ closeButton: false, className: 'coords-popup' })
                .setLatLng(e.latlng)
                .setContent(`📋 Copiado: <strong>${coordText}</strong>`)
                .openOn(state.map);

            setTimeout(() => { state.map.closePopup(popup); }, 2000);
        }).catch(() => {
            const popup = L.popup({ closeButton: true, className: 'coords-popup' })
                .setLatLng(e.latlng)
                .setContent(`📍 Coordenadas:<br><strong>${coordText}</strong>`)
                .openOn(state.map);
        });
    });
}

/**
 * Inicialización de los estilos geográficos estándar
 */
export function initStyles() {
    state.styles = {
        municipios: { color: 'rgba(255,255,255,0.18)', weight: 1.5, fillOpacity: 0.02, fillColor: '#ffffff', dashArray: '6 4', opacity: 1 },
        localidades: { color: '#00bcd4', weight: 1.8, fillOpacity: 0.07, fillColor: '#00bcd4', opacity: 1 },
        red_de_gas: { color: '#ff0000', weight: 2, opacity: 0.7 },
        calles: { color: '#333333', weight: 2, opacity: 0.6 },
        arba: { color: '#ffab00', weight: 0.9, fillOpacity: 0.09, fillColor: '#ffab00', opacity: 0.85 }
    };

    state.filteredStyle = {
        municipios: { color: 'rgba(255,255,255,0.18)', weight: 1.5, fillOpacity: 0.02, fillColor: '#ffffff', dashArray: '6 4', opacity: 1 },
        localidades: { color: '#00bcd4', weight: 1.8, fillOpacity: 0.07, fillColor: '#00bcd4', opacity: 1 }
    };
}

/**
 * Inicialización de los grupos de capas (LayerGroups) de Leaflet
 */
export function initLayerGroups() {
    state.layerGroups = {
        municipios: L.layerGroup().addTo(state.map),
        localidades: L.layerGroup().addTo(state.map),
        red_de_gas: L.layerGroup(),
        calles: L.layerGroup(),
        suministros: L.layerGroup(),
        arba: L.layerGroup(),
        arbaWMS: null
    };

    state.map.on('zoomend', function () {
        const zoom = state.map.getZoom();
        const radius = zoom >= 16 ? 6 : zoom >= 14 ? 5 : zoom >= 12 ? 4 : 3;
        if (state.layerGroups.suministros) {
            state.layerGroups.suministros.eachLayer(function (layer) {
                if (layer.eachLayer) {
                    layer.eachLayer(function (subLayer) {
                        if (subLayer.setRadius) subLayer.setRadius(radius);
                    });
                } else if (layer.setRadius) {
                    layer.setRadius(radius);
                }
            });
        }
    });
}

/**
 * Agrupa suministros con coordenadas casi idénticas (mismo lote/edificio)
 */
function detectarClusters(data, toleranciaMetros = 2.5) {
    const metrosPorGradoLat = 111320;
    const latMedia = -36;
    const metrosPorGradoLng = metrosPorGradoLat * Math.cos(latMedia * Math.PI / 180);

    const conCoords = data.map(item => {
        const itemGeometry = item.wkt_geom || item.geom || item.the_geom;
        let lat = null, lng = null;
        if (itemGeometry) {
            const gj = typeof itemGeometry === 'string' ? wktToGeoJSON(itemGeometry) : itemGeometry;
            const coords = gj?.coordinates || gj?.geometry?.coordinates;
            if (coords) { lng = coords[0]; lat = coords[1]; }
        }
        return { item, lat, lng };
    });

    const grupos = new Map();
    conCoords.forEach(entry => {
        if (entry.lat == null || entry.lng == null) return;
        const claveLat = Math.round(entry.lat / (toleranciaMetros / metrosPorGradoLat));
        const claveLng = Math.round(entry.lng / (toleranciaMetros / metrosPorGradoLng));
        const clave = `${claveLat}_${claveLng}`;
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(entry);
    });

    grupos.forEach(grupo => {
        if (grupo.length <= 1) return;
        const ordenados = grupo
            .map(e => e.item)
            .sort((a, b) => String(a.numero_cliente || '').localeCompare(String(b.numero_cliente || ''), undefined, { numeric: true }));

        const resumen = ordenados.map(it => ({
            numero_medidor: it.numero_medidor,
            numero_cliente: it.numero_cliente,
            cliente: it.cliente
        }));

        ordenados.forEach((it, idx) => {
            it._clusterMedidores = resumen;
            it._clusterIndex = idx;
            it._clusterSize = resumen.length;
        });
    });

    return data;
}
/**
 * Renderizado genérico de datos vectoriales en capas GeoJSON de Leaflet
 */
export function renderDataToLayer(tableName, data, style = null) {
    console.log(`Renderizando ${tableName} - ${data.length} elementos`);
    if (!state.layerGroups[tableName]) return 0;
    state.layerGroups[tableName].clearLayers();

    let featuresAdded = 0;

    let dataFinal = data;
    if (tableName === 'suministros') dataFinal = detectarClusters(data);

    dataFinal.forEach(item => {
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
                    style: tableName === 'suministros' ? null : (style || state.styles[tableName] || {}),
                    onEachFeature: (feature, layer) => {
                        let popupContent;
                        if (tableName === 'municipios') popupContent = createMunicipioPopup(item);
                        else if (tableName === 'localidades') popupContent = createLocalidadPopup(item);
                        else if (tableName === 'suministros') popupContent = createSuministroPopup(item);
                        else if (tableName === 'calles') popupContent = createCallesPopup(item);
                        else if (tableName === 'arba') popupContent = createArbaPopup(item);
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
                        let color = (tieneRuta && tieneOrden) ? obtenerColorRuta(String(ruta)) : '#3d4f5e';
                        const borderColor = (tieneRuta && tieneOrden) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
                        
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: color,
                            color: borderColor,
                            weight: 0.8,
                            opacity: 1,
                            fillOpacity: 0.92
                        });
                    };
                }

                const layer = L.geoJSON(geojson, layerOptions);
                state.layerGroups[tableName].addLayer(layer);
                featuresAdded++;
            } catch (e) {
                console.error('Error agregando geometría:', e);
            }
        }
    });

    console.log(`${tableName} - ${featuresAdded} elementos renderizados`);
    return featuresAdded;
}

/**
 * Centra y enfoca la vista del mapa en el LayerGroup indicado
 */
export function fitViewToLayerGroup(tableName) {
    try {
        if (!state.layerGroups[tableName]) return false;
        const bounds = getLayerGroupBounds(state.layerGroups[tableName]);
        if (bounds && bounds.isValid()) {
            state.map.fitBounds(bounds.pad(0.1));
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error ajustando vista a ${tableName}:`, error);
        return false;
    }
}

/**
 * Retorna el color correspondiente a un estado de contrato
 */
export function getColorByEstado(estado) {
    if (!estado) return '#28a745';
    const e = estado.trim().toLowerCase();
    if (e === 'cortado') return '#dc3545';
    if (e === 'anomalia' || e === 'anomalía') return '#ffc107';
    return '#28a745';
}

/**
 * Retorna el color correspondiente a un diámetro de cañería
 */
export function getColorByDiameter(diametro) {
    if (!diametro) return '#FFFFFF';
    const diametroNum = Number(diametro);
    if (diametroNum === 50) return '#f3a120';
    if (diametroNum === 63) return '#0e2eea';
    if (diametroNum === 90) return '#df0c0c';
    if (diametroNum === 125) return '#15960b';
    if (diametroNum === 180) return '#da21cb';
    return '#FFFFFF';
}

export function getDiameterClass(diametro) {
    if (!diametro) return 'diameter-other';
    const diametroNum = Number(diametro);
    if (diametroNum === 50) return 'diameter-50';
    if (diametroNum === 63) return 'diameter-63';
    if (diametroNum === 90) return 'diameter-90';
    if (diametroNum === 125) return 'diameter-125';
    if (diametroNum === 180) return 'diameter-180';
    return 'diameter-other';
}

/**
 * Renderizado de cañerías de gas clasificándolas por su diámetro Ø
 */
export function renderRedGasWithDiameterClassification(data) {
    console.log(`Renderizando red de gas con clasificación - ${data.length} elementos`);
    if (!state.layerGroups.red_de_gas) return 0;
    state.layerGroups.red_de_gas.clearLayers();

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
                state.layerGroups.red_de_gas.addLayer(layer);
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

/**
 * Crea e inicializa la capa TileLayer WMS de ARBA
 */
export function createArbaWMS(layerName) {
    try {
        if (!state.layerGroups.arbaWMS) {
            const ln = layerName || ARBA_WMS_LAYER;
            state.layerGroups.arbaWMS = L.tileLayer.wms(ARBA_WMS_URL, {
                layers: ln,
                format: 'image/png',
                transparent: true,
                version: '1.1.1',
                attribution: 'ARBA',
                opacity: 0.65,
                tiled: true
            });
            console.log('ARBA WMS creada (layer:', ln, ')');
        }
        return state.layerGroups.arbaWMS;
    } catch (err) {
        console.error('Error creando ARBA WMS:', err);
        return null;
    }
}

/**
 * Activa la capa WMS de ARBA y la añade al mapa en el LayerGroup
 */
export async function setArbaToWMS() {
    try {
        if (!state.layerGroups.arbaWMS) {
            let discovered = null;
            try {
                discovered = await discoverArbaLayer();
            } catch (e) {
                console.warn('No se pudo descubrir la capa ARBA:', e);
            }
            if (discovered) {
                createArbaWMS(discovered);
            } else {
                createArbaWMS(ARBA_WMS_LAYER);
            }
        }
        const wms = state.layerGroups.arbaWMS;
        if (!wms) return;
        
        state.layerGroups.arba.clearLayers();
        if (!state.layerGroups.arba.hasLayer(wms)) state.layerGroups.arba.addLayer(wms);
        if (!state.map.hasLayer(state.layerGroups.arba)) state.map.addLayer(state.layerGroups.arba);
        console.log('ARBA WMS añadida al mapa');
    } catch (e) {
        console.error('Error al activar ARBA WMS:', e);
    }
}

/**
 * Remueve la capa WMS de ARBA
 */
export function removeArbaWMS() {
    try {
        if (state.layerGroups.arbaWMS) {
            if (state.map.hasLayer(state.layerGroups.arbaWMS)) state.map.removeLayer(state.layerGroups.arbaWMS);
            if (state.layerGroups.arba.hasLayer(state.layerGroups.arbaWMS)) {
                state.layerGroups.arba.removeLayer(state.layerGroups.arbaWMS);
            }
            console.log('ARBA WMS removida');
        }
    } catch (e) {
        console.error('Error removiendo ARBA WMS:', e);
    }
}

/**
 * Manejador del cambio de checkbox de las capas disponibles en la UI
 */
export function handleCheckboxChange() {
    const tableName = this.dataset.table;
    const isChecked = this.checked;

    if (isChecked) {
        if (state.layerGroups[tableName] && !state.map.hasLayer(state.layerGroups[tableName])) {
            state.layerGroups[tableName].addTo(state.map);
        }
    } else {
        if (state.layerGroups[tableName] && state.map.hasLayer(state.layerGroups[tableName])) {
            state.map.removeLayer(state.layerGroups[tableName]);
        }
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
                toggleBtn.textContent = 'Referencias de diámetros';
            }
        }
    }
}

/**
 * Modifica el color de un marcador circular de suministro en base a su medidor
 */
export function actualizarColorPuntoByMedidor(medidor) {
    state.layerGroups.suministros.eachLayer(function (geoJsonLayer) {
        geoJsonLayer.eachLayer(function (circleLayer) {
            const props = circleLayer.feature && circleLayer.feature.properties;
            if (props && String(props.numero_medidor) === String(medidor)) {
                const ruta = props.ruta;
                const orden = props.orden;
                
                // Buscar si hay borrador local
                let rutaActual = ruta;
                let ordenActual = orden;
                if (state.suministrosBorradorMap && state.suministrosBorradorMap[medidor]) {
                    rutaActual = state.suministrosBorradorMap[medidor].ruta;
                    ordenActual = state.suministrosBorradorMap[medidor].orden;
                }

                const tieneRuta = rutaActual && rutaActual !== null && rutaActual !== '';
                const tieneOrden = ordenActual && ordenActual !== null && ordenActual !== 0;
                
                let color = (tieneRuta && tieneOrden) ? obtenerColorRuta(String(rutaActual)) : '#3d4f5e';
                const borderColor = (tieneRuta && tieneOrden) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
                circleLayer.setStyle({ fillColor: color, color: borderColor, weight: 0.8, fillOpacity: 0.92 });
            }
        });
    });
}
