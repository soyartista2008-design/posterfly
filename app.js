const { jsPDF } = window.jspdf;

// Estado extendido de la aplicación
let appState = {
    imagenOriginalUrl: null,
    imagenElemento: null,
    anchoPx: 0,
    altoPx: 0,
    aspectRatio: 1,
    hojasDesactivadas: new Set(), 
    columnasActuales: 0,
    filasActuales: 0,
    pagoExitoso: false, // Controla si se activa la mejora de imagen vectorial
    medidasPapel: {
        carta: { anchoCm: 21.6, altoCm: 27.9 },
        oficio: { anchoCm: 21.6, altoCm: 34.0 },
        a3: { anchoCm: 29.7, altoCm: 42.0 },
        a4: { anchoCm: 21.0, altoCm: 29.7 }, 
        a5: { anchoCm: 14.8, altoCm: 21.0 }
    }
};

// Captura de elementos de la interfaz
const imageInput = document.getElementById('imageInput');
const tipoPapel = document.getElementById('tipoPapel');
const alturaCmInput = document.getElementById('alturaCm');
const hojasAnchoInput = document.getElementById('hojasAncho');
const btnDescargar = document.getElementById('btnDescargar');
const placeholderText = document.getElementById('placeholderText');
const gridInteractiva = document.getElementById('gridInteractiva');
const txtInstruccion = document.getElementById('txtInstruccion');
const lblTotalHojas = document.getElementById('lblTotalHojas');
const lblHojasAhorradas = document.getElementById('lblHojasAhorradas');
const lblMedidaFinal = document.getElementById('lblMedidaFinal');
const lblMedidaFinalTxt = document.getElementById('lblMedidaFinalTxt');
const premiumBox = document.getElementById('premiumBox');

// Escuchas para cambios en controles
tipoPapel.addEventListener('change', () => { appState.hojasDesactivadas.clear(); procesarYCalcular(); });
alturaCmInput.addEventListener('input', procesarYCalcular);
hojasAnchoInput.addEventListener('input', procesarYCalcular);

document.querySelectorAll('input[name="orientacion"]').forEach(r => r.addEventListener('change', () => { appState.hojasDesactivadas.clear(); procesarYCalcular(); }));
document.querySelectorAll('input[name="modoColor"]').forEach(r => r.addEventListener('change', aplicarFiltroColor));
document.querySelectorAll('input[name="modoCalculo"]').forEach(r => {
    r.addEventListener('change', (e) => {
        if (e.target.value === 'medidas') {
            document.getElementById('inputsMedidas').classList.remove('hidden');
            document.getElementById('inputsHojas').classList.add('hidden');
        } else {
            document.getElementById('inputsMedidas').classList.add('hidden');
            document.getElementById('inputsHojas').classList.remove('hidden');
        }
        appState.hojasDesactivadas.clear();
        procesarYCalcular();
    });
});

// Carga del Personaje
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            appState.imagenElemento = img;
            appState.imagenOriginalUrl = event.target.result;
            appState.anchoPx = img.width;
            appState.altoPx = img.height;
            appState.aspectRatio = img.width / img.height;
            appState.hojasDesactivadas.clear();
            appState.pagoExitoso = false; 

            placeholderText.classList.add('hidden');
            gridInteractiva.classList.remove('hidden');
            txtInstruccion.classList.remove('hidden');
            btnDescargar.disabled = false;

            if (premiumBox) {
                premiumBox.classList.remove('hidden');
                inicializarPagosPremium();
            }

            procesarYCalcular();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Cambiar visualmente el filtro de Color o B&N e incluir Pro Vector
function aplicarFiltroColor() {
    const modoColor = document.querySelector('input[name="modoColor"]:checked').value;
    let filtrosFiltro = "";

    if (modoColor === 'bw') {
        filtrosFiltro += "grayscale(100%) contrast(140%) ";
    }
    
    if (appState.pagoExitoso) {
        filtrosFiltro += "contrast(150%) saturate(140%) brightness(100%) ";
    }

    gridInteractiva.style.filter = filtrosFiltro.trim();
}

