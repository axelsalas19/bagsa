// Punto de entrada principal (ES6 Module Entrypoint) del Geoportal
import { initApp } from './js/app.js';

// Esperar a que todo esté cargado e iniciar la aplicación
window.addEventListener('load', function () {
    console.log('Iniciando aplicación...');
    initApp();
});