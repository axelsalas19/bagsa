// Módulo de exportación y descargas CSV de datos (Reportes)
import { state } from './state.js';
import { showStatus } from './utils.js';

/**
 * Descarga en formato CSV todos los suministros filtrados en el área activa
 */
export function descargarReporteCSV() {
    if (!state.currentFilter || !state.currentFilter.num_fimm || state.currentFilter.num_fimm.length === 0) {
        showStatus('Aplique un filtro para descargar el reporte', 'error');
        return;
    }

    const suministrosFiltrados = state.suministrosData.filter(s => {
        if (!state.currentFilter) return true;
        if (state.currentFilter.type === 'localidad') return s.localidad === state.currentFilter.name;
        if (state.currentFilter.type === 'unidad_regional') {
            const _nombres = state.localidadesData.filter(l => l.unidad_regional === state.currentFilter.name).map(l => l.nombre);
            return _nombres.includes(s.localidad);
        }
        return true;
    });

    if (suministrosFiltrados.length === 0) {
        showStatus('No hay suministros para exportar en el área filtrada', 'warning');
        return;
    }

    // Definir columnas principales
    const keys = ['numero_medidor', 'numero_cliente', 'cliente', 'categoria', 'direccion', 'estado_contrato', 'estado_medidor', 'ruta', 'orden', 'localidad'];
    const allKeys = Object.keys(suministrosFiltrados[0]).filter(k => k !== 'geom' && k !== 'wkt_geom' && k !== 'the_geom');
    const finalKeys = [...new Set([...keys, ...allKeys])];

    const csvRows = [];
    csvRows.push(finalKeys.join(';'));

    for (const row of suministrosFiltrados) {
        const values = finalKeys.map(k => {
            let val = row[k];
            if (val === null || val === undefined) return '';
            let str = String(val).replace(/"/g, '""');
            if (str.includes(';') || str.includes('\n') || str.includes('"')) {
                str = `"${str}"`;
            }
            return str;
        });
        csvRows.push(values.join(';'));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filterNameStr = state.currentFilter.name ? state.currentFilter.name.replace(/\s+/g, '_') : 'filtrado';
    link.setAttribute("download", `Reporte_Suministros_${filterNameStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus('Reporte descargado', 'success');
}

/**
 * Descarga en formato CSV todas las calles del área de servicio activa sin duplicar nombres
 */
export function descargarCallesCSV() {
    if (!state.callesFiltradas || state.callesFiltradas.length === 0) {
        showStatus('No hay calles para exportar en el área filtrada', 'warning');
        return;
    }

    const keys = Object.keys(state.callesFiltradas[0]).filter(k => k !== 'geom' && k !== 'wkt_geom' && k !== 'the_geom');

    const csvRows = [];
    csvRows.push(keys.join(';'));

    const seenNames = new Set();
    const callesUnicas = state.callesFiltradas.filter(calle => {
        const name = calle.name ? String(calle.name).trim().toLowerCase() : '';
        if (seenNames.has(name)) {
            return false;
        }
        seenNames.add(name);
        return true;
    });

    for (const row of callesUnicas) {
        const values = keys.map(k => {
            let val = row[k];
            if (val === null || val === undefined) return '';
            let str = String(val).replace(/"/g, '""');
            if (str.includes(';') || str.includes('\n') || str.includes('"')) {
                str = `"${str}"`;
            }
            return str;
        });
        csvRows.push(values.join(';'));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filterNameStr = state.currentFilter && state.currentFilter.name ? state.currentFilter.name.replace(/\s+/g, '_') : 'filtrado';
    link.setAttribute("download", `Reporte_Calles_${filterNameStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus('Reporte de calles descargado', 'success');
}