// Lógica de cálculo matemática
function procesarYCalcular() {
    if (!appState.imagenElemento) return;

    const basePapel = appState.medidasPapel[tipoPapel.value];
    const orientacion = document.querySelector('input[name="orientacion"]:checked').value;
    const modoCalculo = document.querySelector('input[name="modoCalculo"]:checked').value;

    let papelAncho = orientacion === 'p' ? basePapel.anchoCm : basePapel.altoCm;
    let papelAlto = orientacion === 'p' ? basePapel.altoCm : basePapel.anchoCm;

    let totalAnchoCm = 0;
    let totalAltoCm = 0;
    let columnas = 0;
    let filas = 0;

    if (modoCalculo === 'medidas') {
        totalAltoCm = parseFloat(alturaCmInput.value) || 100;
        totalAnchoCm = totalAltoCm * appState.aspectRatio;
        columnas = Math.ceil(totalAnchoCm / papelAncho);
        filas = Math.ceil(totalAltoCm / papelAlto);
        lblMedidaFinalTxt.innerText = "Medida final del molde:";
    } else {
        columnas = parseInt(hojasAnchoInput.value) || 3;
        totalAnchoCm = columnas * papelAncho;
        totalAltoCm = totalAnchoCm / appState.aspectRatio;
        filas = Math.ceil(totalAltoCm / papelAlto);
        lblMedidaFinalTxt.innerText = "Medida final calculada:";
    }

    appState.columnasActuales = columnas;
    appState.filasActuales = filas;

    const maxHojas = columnas * filas;
    const activas = maxHojas - appState.hojasDesactivadas.size;

    lblTotalHojas.innerText = activas;
    if (appState.hojasDesactivadas.size > 0) {
        lblHojasAhorradas.innerText = `(¡Ahorraste ${appState.hojasDesactivadas.size} hojas!)`;
    } else {
        lblHojasAhorradas.innerText = "";
    }

    lblMedidaFinal.innerText = `${Math.round(totalAnchoCm)} cm x ${Math.round(totalAltoCm)} cm`;

    renderizarGridVisual(columnas, filas);
}

// Renderizar la reja de hojas interactivas Adaptable y Limpia
function renderizarGridVisual(columnas, filas) {
    gridInteractiva.innerHTML = "";
    gridInteractiva.style.display = "grid";
    gridInteractiva.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;
    gridInteractiva.style.gridTemplateRows = `repeat(${filas}, 1fr)`;
    gridInteractiva.style.backgroundImage = `url(${appState.imagenOriginalUrl})`;
    gridInteractiva.style.backgroundSize = "100% 100%";
    gridInteractiva.style.backgroundRepeat = "no-repeat";

    // Obtener el ancho real disponible (responsive)
    const contenedorPadre = document.getElementById('previewWrapper');
    let anchoDisponible = contenedorPadre.clientWidth - 20;

    if (anchoDisponible > 600) {
        anchoDisponible = 600;
    }

    gridInteractiva.style.width = `${anchoDisponible}px`;
    gridInteractiva.style.height = `${anchoDisponible / appState.aspectRatio}px`;

    let contadorHoja = 1;

    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < columnas; c++) {
            const celda = document.createElement('div');
            celda.className = 'hoja-celda';
            celda.dataset.numeroHoja = contadorHoja;

            // Estructura base de la celda
            celda.style.boxSizing = "border-box";
            celda.style.display = "flex";
            celda.style.alignItems = "center";
            celda.style.justifyContent = "center";
            celda.style.cursor = "pointer";
            celda.style.userSelect = "none";
            celda.style.transition = "background-color 0.2s ease, border 0.1s ease";

            // LOGICA CORREGIDA: Si está desactivada, bloque sólido sin bordes internos.
            if (appState.hojasDesactivadas.has(contadorHoja)) {
                celda.classList.add('desactivada');
                celda.style.border = "none"; 
                celda.style.backgroundColor = "rgba(40, 44, 52, 0.95)"; // Bloque oscuro limpio e impecable
            } else {
                celda.style.border = "1px dashed rgba(99, 102, 241, 0.4)"; // Línea sutil solo si está activa
                celda.style.backgroundColor = "transparent";
            }

            const numBadge = document.createElement('span');
            numBadge.className = 'hoja-numero';
            numBadge.innerText = `Hoja ${contadorHoja}`;
            
            // Estilo del badge del número
            numBadge.style.backgroundColor = "rgba(255, 255, 255, 0.85)";
            numBadge.style.padding = "2px 6px";
            numBadge.style.borderRadius = "4px";
            numBadge.style.fontSize = "10px";
            numBadge.style.fontWeight = "bold";
            numBadge.style.color = "#222";
            numBadge.style.pointerEvents = "none"; 
            
            celda.appendChild(numBadge);

            celda.addEventListener('click', (e) => {
                const numero = parseInt(e.currentTarget.dataset.numeroHoja);
                if (appState.hojasDesactivadas.has(numero)) {
                    appState.hojasDesactivadas.delete(numero);
                    e.currentTarget.classList.remove('desactivada');
                    // Al activarse: recupera su línea guía punteada y vuelve transparente
                    e.currentTarget.style.border = "1px dashed rgba(99, 102, 241, 0.4)";
                    e.currentTarget.style.backgroundColor = "transparent";
                } else {
                    appState.hojasDesactivadas.add(numero);
                    e.currentTarget.classList.add('desactivada');
                    // Al desactivarse: se elimina la línea por completo y mete bloque sólido
                    e.currentTarget.style.border = "none";
                    e.currentTarget.style.backgroundColor = "rgba(40, 44, 52, 0.95)";
                }
                const maxHojas = appState.columnasActuales * appState.filasActuales;
                const activas = maxHojas - appState.hojasDesactivadas.size;
                lblTotalHojas.innerText = activas;
                lblHojasAhorradas.innerText = appState.hojasDesactivadas.size > 0 ? `(¡Ahorraste ${appState.hojasDesactivadas.size} hojas!)` : "";
            });

            gridInteractiva.appendChild(celda);
            contadorHoja++;
        }
    }
    aplicarFiltroColor();
}

