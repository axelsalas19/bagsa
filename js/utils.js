// Funciones auxiliares de geometría y utilidades generales del Geoportal
import { state } from './state.js';
import { RUTA_COLORES } from './config.js';

/**
 * Convierte un formato WKT a formato GeoJSON usando la librería Wicket
 */
export function wktToGeoJSON(wkt) {
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

/**
 * Genera un botón HTML para copiar información al portapapeles
 */
export function getCopyBtn(text, label) {
    if (!text) return '';
    const safeText = String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return ` <span style="cursor:pointer;" onclick="navigator.clipboard.writeText('${safeText}'); showStatus('${label} copiado', 'success');" title="Copiar ${label}">📋</span>`;
}

/**
 * Calcula los límites (bounds) geográficos de un LayerGroup de Leaflet
 */
export function getLayerGroupBounds(layerGroup) {
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

/**
 * Hace zoom en el mapa ajustando la vista a la geometría WKT provista
 */
export function zoomToGeometry(geometryWKT) {
    try {
        if (!geometryWKT) return;
        const geometryGeoJSON = wktToGeoJSON(geometryWKT);
        if (!geometryGeoJSON) return;
        const tempLayer = L.geoJSON(geometryGeoJSON);
        const bounds = tempLayer.getBounds();
        if (bounds && bounds.isValid() && state.map) {
            state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    } catch (error) {
        console.error('Error haciendo zoom:', error);
    }
}

/**
 * Obtiene el bounding box [minx, miny, maxx, maxy] desde un WKT/GeoJSON
 */
export function getBBoxFromWKT(wkt) {
    try {
        const geojson = wktToGeoJSON(wkt);
        if (!geojson) return null;
        let coords = [];
        if (geojson.type === 'Feature') coords = geojson.geometry.coordinates;
        else coords = geojson.coordinates || [];
        const pts = [];
        
        function extract(a) {
            if (!a) return;
            if (typeof a[0] === 'number' && a.length >= 2) {
                pts.push(a);
            } else {
                a.forEach(extract);
            }
        }
        
        extract(coords);
        if (pts.length === 0) return null;
        let minx = pts[0][0], miny = pts[0][1], maxx = pts[0][0], maxy = pts[0][1];
        pts.forEach(p => {
            if (p[0] < minx) minx = p[0];
            if (p[1] < miny) miny = p[1];
            if (p[0] > maxx) maxx = p[0];
            if (p[1] > maxy) maxy = p[1];
        });
        return [minx, miny, maxx, maxy];
    } catch (e) {
        console.error('Error calculando bbox from WKT:', e);
        return null;
    }
}

/**
 * Muestra un estado de cargando/éxito/error en la UI
 */
export function showStatus(message, type) {
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

/**
 * Genera un color consistente basado en el hash de un nombre/número de ruta
 */
export function obtenerColorRuta(ruta) {
    let hash = 0;
    const str = String(ruta);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    const index = Math.abs(hash) % RUTA_COLORES.length;
    return RUTA_COLORES[index];
}

// Exponer en window para compatibilidad con llamadas inline onclick
window.showStatus = showStatus;
window.obtenerColorRuta = obtenerColorRuta;
