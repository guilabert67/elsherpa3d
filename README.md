# Montañas de España en 3D

Dos páginas web, sin instalación y sin servidor propio:

| Página | Para qué sirve |
|---|---|
| `index.html` — **Visor 3D** | Cualquier sierra de España en 3D: relieve del IGN, ortofoto PNOA, mapas del IGN, senderos y nombres de cumbres y refugios. Catálogo de 43 sierras, buscador y botones para pasar a la zona de al lado. Carga tus rutas GPX, KML, KMZ o TCX. |
| `rutas.html` — **Rutas de montaña** | Planificador de rutas de senderismo, BTT y pistas que siguen caminos reales. Perfil de altitud coloreado por pendiente, desnivel, tiempo estimado, tipo de camino y avisos de validez (prohibido a bici, privado, dificultad T3 o más, escalones, rampas). Exporta en GPX para el GPS. |

Las dos están enlazadas: desde el planificador, «Ver en 3D» abre la ruta en el visor.

## Cómo se publica (GitHub Pages)

1. Sube estos ficheros a la rama `main` del repositorio.
2. En GitHub: **Settings › Pages › Build and deployment › Deploy from a branch › `main` / `(root)`**.
3. Al cabo de uno o dos minutos queda en `https://guilabert67.github.io/montanas-3d/`.

Sin paso de construcción: lo que hay en el repositorio es lo que se sirve.

## De dónde salen los datos

| Dato | Fuente | Licencia |
|---|---|---|
| Relieve (MDT 25 m y 5 m) | IGN, servicio WCS de IDEE (`servicios.idee.es/wcs-inspire/mdt`) | CC BY 4.0 |
| Ortofoto, mapa base y MTN | IGN/CNIG, servicios WMTS (`www.ign.es/wmts/...`) | CC BY 4.0 |
| Senderos, cumbres y refugios (visor) | OpenStreetMap, en teselas de OpenFreeMap | ODbL |
| Trazado de rutas (planificador) | BRouter (`brouter.de`) sobre OpenStreetMap | ODbL |
| Rutas señalizadas GR, PR y BTT | Waymarked Trails | CC BY-SA |
| OpenTopoMap (opcional) | opentopomap.org | CC BY-SA |
| Buscador | Nominatim (OpenStreetMap) | ODbL |
| Librerías | three.js, Leaflet, vector-tile y pbf, JSZip (desde jsdelivr) | MIT / BSD |

Todas las atribuciones se ven en pantalla.

## Privacidad

Las páginas no tienen servidor propio, no usan cookies y no guardan nada fuera del navegador. Piden
los datos directamente a los servicios de la tabla, que reciben la IP de quien visita la página,
como en cualquier visita web. Los ficheros de ruta se leen en el propio dispositivo. La posición
(«Mi posición») solo se usa en el navegador para centrar el mapa.

## Límites conocidos

- La validez de una ruta sale de lo que hay en OpenStreetMap. Puede faltar alguna prohibición o
  cierre, como las normas de un parque para bicis. Hay que comprobarlo en la web del espacio
  protegido.
- En los modos de bici, BRouter no informa de la dificultad técnica del sendero (escala SAC o MTB).
- El tiempo a pie se calcula con la norma DIN 33466: 4 km/h en llano, 300 m/h de subida y
  500 m/h de bajada, sumando el mayor de los dos tiempos y la mitad del menor. En bici, el tiempo
  es la estimación de BRouter. En los dos casos, sin contar paradas.
- El desnivel se cuenta con un umbral de 3 m, igual en el visor y en el planificador.
- Zonas de hasta 30 km de lado en el visor. El MDT de 5 m, solo hasta 8 km.
- Inspirado en «La Pedriza en 3D» (lapedrizaen3d.netlify.app). El código es propio, no está
  copiado de allí.
