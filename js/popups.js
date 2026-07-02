// Generadores de popups HTML dinámicos para Leaflet
import { state } from './state.js';
import { getCopyBtn, obtenerColorRuta } from './utils.js';


export function createMunicipioPopup(properties) {
    let content = `<strong>Municipio</strong><br>`;
    if (properties.fna) content += `<strong>Nombre:</strong> ${properties.fna}<br>`;
    if (properties.zona_fria) content += `<strong>Zona Fría:</strong> ${properties.zona_fria}<br>`;
    if (properties.empre_distribu) content += `<strong>Empresa Distribuidora:</strong> ${properties.empre_distribu}<br>`;
    return content;
}

export function createSuministroPopup(properties) {
    const medidor = properties.numero_medidor || '';
    const safeKey = medidor.toString().replace(/[^a-zA-Z0-9]/g, '_');

    // Leer del borrador si existe
    let ruta = properties.ruta;
    let orden = properties.orden;
    let esBorrador = false;

    if (state.suministrosBorradorMap && state.suministrosBorradorMap[medidor]) {
        ruta = state.suministrosBorradorMap[medidor].ruta;
        orden = state.suministrosBorradorMap[medidor].orden;
        esBorrador = true;
    }

    const tieneRuta = ruta && ruta !== null && ruta !== '';
    const tieneOrden = orden && orden !== null && orden !== 0;

    let content = `<strong>Suministro</strong><br><hr style="margin:5px 0;">`;
    if (properties._clusterSize > 1) {
        const idx = (properties._clusterIndex ?? 0) + 1;
        content += `<div style="background:#3a2f1a; border-left:3px solid #ff9800; padding:5px 8px; margin-bottom:6px; font-size:11px; color:#ffcc80;">
            ⚠️ Hay <strong>${properties._clusterSize}</strong> suministros en esta dirección.
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px;">
                <button onclick="navegarClusterSuministro('${medidor}', -1)" style="background:#4a3a1f; border:1px solid #ff9800; color:#ffcc80; border-radius:3px; padding:2px 8px; cursor:pointer; font-size:11px;">◀ Anterior</button>
                <span style="font-weight:bold;">${idx} / ${properties._clusterSize}</span>
                <button onclick="navegarClusterSuministro('${medidor}', 1)" style="background:#4a3a1f; border:1px solid #ff9800; color:#ffcc80; border-radius:3px; padding:2px 8px; cursor:pointer; font-size:11px;">Siguiente ▶</button>
            </div>
        </div>`;
    }
    if (properties.numero_medidor) content += `<strong>Medidor:</strong> ${properties.numero_medidor}${getCopyBtn(properties.numero_medidor, 'Medidor')}${ properties.numero_cliente ? ` &nbsp;|&nbsp; <strong>Cliente N°:</strong> ${properties.numero_cliente}${getCopyBtn(properties.numero_cliente, 'Num. Cliente')}` : ''}<br>`;
    if (properties.cliente) content += `<strong>Cliente:</strong> ${properties.cliente}${getCopyBtn(properties.cliente, 'Cliente')}<br>`;
    if (properties.categoria) content += `<strong>Categoría:</strong> ${properties.categoria}<br>`;
    if (properties.direccion) content += `<strong>Dirección:</strong> ${properties.direccion}${getCopyBtn(properties.direccion, 'Dirección')}<br>`;
    if (properties.Direccion) content += `<strong>Dirección:</strong> ${properties.Direccion}${getCopyBtn(properties.Direccion, 'Dirección')}<br>`;

    // Mostramos el estado de contrato en mayúsculas si existe, o el físico, o guion si no hay datos
    const estadoMostrado = properties.estado_contrato ? properties.estado_contrato.toUpperCase() : (properties.estado || '-');
    content += `<strong>Estado:</strong> ${estadoMostrado}<br>`;

    content += `<hr style="margin:8px 0; border-color:#ddd;">`;

    content += `<div id="info-ruta-orden-${safeKey}">`;
    if (tieneRuta && (orden !== null && orden !== '')) {
        const colorRuta = obtenerColorRuta(String(ruta));
        const lblRuta = esBorrador ? 'Ruta (Borrador):' : 'Ruta actual:';
        content += `<strong>${lblRuta}</strong> <span style="color:${colorRuta}; font-weight:bold;">${ruta}</span> | <strong>Orden:</strong> <span style="color:#CCCCCC; font-weight:bold;">${orden}</span><br>`;
    } else {
        content += `<strong>Ruta:</strong> <span style="color:#ff9800;">No asignada</span> | <strong>Orden:</strong> <span style="color:#ff9800;">No asignado</span><br>`;
    }
    content += `</div>`;

    content += `
        <div style="display:flex; gap:5px; margin-top:5px;">
            <div style="flex:1;">
                <label for="ruta-input-${safeKey}" style="font-size:11px; color:#555;">Nueva Ruta:</label>
                <input type="text" id="ruta-input-${safeKey}" value="${ruta || ''}" style="width:100%; padding:4px; box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label for="orden-input-${safeKey}" style="font-size:11px; color:#555;">Nuevo Orden:</label>
                <input type="number" id="orden-input-${safeKey}" value="${orden || ''}" min="1" style="width:100%; padding:4px; box-sizing:border-box;">
            </div>
        </div>
        <button class="popup-save-btn" onclick="updateRutaOrden('${safeKey}', '${medidor}')" style="width:100%; margin-top:5px;">💾 Guardar</button>
        <div id="popup-msg-ruta-${safeKey}" style="margin-top:5px; font-size:12px;"></div>
        
        <hr style="margin:8px 0; border-color:#ddd;">
        <label for="estado-select-${safeKey}" style="font-weight:bold;">Cambiar estado:</label>
        <select id="estado-select-${safeKey}" style="margin:5px 0; padding:5px; width:100%;">
            <option value="activo" ${properties.estado_contrato === 'activo' ? 'selected' : ''}>🟢 Activo</option>
            <option value="suspendido" ${properties.estado_contrato === 'suspendido' ? 'selected' : ''}>🔴 Suspendido</option>
            <option value="baja" ${properties.estado_contrato === 'baja' ? 'selected' : ''}>🟡 Baja</option>
        </select>
        <button class="popup-save-btn" onclick="updateEstado('${safeKey}', '${medidor}')" style="width:100%;">💾 Guardar Estado</button>
        <div id="popup-msg-${safeKey}" style="margin-top:5px; font-size:12px;"></div>
    `;
    return content;
}

export function createCallesPopup(properties) {
    let content = `<strong>Calle</strong><br>`;
    if (properties.name) content += `<strong>Nombre:</strong> ${properties.name}<br>`;
    if (properties.fclass) content += `<strong>Tipo:</strong> ${properties.fclass}<br>`;
    return content;
}

export function createArbaPopup(properties) {
    let content = `<strong>🏠 Parcela</strong><br><hr style="margin:5px 0;">`;
    if (properties.localidad) content += `<strong>Localidad:</strong> ${properties.localidad}<br>`;
    if (properties.partida_) content += `<strong>Partida:</strong> ${properties.partida_}<br>`;
    return content;
}

export function createLocalidadPopup(properties) {
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