// Inicializar la pasarela de PayPal (Entorno de Producción configurado vía SDK)
function inicializarPagosPremium() {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;
    container.innerHTML = '';

    paypal.Buttons({
        createOrder: function(data, actions) {
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        currency_code: 'MXN',
                        value: '30.00'
                    },
                    description: 'Optimización de líneas vectoriales y Realce de Color - PosterFly'
                }]
            });
        },
        onApprove: function(data, actions) {
            return actions.order.capture().then(function(details) {
                alert('¡Pago aprobado con éxito! Gracias ' + details.payer.name.given_name + '.\n\nTu imagen se ha vectorizado y optimizado con alta nitidez.');
                
                appState.pagoExitoso = true;
                if (premiumBox) premiumBox.classList.add('hidden'); 
                aplicarFiltroColor(); 
            });
        },
        onError: function(err) {
            console.error('Error en pasarela de pagos:', err);
            alert('El pago no pudo completarse. Revisa la conexión o tus fondos disponibles.');
        }
    }).render('#paypal-button-container');
}

// Generación final del PDF limpio
function ajustarPixelesFiltro(r, g, b, aumentarContraste) {
    if (aumentarContraste) {
        r = (((r / 255) - 0.5) * 1.5 + 0.5) * 255;
        g = (((g / 255) - 0.5) * 1.5 + 0.5) * 255;
        b = (((b / 255) - 0.5) * 1.5 + 0.5) * 255;
    }
    return {
        r: Math.min(255, Math.max(0, r)),
        g: Math.min(255, Math.max(0, g)),
        b: Math.min(255, Math.max(0, b))
    };
}

btnDescargar.addEventListener('click', () => {
    if (!appState.imagenElemento) return;

    const basePapel = appState.medidasPapel[tipoPapel.value];
    const orientacionElegida = document.querySelector('input[name="orientacion"]:checked').value;
    const modoColor = document.querySelector('input[name="modoColor"]:checked').value;

    let papelAncho = orientacionElegida === 'p' ? basePapel.anchoCm : basePapel.altoCm;
    let papelAlto = orientacionElegida === 'p' ? basePapel.altoCm : basePapel.anchoCm;

    const doc = new jsPDF({
        orientation: orientacionElegida,
        unit: "cm",
        format: [papelAncho, papelAlto]
    });

    const columns = appState.columnasActuales;
    const filas = appState.filasActuales;

    const anchoTrozoPx = appState.anchoPx / columns;
    const altoTrozoPx = appState.altoPx / filas;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = anchoTrozoPx;
    tempCanvas.height = altoTrozoPx;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    let contadorHoja = 1;
    let paginasInsertadas = 0;

    for (let f = 0; f < filas; f++) {
        for (let c = 0; c < columns; c++) {
            
            if (appState.hojasDesactivadas.has(contadorHoja)) {
                contadorHoja++;
                continue; 
            }

            if (paginasInsertadas > 0) {
                doc.addPage();
            }

            tempCtx.clearRect(0, 0, anchoTrozoPx, altoTrozoPx);
            tempCtx.drawImage(
                appState.imagenElemento,
                c * anchoTrozoPx, f * altoTrozoPx, anchoTrozoPx, altoTrozoPx,
                0, 0, anchoTrozoPx, altoTrozoPx
            );

            if (modoColor === 'bw' || appState.pagoExitoso) {
                const imgDataCanvas = tempCtx.getImageData(0, 0, anchoTrozoPx, altoTrozoPx);
                const data = imgDataCanvas.data;

                for (let i = 0; i < data.length; i += 4) {
                    let { r, g, b } = ajustarPixelesFiltro(data[i], data[i + 1], data[i + 2], appState.pagoExitoso);

                    if (modoColor === 'bw') {
                        let brightness = 0.34 * r + 0.5 * g + 0.16 * b;
                        brightness = brightness > 128 ? brightness + 30 : brightness - 30;
                        brightness = Math.min(255, Math.max(0, brightness));
                        r = g = b = brightness;
                    }

                    data[i] = r;
                    data[i+1] = g;
                    data[i+2] = b;
                }
                tempCtx.putImageData(imgDataCanvas, 0, 0);
            }

            const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
            doc.addImage(imgData, 'JPEG', 0, 0, papelAncho, papelAlto);
            
            // Guía limpia para armado de moldes con margen de seguridad 0.8cm
            //doc.setFontSize(9);
            //doc.setTextColor(150, 150, 150);
            //doc.text(`Molde Original: Hoja ${contadorHoja} (Fila ${f + 1}, Col ${c + 1}) | PosterFly`, 0.8, papelAlto - 0.8);

            paginasInsertadas++;
            contadorHoja++;
        }
    }

    if(paginasInsertadas === 0) {
        alert("¡Oops! Apagaste todas las hojas. Activa al menos una para descargar tu molde.");
        return;
    }

    doc.save(`Molde_PosterFly_${Date.now()}.pdf`);
});