# El Sherpa 3D

Montañas de España en 3D y rutas de senderismo y BTT. Web estática, sin servidor propio y sin instalación.

| Página | Para qué sirve |
|---|---|
| `index.html` — **Visor 3D** | Cualquier sierra de España en 3D con datos del IGN. Catálogo de 43 sierras, buscador y botones para pasar a la zona de al lado. |
| `rutas.html` — **Planificador** | Rutas de senderismo, BTT o pistas que siguen caminos reales, con perfil, dificultad técnica, avisos de validez y GPX para el GPS. |

## Qué hace el visor

1. **Tus actividades del Garmin**: eliges la carpeta del reloj (por ejemplo `Carpetas Garmin/Activity`) o ficheros sueltos FIT, GPX o TCX; se leen en tu dispositivo y se pintan sobre el relieve. «Ver las de esta zona» muestra todas las que pasan por ahí.
2. **Perfil de altitud** de la ruta elegida, coloreado por pendiente y con una franja de dificultad; al pasar el dedo, un punto amarillo avanza sobre el 3D.
3. **Sobrevolar la ruta**: la cámara recorre la ruta (velocidad ×1 a ×8).
4. **Dibujar una ruta** tocando el relieve: sigue caminos reales (BRouter), da distancia, desnivel, tiempo, dificultad y validez, y se descarga en GPX.
5. **Pendientes de más de 30°** (terreno de aludes): 30–35° amarillo, 35–40° naranja, 40–45° rojo, más de 45° morado.
6. **Sol real** para una fecha y hora, con las sombras que proyectan las montañas.
7. **Ficha de cumbre, collado o refugio** al tocar su nombre: altitud y tiempo previsto a esa altitud (Open-Meteo).
8. **Espacios protegidos** (límites y lista) y **rutas señalizadas GR, PR y BTT**.
9. **Sierras enteras**: zonas de 40, 50 y 60 km con relieve reducido; al acercarte se carga solo el detalle (10 km) de lo que tienes delante.
10. **Sin conexión e instalable**: lo que ves queda guardado en el dispositivo; «Guardar esta zona» la conserva para usarla sin cobertura. Se puede instalar en el móvil como una app.
11. **Dificultad técnica de todos los senderos** de la zona: coloreados por dificultad a pie (T1–T6) o BTT (S0–S5), resumen en kilómetros por nivel y ficha al tocar cada sendero (tipo, dificultad, firme, estado, si se permite la bici). En el planificador, lo mismo sobre el mapa, con el botón «Consultar un sendero».

Además: ortofoto PNOA, mapa base y MTN del IGN, OpenTopoMap, curvas de nivel, colores por altitud, exageración del relieve y enlace para compartir la vista.

## Cómo se publica (GitHub Pages)

1. Sube todos los ficheros a la rama `main` del repositorio `elsherpa3d`.
2. En GitHub: **Settings › Pages › Build and deployment › Deploy from a branch › `main` / `(root)`**.
3. Al cabo de uno o dos minutos queda en `https://guilabert67.github.io/elsherpa3d/`.

No hay paso de construcción: lo que hay en el repositorio es lo que se sirve. El modo sin conexión solo funciona publicado (https), no abriendo el fichero en el ordenador.

## Ficheros

| Fichero | Qué es |
|---|---|
| `index.html`, `visor.js` | Visor 3D |
| `rutas.html`, `rutas.js` | Planificador |
| `comun.js` | Todo lo que calcula cifras (distancia, desnivel, pendientes, tiempos, dificultad), común a las dos páginas para que den lo mismo; también el lector de ficheros FIT |
| `perfiles/*.brf` | Perfiles de BRouter con una línea añadida para que devuelva la dificultad de cada tramo (ver `perfiles/LEEME.txt`) |
| `sw.js`, `manifest.webmanifest`, `iconos/` | Uso sin conexión e instalación en el móvil |

## Cómo se calcula cada cifra

