# Sonora · App de música gratis

Aplicación web para móvil (PWA) con la que puedes escuchar música **gratis y legal**.
Las canciones vienen de la API pública de [Audius](https://audius.co), una plataforma
donde artistas independientes publican su música para que se escuche libremente.
No hace falta registrarse ni ninguna clave de API.

## Funciones

- **Tendencias** de la semana, filtradas por género (Electrónica, Hip-Hop, Pop, Rock, Lo-Fi, Latina…).
- **Buscador** de canciones y artistas.
- **Favoritos**, que se guardan en el propio móvil.
- **Reproductor** con mini reproductor, pantalla completa, barra de progreso, anterior/siguiente,
  modo aleatorio y repetir.
- **Controles en la pantalla de bloqueo** y en las notificaciones (Media Session API).
- **Instalable** en el móvil como una app más (manifest + service worker).

## Cómo probarla

La app tiene que servirse desde un servidor web (no funciona abriendo el archivo con doble clic):

```bash
cd "PROYECTOPRACTICAS/APP MUSICA"
python3 -m http.server 8000
```

Abre `http://localhost:8000` en el navegador. Para verla en el móvil, conéctalo a la misma
red wifi y abre `http://IP-DE-TU-PC:8000`.

### Instalarla en el móvil

Para instalarla hace falta HTTPS. La forma más sencilla es activar **GitHub Pages** en el
repositorio (Settings → Pages → rama `main`) y abrir
`https://<usuario>.github.io/proyecto_practicas/PROYECTOPRACTICAS/APP%20MUSICA/`.

- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la app: vistas, reproductor y navegación |
| `styles.css` | Diseño oscuro adaptado al móvil |
| `app.js` | Lógica: llamadas a la API, listas, reproductor y favoritos |
| `manifest.json` | Datos para instalar la app (nombre, iconos, colores) |
| `sw.js` | Service worker: guarda la interfaz para que abra al instante |
| `icons/` | Iconos de la app |
