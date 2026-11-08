# Sonora · App de música gratis

App para móvil con la que puedes escuchar música **gratis y legal**. Hay dos formas de usarla:
como **APK de Android** (`Sonora.apk`) o como web instalable (PWA).

Las canciones vienen de la API pública de [Audius](https://audius.co), una plataforma donde
artistas independientes publican su música para que se escuche libremente. No hace falta
registrarse ni ninguna clave.

## Funciones

- **Tendencias** de la semana, filtradas por género.
- **Buscador** de canciones y artistas.
- **Biblioteca**: favoritos y playlists importadas, guardados en el propio móvil.
- **Importar playlists de Spotify** (o una lista de texto o CSV) y escucharlas gratis.
- **Reproductor**: mini reproductor, pantalla completa, anterior/siguiente, aleatorio y repetir.
- Funciona el botón **atrás** de Android.

## Instalar la APK

1. Copia `Sonora.apk` al móvil (por cable, Drive, Telegram…) y ábrelo.
2. Android pedirá permiso para *instalar apps de origen desconocido*: acéptalo para esa app.
3. Necesitas Android 7 o superior.

Es una APK *debug* firmada con la clave de desarrollo: sirve para instalarla tú, pero no para
subirla a Google Play.

## Instalar en iPhone

Apple no permite instalar apps nativas sin pasar por la App Store, que exige un Mac y una
cuenta de desarrollador de pago. Por eso en iPhone Sonora se instala como **app web** desde Safari.
Queda con su icono en la pantalla de inicio y se abre a pantalla completa, como una app normal.

**1. Publicar la app (una sola vez).** Elige una opción:

- **Netlify Drop (lo más rápido, sin cuenta de GitHub):** entra en <https://app.netlify.com/drop>
  y arrastra el archivo `Sonora-web.zip`. Te dará una dirección del tipo `https://algo.netlify.app`.
- **GitHub Pages:** en el repositorio ve a *Settings → Pages → Source* y elige **GitHub Actions**.
  Cuando estos cambios lleguen a `main`, el flujo `.github/workflows/pages.yml` publica la app sola en
  `https://alejandrofernandez04.github.io/proyecto_practicas/`.

**2. Instalar en el iPhone:**

1. Abre esa dirección en **Safari** (en Chrome para iPhone no aparece la opción).
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elige **Añadir a pantalla de inicio** y luego **Añadir**.

Si conectas Spotify, en *Redirect URIs* añade la dirección que te muestra la app en
*Biblioteca → Importar* (por ejemplo `https://alejandrofernandez04.github.io/proyecto_practicas/`).

## Sincronizar con Spotify: cómo funciona y sus límites

Spotify **no permite** reproducir su música fuera de la app oficial, ni siquiera con su API.
Lo que hace Sonora es:

1. Leer de tu Spotify los **nombres** de las canciones de tus playlists (o de "Canciones que te gustan").
2. Buscar cada una en Audius.
3. Marcar el resultado:
   - Si la ha subido el propio artista, se reproduce sin más.
   - **VERSIÓN**: es un remix o cover de otro artista. Se indica cuál era la original.
   - Si no está, aparece en "no disponible gratis".

Ten en cuenta que en Audius hay sobre todo artistas independientes. Con artistas comerciales
(Queen, Rosalía, Daft Punk…) lo normal es encontrar **remixes y covers, no la canción original**.
Con música electrónica, lo-fi o artistas emergentes encontrará más originales.

El botón **Sincronizar** de una playlist vuelve a leerla de Spotify y solo busca las canciones nuevas.

### Configurar Spotify (una sola vez)

Spotify obliga a que cada app tenga su propio "Client ID":

1. Entra en <https://developer.spotify.com/dashboard> con tu cuenta y pulsa **Create app**.
   Spotify exige que esa cuenta sea **Premium** y deja que la usen hasta 5 cuentas.
2. En **Redirect URIs** añade:
   - Para la APK: `com.sonora.musica://callback`
   - Para la versión web: la dirección que muestra la app en *Biblioteca → Importar*.
     En tu PC tiene que ser `http://127.0.0.1:8000/` (Spotify no acepta `localhost`).
     En Internet tiene que ser HTTPS.
3. Marca **Web API** y guarda.
4. Copia el **Client ID** y pégalo en Sonora (*Biblioteca → Importar → Spotify*).

Si no quieres usar la API de Spotify, en la pestaña **Pegar lista / CSV** puedes escribir líneas
`Artista - Canción` o subir el CSV de tu playlist que genera gratis <https://exportify.app>.

## Probar la versión web

```bash
cd "PROYECTOPRACTICAS/APP MUSICA"
npm run serve        # abre http://127.0.0.1:8000
```

## Volver a generar la APK

Necesitas Node 22+, Java 21 y el SDK de Android (API 36).

```bash
cd "PROYECTOPRACTICAS/APP MUSICA"
npm install
npm run apk          # copia la web a Android y compila
# resultado: android/app/build/outputs/apk/debug/app-debug.apk
```

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `www/index.html` | Estructura: vistas, reproductor, ventana de importar |
| `www/styles.css` | Diseño oscuro adaptado al móvil |
| `www/app.js` | Lógica: Audius, listas, biblioteca, reproductor |
| `www/spotify.js` | Inicio de sesión con Spotify (OAuth PKCE) y lectura de playlists |
| `www/matcher.js` | Busca cada canción en Audius y decide si es original, versión o no está |
| `www/manifest.json`, `www/sw.js` | Instalación como PWA |
| `android/` | Proyecto Android generado con Capacitor |
| `capacitor.config.json` | Configuración de la app Android (id `com.sonora.musica`) |
| `Sonora.apk` | La app de Android lista para instalar |
| `Sonora-web.zip` | La versión web (para iPhone) lista para subir a Netlify Drop |
| `/.github/workflows/pages.yml` | Publica la versión web en GitHub Pages |
