// Módulo de Herramientas de Medición (Distancias y Áreas)
import { state } from './state.js';

/**
 * Inicializa los controles de medición en la esquina inferior izquierda
 */
export function initMeasureTools() {
    const MeasureControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control measure-control-container');
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            const btnDist = L.DomUtil.create('a', 'measure-btn', container);
            btnDist.id = 'measureDistBtn';
            btnDist.href = '#';
            btnDist.title = 'Medir Distancia';
            btnDist.innerHTML = '📏';
            L.DomEvent.on(btnDist, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                toggleMeasure('distance');
            });

            const btnArea = L.DomUtil.create('a', 'measure-btn', container);
            btnArea.id = 'measureAreaBtn';
            btnArea.href = '#';
            btnArea.title = 'Medir Área';
            btnArea.innerHTML = '📐';
            L.DomEvent.on(btnArea, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                toggleMeasure('area');
            });

            const btnClear = L.DomUtil.create('a', 'measure-btn measure-btn-clear', container);
            btnClear.id = 'measureClearBtn';
            btnClear.href = '#';
            btnClear.title = 'Limpiar Mediciones';
            btnClear.innerHTML = '🗑️';
            L.DomEvent.on(btnClear, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                clearMeasure();
            });

            return container;
        }
    });

    new MeasureControl().addTo(state.map);
    state.measureLayer = L.layerGroup().addTo(state.map);
}

/**
 * Alterna el modo de medición activo
 */
export function toggleMeasure(mode) {
    if (state.measureMode === mode) {
        stopMeasure();
        return;
    }

    clearMeasure();
    state.measureMode = mode;
    updateMeasureBtnState();
    state.map.getContainer().style.cursor = 'crosshair';
    state.map.doubleClickZoom.disable();
    state.map.closePopup();

    showMeasureTooltip(mode === 'distance'
        ? 'Clic para agregar puntos. Doble clic para finalizar.'
        : 'Clic para agregar vértices. Doble clic para cerrar el polígono.');

    state.measureClickHandler = function (e) {
        addMeasurePoint(e.latlng);
    };
    
    state.measureMouseMoveHandler = function (e) {
        if (state.measurePoints.length === 0) return;
        const pts = [...state.measurePoints, e.latlng];
        if (state.measureTempLine) {
            state.measureLayer.removeLayer(state.measureTempLine);
        }
        state.measureTempLine = L.polyline(pts, {
            interactive: false,
            color: '#f0a500',
            weight: 1.5,
            dashArray: '6 4',
            opacity: 0.8
        }).addTo(state.measureLayer);
    };

    state.map.on('click', state.measureClickHandler);
    state.map.on('mousemove', state.measureMouseMoveHandler);
    
    state.measureDblClickHandler = function (e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        finalizeMeasure();
    };
    state.map.on('dblclick', state.measureDblClickHandler);
}

/**
 * Agrega un nuevo vértice al trazo de medición actual
 */
export function addMeasurePoint(latlng) {
    state.measurePoints.push(latlng);
    const marker = L.circleMarker(latlng, {
        interactive: false,
        radius: 5,
        color: '#f0a500',
        fillColor: '#16213e',
        fillOpacity: 1,
        weight: 2
    }).addTo(state.measureLayer);
    state.measureLabels.push(marker);

    if (state.measurePoints.length > 1) {
        if (state.measurePolyline) state.measureLayer.removeLayer(state.measurePolyline);
        state.measurePolyline = L.polyline(state.measurePoints, {
            interactive: false,
            color: '#f0a500',
            weight: 2.5,
            opacity: 0.95
        }).addTo(state.measureLayer);
    }

    if (state.measureMode === 'area' && state.measurePoints.length >= 3) {
        if (state.measurePolygon) state.measureLayer.removeLayer(state.measurePolygon);
        state.measurePolygon = L.polygon(state.measurePoints, {
            interactive: false,
            color: '#f0a500',
            fillColor: '#f0a500',
            fillOpacity: 0.12,
            weight: 2
        }).addTo(state.measureLayer);
    }

    if (state.measureMode === 'distance') {
        const totalDist = calcTotalDistance(state.measurePoints);
        showMeasureTooltip(`Distancia: <strong>${formatDistance(totalDist)}</strong> — Doble clic para finalizar`);
    } else if (state.measureMode === 'area' && state.measurePoints.length >= 3) {
        const area = calcArea(state.measurePoints);
        showMeasureTooltip(`Área parcial: <strong>${formatArea(area)}</strong> — Doble clic para cerrar`);
    }
}

/**
 * Finaliza la medición actual y dibuja la geometría final con el popup de resultados
 */
