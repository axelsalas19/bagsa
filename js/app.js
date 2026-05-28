// Orquestador principal e inicialización del Geoportal
import { state } from './state.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { showStatus } from './utils.js';
import { initMap, initStyles, initLayerGroups, handleCheckboxChange } from './map.js';
import { initSearchPanel } from './search.js';
import { loadBaseData } from './db.js';
import { 
    applyLocalidadFilter, 
    applyUnidadRegionalFilter, 
    applyProductoTurnoFilter, 
    clearFilter 
} from './filters.js';
import { descargarReporteCSV, descargarCallesCSV } from './export.js';

/**
 * Inicializador principal de la aplicación
 */
export function initApp() {
    try {
        // Inicializar cliente Supabase cargado globalmente en index.html
        const { createClient } = supabase;
        state.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase conectado');

        // Inicializar componentes del mapa y estilos
        initMap();
        initStyles();
        initLayerGroups();
        
        // Inicializar gestores de eventos y panel de búsquedas
        initEventListeners();
        initSearchPanel();

    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        showStatus('Error al inicializar: ' + error.message, 'error');
    }
}

/**
 * Registra todos los escuchadores de eventos globales (botones, selectores y formularios)
 */
export function initEventListeners() {
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.getElementById('sidebar');

    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.id = 'sidebarOverlay';
    document.body.appendChild(sidebarOverlay);

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            this.textContent = sidebar.classList.contains('active') ? '✕' : '☰';
            sidebarOverlay.classList.toggle('active');
        });
    }

    sidebarOverlay.addEventListener('click', function () {
        sidebar.classList.remove('active');
        if (mobileToggleBtn) mobileToggleBtn.textContent = '☰';
        sidebarOverlay.classList.remove('active');
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    const applyLocalidadFilterBtn = document.getElementById('applyLocalidadFilter');
    const applyUnidadRegionalFilterBtn = document.getElementById('applyUnidadRegionalFilter');
    const applyProductoTurnoFilterBtn = document.getElementById('applyProductoTurnoFilter');
    
    const clearLocalidadFilterBtn = document.getElementById('clearLocalidadFilter');
    const clearUnidadRegionalFilterBtn = document.getElementById('clearUnidadRegionalFilter');
    const clearProductoTurnoFilterBtn = document.getElementById('clearProductoTurnoFilter');
    
    const loadDataBtn = document.getElementById('loadDataBtn');
    const toggleLegendBtn = document.getElementById('toggleLegendBtn');

    if (applyLocalidadFilterBtn) applyLocalidadFilterBtn.addEventListener('click', applyLocalidadFilter);
    if (applyUnidadRegionalFilterBtn) applyUnidadRegionalFilterBtn.addEventListener('click', applyUnidadRegionalFilter);
    if (applyProductoTurnoFilterBtn) applyProductoTurnoFilterBtn.addEventListener('click', applyProductoTurnoFilter);
    
    if (clearLocalidadFilterBtn) clearLocalidadFilterBtn.addEventListener('click', clearFilter);
    if (clearUnidadRegionalFilterBtn) clearUnidadRegionalFilterBtn.addEventListener('click', clearFilter);
    if (clearProductoTurnoFilterBtn) clearProductoTurnoFilterBtn.addEventListener('click', clearFilter);

    if (loadDataBtn) {
        loadDataBtn.addEventListener('click', async function () {
            this.disabled = true;
            await loadBaseData();
            this.disabled = false;
        });
    }

    if (toggleLegendBtn) {
        toggleLegendBtn.addEventListener('click', function () {
            const legend = document.getElementById('legend');
            if (legend) {
                if (legend.style.display === 'block') {
                    legend.style.display = 'none';
                    this.textContent = 'Referencias de Diámetros';
                } else {
                    legend.style.display = 'block';
                    this.textContent = 'Ocultar Referencias';
                }
            }
        });
    }

    const downloadReportBtn = document.getElementById('downloadReportBtn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', descargarReporteCSV);
    }

    const downloadCallesBtn = document.getElementById('downloadCallesBtn');
    if (downloadCallesBtn) {
        downloadCallesBtn.addEventListener('click', descargarCallesCSV);
    }
}