- **Distancia**: suma de distancias entre puntos.
- **Desnivel**: altitud del MDT de 25 m del IGN, contando solo cambios de al menos 3 m (igual en el visor y en el planificador). En actividades del reloj se enseña además lo que dice el reloj, que mide con barómetro y sale distinto.
- **Pendiente**: por tramos de 100 m.
- **Tiempo a pie**: norma DIN 33466: 4 km/h en llano, 300 m/h de subida y 500 m/h de bajada; el mayor de los dos tiempos más la mitad del menor. **En bici**: la estimación de BRouter. Siempre sin paradas.
- **Dificultad de senderos (escala SAC, T1–T6)**: la etiqueta `sac_scale` de OpenStreetMap.
- **Dificultad BTT (escala MTB, S0–S5)**: la etiqueta `mtb:scale` de OpenStreetMap cuando existe. Cuando falta, **se estima**, y se dice qué parte es estimada, con estas reglas fijas:
  - escalones → S4;
  - sendero con escala SAC → T1 = S1, T2 = S2, T3 = S3, T4 o más = S4 (o el nivel del firme, si es peor);
  - pista: tipo 1 a 3 → S0, tipo 4 y 5 → S1 (o el nivel del firme, si es peor);
  - sendero sin escala SAC, según el firme (`smoothness`): bueno → S0, intermedio o malo → S1, muy malo → S2, horrible → S3, muy horrible → S4, intransitable → S5; sin dato de firme → sin dato;
  - carretera o calle → S0.
- **Nivel de la ruta**: el más alto que suma al menos 100 m, para no calificar una ruta por un paso suelto. También se dice el máximo.
- **Pendientes para aludes**: se calculan sobre el relieve de 25 m, que suaviza las pendientes cortas: la realidad puede ser algo más empinada.
- **Sol**: posición con las fórmulas astronómicas habituales (error de unos 0,5°), con la hora del dispositivo. Las sombras se calculan con el relieve cargado; en el parche de detalle se tienen en cuenta también las montañas de alrededor.

## De dónde salen los datos

| Dato | Fuente | Licencia |
|---|---|---|
| Relieve (MDT 25 m y 5 m) | IGN, servicio WCS de IDEE | CC BY 4.0 |
| Ortofoto, mapa base y MTN | IGN/CNIG, WMTS | CC BY 4.0 |
| Cumbres, refugios y espacios protegidos | OpenStreetMap, en teselas de OpenFreeMap | ODbL |
| Senderos con su dificultad | OpenStreetMap: servidor Overpass de OpenStreetMap Francia; si no responde, Postpass de Geofabrik; luego Overpass de Alemania; si ninguno responde, teselas de OpenFreeMap sin dificultad | ODbL |
| Trazado de rutas y dificultad por tramo | BRouter (`brouter.de`) sobre OpenStreetMap | ODbL; perfiles con licencia MIT |
| Rutas señalizadas GR, PR y BTT | Waymarked Trails | CC BY-SA |
| Tiempo en cumbres | Open-Meteo | CC BY 4.0 |
| OpenTopoMap (opcional) | opentopomap.org | CC BY-SA |
| Buscador | Nominatim (OpenStreetMap) | ODbL |
| Librerías | three.js, Leaflet, vector-tile y pbf, JSZip (desde jsdelivr) | MIT / BSD |

Todas las atribuciones se ven en pantalla.

## Privacidad

Sin servidor propio y sin cookies. Las páginas piden los datos directamente a los servicios de la tabla, que reciben la IP de quien visita, como en cualquier visita web. Las rutas y actividades se leen en el propio dispositivo y no se envían a nadie; la única excepción son los puntos que marcas al dibujar o planificar una ruta, que van a BRouter para trazarla. La posición («Mi posición» del planificador) solo se usa en el navegador para centrar el mapa. Lo guardado para usar sin conexión queda en el navegador y se borra con «Borrar lo guardado».

## Límites conocidos

- La validez de una ruta sale de lo que hay en OpenStreetMap: puede faltar alguna prohibición o cierre (por ejemplo, normas de un parque para bicis). Compruébalo en la web del espacio protegido antes de salir.
- La dificultad de los senderos necesita conexión: sin cobertura se ven los senderos guardados, pero sin dificultad. El servidor Overpass principal de Alemania no responde desde la conexión de Emilio (comprobado el 14-11-2026); por eso se usa primero el de OpenStreetMap Francia.
- El navegador no puede leer la carpeta del Garmin por su cuenta: hay que elegirla cada vez.
- MDT de 5 m solo hasta 8 km de zona. En zonas de 40 a 60 km, relieve reducido y detalle solo alrededor del centro de la vista.
- Inspirado en «La Pedriza en 3D», que no es de Emilio. El código de este repositorio es propio y no está copiado de esa web.
