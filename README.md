# Dashboard Motor Termoacústico · UFV

Panel web para la **monitorización en tiempo real de un motor termoacústico**,
desarrollado como Proyecto Fin de Grado por **Ángela Sánchez Lozano** (UFV).

Los datos de los sensores de presión y de la potencia se recogen mediante una
placa conectada a **[Adafruit IO](https://io.adafruit.com/)** y se visualizan en
este dashboard con HTML, CSS y JavaScript puro, usando
[Chart.js](https://www.chartjs.org/) para las gráficas.

## Páginas

- **En directo** (`index.html`) — valores actuales de las dos presiones, gráficas
  en tiempo real y un gauge de potencia.
- **Historial** (`historial.html`) — sesiones de medición agrupadas por bloques de
  actividad, con gráficas detalladas y comparativas filtrables por tiempo.
- **Info** (`info.html`) — descripción del proyecto.

## Estructura

```
index.html        Página principal (en directo)
historial.html    Página de historial de sesiones
info.html         Información del proyecto
style.css         Estilos
config.js         Configuración (usuario y feeds de Adafruit IO)
app.js            Lógica del dashboard en directo
historial.js      Lógica del historial
motor.jpeg        Imagen del motor
```

## Configuración

Edita [`config.js`](config.js) para ajustar el usuario y los nombres de los feeds:

```js
const AIO_USERNAME = "tu_usuario";
const FEED_1 = "presion1";
const FEED_2 = "presion2";
const FEED_3 = "potencia";
```

> **Seguridad:** los feeds de Adafruit IO están en **modo público**, por lo que la
> web lee los datos **sin clave**. Como este código es estático y totalmente
> visible, **nunca** se debe incluir aquí la `AIO_KEY`.

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio.
2. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `root`**.
3. La web quedará disponible en `https://<usuario>.github.io/<repositorio>/`.
