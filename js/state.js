// Estado global compartido de la aplicación

export const state = {
    supabaseClient: null,
    municipiosData: [],
    localidadesData: [],
    callesData: [],
    redGasData: [],
    suministrosData: [],       // Cache completo — nunca se limpia con clearFilter
    callesFiltradas: [],      // Calles de la localidad activa (para búsqueda)
    arbaData: [],              // Cache de capa ARBA
    arbaDatosFiltrados: [],   // Cache de parcelas filtradas
    currentFilter: null,
    map: null,
    layerGroups: {
        municipios: null,
        localidades: null,
        red_de_gas: null,
        calles: null,
        suministros: null,
        arba: null,
        arbaWMS: null
    },
    styles: null,
    filteredStyle: null,

    // Variables de medición
    measureMode: null,
    measurePoints: [],
    measureLayer: null,
    measurePolyline: null,
    measurePolygon: null,
    measureLabels: [],
    measureTempLine: null,
    measureClickHandler: null,
    measureMouseMoveHandler: null,
    measureDblClickHandler: null,

    // Variables de ruteo
    ruteoLayerGroup: null,       // Capa de rutas en el mapa
    ruteoSinAsignarLayer: null,   // Capa de puntos sin asignar
    suministrosConRuta: [],       // Suministros con ruta+orden completos
    suministrosSinRuta: [],       // Suministros sin ruta o sin orden
    borrador: [],                 // Cambios pendientes de confirmar
    suministrosBorradorMap: {},   // medidor → {ruta, orden} estado en borrador
    modoEdicion: false,           // true cuando el usuario está asignando puntos
    localidadFiltroActual: null,  // nombre de la localidad activa
    rutasVisibles: new Map(),     // Para controlar qué rutas están visibles
    capaRutasGroup: null          // Capa para las rutas visualizadas
};