export function finalizeMeasure() {
    if (state.measurePoints.length < 2) {
        stopMeasure();
        return;
    }

    const activeMode = state.measureMode;
    if (state.measureTempLine) {
        state.measureLayer.removeLayer(state.measureTempLine);
        state.measureTempLine = null;
    }

    if (state.measureClickHandler) state.map.off('click', state.measureClickHandler);
    if (state.measureMouseMoveHandler) state.map.off('mousemove', state.measureMouseMoveHandler);
    if (state.measureDblClickHandler) {
        state.map.off('dblclick', state.measureDblClickHandler);
        state.measureDblClickHandler = null;
    }

    state.map.getContainer().style.cursor = '';
    state.map.doubleClickZoom.enable();
    state.measureMode = null;
    updateMeasureBtnState();

    let resultText = '';
    if (activeMode === 'area' && state.measurePoints.length >= 3) {
        if (state.measurePolygon) state.measureLayer.removeLayer(state.measurePolygon);
        state.measurePolygon = L.polygon(state.measurePoints, {
            color: '#f0a500',
            fillColor: '#f0a500',
            fillOpacity: 0.15,
            weight: 2
        }).addTo(state.measureLayer);
        const area = calcArea(state.measurePoints);
        const perimetro = calcTotalDistance([...state.measurePoints, state.measurePoints[0]]);
        resultText = `📐 Área: ${formatArea(area)}<br>🔁 Perímetro: ${formatDistance(perimetro)}`;
    } else {
        const totalDist = calcTotalDistance(state.measurePoints);
        resultText = `📏 Distancia total: ${formatDistance(totalDist)}`;
    }

    const lastPt = state.measurePoints[state.measurePoints.length - 1];
    L.popup({ className: 'measure-result-popup', closeButton: true, autoClose: false, closeOnClick: false })
        .setLatLng(lastPt)
        .setContent(`<div class="measure-popup-content">${resultText}</div>`)
        .addTo(state.measureLayer)
        .openOn(state.map);

    hideMeasureTooltip();
}

/**
 * Desactiva y detiene el modo de medición
 */
export function stopMeasure() {
    if (state.measureClickHandler) state.map.off('click', state.measureClickHandler);
    if (state.measureMouseMoveHandler) state.map.off('mousemove', state.measureMouseMoveHandler);
    if (state.measureDblClickHandler) {
        state.map.off('dblclick', state.measureDblClickHandler);
        state.measureDblClickHandler = null;
    }
    if (state.measureTempLine) { 
        state.measureLayer.removeLayer(state.measureTempLine); 
        state.measureTempLine = null; 
    }
    state.map.getContainer().style.cursor = '';
    state.map.doubleClickZoom.enable();
    state.measureMode = null;
    updateMeasureBtnState();
    hideMeasureTooltip();
}

/**
 * Limpia todos los trazos y mediciones activos en el mapa
 */
export function clearMeasure() {
    stopMeasure();
    state.measurePoints = [];
    state.measureLabels = [];
    if (state.measureLayer) state.measureLayer.clearLayers();
    state.measurePolyline = null;
    state.measurePolygon = null;
    state.measureTempLine = null;
    hideMeasureTooltip();
}

export function updateMeasureBtnState() {
    const btnDist = document.getElementById('measureDistBtn');
    const btnArea = document.getElementById('measureAreaBtn');
    if (btnDist) btnDist.classList.toggle('active', state.measureMode === 'distance');
    if (btnArea) btnArea.classList.toggle('active', state.measureMode === 'area');
}

export function showMeasureTooltip(html) {
    let el = document.getElementById('measureTooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'measureTooltip';
        document.getElementById('map').appendChild(el);
    }
    el.innerHTML = html;
    el.style.display = 'block';
}

export function hideMeasureTooltip() {
    const el = document.getElementById('measureTooltip');
    if (el) el.style.display = 'none';
}

export function calcTotalDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += points[i - 1].distanceTo(points[i]);
    }
    return total;
}

export function calcArea(points) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const xi = toRad(points[i].lng) * R * Math.cos(toRad(points[i].lat));
        const yi = toRad(points[i].lat) * R;
        const xj = toRad(points[j].lng) * R * Math.cos(toRad(points[j].lat));
        const yj = toRad(points[j].lat) * R;
        area += xi * yj - xj * yi;
    }
    return Math.abs(area / 2);
}

export function formatDistance(meters) {
    if (meters >= 1000) {
        return (meters / 1000).toFixed(2) + ' km';
    }
    return meters.toFixed(1) + ' m';
}

export function formatArea(sqm) {
    if (sqm >= 1e6) {
        return (sqm / 1e6).toFixed(4) + ' km²';
    }
    if (sqm >= 10000) {
        return (sqm / 10000).toFixed(2) + ' ha';
    }
    return sqm.toFixed(1) + ' m²';
}
