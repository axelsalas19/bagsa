// Módulo de KPIs e Indicadores estadísticos (Panel de Indicadores)
import { state } from './state.js';

/**
 * Inicialización del panel de indicadores en la UI
 */
export function initIndicadoresPanel() {
    const toggleBtn = document.getElementById('toggleIndicadoresBtn');
    const closeBtn = document.getElementById('closeIndicadoresBtn');
    const panel = document.getElementById('indicadoresPanel');
    if (!toggleBtn || !panel) return;
    
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) renderIndicadores();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('open'));
}

/**
 * Genera el reporte HTML estadístico del panel de KPIs
 */
export function renderIndicadores() {
    const content = document.getElementById('indicadoresContent');
    if (!content) return;

    // Determinar dataset activo (filtrado o global)
    let suministrosActivos = state.suministrosData;
    let localidadesActivas = state.localidadesData;
    let contextoLabel = 'Todos los datos';

    if (state.currentFilter) {
        if (state.currentFilter.type === 'localidad') {
            localidadesActivas = state.localidadesData.filter(l => l.nombre === state.currentFilter.name);
            suministrosActivos = state.suministrosData.filter(s => s.localidad === state.currentFilter.name);
        } else if (state.currentFilter.type === 'unidad_regional') {
            localidadesActivas = state.localidadesData.filter(l => l.unidad_regional === state.currentFilter.name);
            const nombresUR = localidadesActivas.map(l => l.nombre).filter(Boolean);
            suministrosActivos = state.suministrosData.filter(s => nombresUR.includes(s.localidad));
        } else if (state.currentFilter.num_fimm && state.currentFilter.num_fimm.length > 0) {
            const numFimmsStr = state.currentFilter.num_fimm.map(String);
            localidadesActivas = state.localidadesData.filter(l => numFimmsStr.includes(String(l.num_fimm)));
            const nombresLocalidad = localidadesActivas.map(l => l.nombre).filter(Boolean);
            suministrosActivos = state.suministrosData.filter(s => nombresLocalidad.includes(s.localidad));
        }
        contextoLabel = state.currentFilter.name;
    }

    if (state.suministrosData.length === 0 && state.localidadesData.length === 0) {
        content.innerHTML = '<p class="indicadores-hint">Cargue los datos base para ver los indicadores.</p>';
        return;
    }

    // KPIs globales
    const totalSuministros = suministrosActivos.length;
    const conectados = suministrosActivos.filter(s => (s.estado_contrato || '').toLowerCase() === 'activo').length;
    const cortados = suministrosActivos.filter(s => (s.estado_contrato || '').toLowerCase() === 'suspendido').length;
    const anomalias = suministrosActivos.filter(s => (s.estado_contrato || '').toLowerCase() === 'baja').length;
    const sinEstado = totalSuministros - conectados - cortados - anomalias;
    const conRuta = suministrosActivos.filter(s => s.ruta && s.ruta !== '' && s.orden && s.orden !== 0).length;
    const sinRuta = totalSuministros - conRuta;
    const totalAreas = localidadesActivas.length;

    // Suministros por área (top 8)
    const porArea = {};
    suministrosActivos.forEach(s => {
        const nombre = s.localidad || '?';
        porArea[nombre] = (porArea[nombre] || 0) + 1;
    });
    const topAreas = Object.entries(porArea).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxArea = topAreas.length > 0 ? topAreas[0][1] : 1;

    // Rutas únicas
    const rutasUnicas = new Set(suministrosActivos.filter(s => s.ruta && s.ruta !== '').map(s => String(s.ruta)));

    // Render HTML
    let html = `<p class="indicadores-ctx">Filtrado: <strong>${contextoLabel}</strong></p>`;

    // Cards KPI
    html += `<div class="kpi-cards">
        <div class="kpi-card azul"><div class="kpi-value">${totalSuministros.toLocaleString()}</div><div class="kpi-label">Total suministros</div></div>
        <div class="kpi-card verde"><div class="kpi-value">${conectados.toLocaleString()}</div><div class="kpi-label">Activos</div></div>
        <div class="kpi-card rojo"><div class="kpi-value">${cortados.toLocaleString()}</div><div class="kpi-label">Suspendidos</div></div>
        <div class="kpi-card naranja"><div class="kpi-value">${anomalias.toLocaleString()}</div><div class="kpi-label">Baja</div></div>
        <div class="kpi-card"><div class="kpi-value">${totalAreas}</div><div class="kpi-label">Áreas de servicio</div></div>
        <div class="kpi-card"><div class="kpi-value">${rutasUnicas.size}</div><div class="kpi-label">Rutas activas</div></div>
        <div class="kpi-card verde"><div class="kpi-value">${conRuta.toLocaleString()}</div><div class="kpi-label">Con ruta asignada</div></div>
        <div class="kpi-card naranja"><div class="kpi-value">${sinRuta.toLocaleString()}</div><div class="kpi-label">Sin ruta asignada</div></div>
    </div>`;

    // Donut de estados (SVG puro)
    if (totalSuministros > 0) {
        const estadosData = [
            { label: 'Activo', valor: conectados, color: '#28a745' },
            { label: 'Suspendido', valor: cortados, color: '#dc3545' },
            { label: 'Baja', valor: anomalias, color: '#fd7e14' },
            { label: 'Sin dato', valor: sinEstado, color: '#adb5bd' }
        ].filter(d => d.valor > 0);

        html += `<div class="indicadores-section"><h4>Estado de suministros</h4>`;
        html += renderDonutSVG(estadosData, totalSuministros);
        html += `<div class="donut-leyenda">`;
        estadosData.forEach(d => {
            const pct = ((d.valor / totalSuministros) * 100).toFixed(1);
            html += `<div class="donut-leyenda-item"><div class="donut-color" style="background:${d.color}"></div>${d.label}: ${pct}%</div>`;
        });
        html += `</div></div>`;
    }

    // Cobertura de ruteo
    if (totalSuministros > 0) {
        const pctRuta = ((conRuta / totalSuministros) * 100).toFixed(1);
        html += `<div class="indicadores-section"><h4>Cobertura de ruteo</h4>
            <div class="bar-row">
                <div class="bar-label">Con ruta</div>
                <div class="bar-track"><div class="bar-fill verde" style="width:${pctRuta}%"></div></div>
                <div class="bar-count">${pctRuta}%</div>
            </div>
            <div class="bar-row">
                <div class="bar-label">Sin asignar</div>
                <div class="bar-track"><div class="bar-fill naranja" style="width:${(100 - pctRuta).toFixed(1)}%"></div></div>
                <div class="bar-count">${(100 - pctRuta).toFixed(1)}%</div>
            </div>
        </div>`;
    }

    // Top áreas de servicio
    if (topAreas.length > 1) {
        html += `<div class="indicadores-section"><h4>Suministros por área de servicio</h4>`;
        topAreas.forEach(([nombre, cant]) => {
            const pct = ((cant / maxArea) * 100).toFixed(0);
            html += `<div class="bar-row">
                <div class="bar-label" title="${nombre}">${nombre}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                <div class="bar-count">${cant}</div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
}

/**
 * Genera el markup SVG para el donut gráfico de distribución
 */
export function renderDonutSVG(data, total) {
    const size = 120, cx = 60, cy = 60, r = 46, ri = 28;
    let svgPath = '', startAngle = -Math.PI / 2;
    
    data.forEach(d => {
        const angle = (d.valor / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
        const xi1 = cx + ri * Math.cos(endAngle), yi1 = cy + ri * Math.sin(endAngle);
        const xi2 = cx + ri * Math.cos(startAngle), yi2 = cy + ri * Math.sin(startAngle);
        const large = angle > Math.PI ? 1 : 0;
        
        svgPath += `<path d="M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi1},${yi1} A${ri},${ri} 0 ${large},0 ${xi2},${yi2} Z" fill="${d.color}" stroke="white" stroke-width="1.5"/>`;
        startAngle = endAngle;
    });
    
    return `<svg id="donutEstados" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svgPath}<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${total}</text></svg>`;
}

/**
 * Actualiza el panel de KPIs si está abierto
 */
export function actualizarIndicadoresSiAbierto() {
    const panel = document.getElementById('indicadoresPanel');
    if (panel && panel.classList.contains('open')) renderIndicadores();
}
