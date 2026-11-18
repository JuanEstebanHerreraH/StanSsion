# StanSsion

**Un espacio de audio y herramientas para estudiar, concentrarte y trabajar.**

Mezcla sonidos ambientales, escucha radio o tu propia música y organiza una sesión con temporizadores, notas y tareas.

**[Probar en el navegador](https://stan-ssion.vercel.app/) · [Descargar para Windows](https://github.com/JuanEstebanHerreraH/StanSsion/releases/download/Exe/StanSsion_0.1.0_x64-setup.exe) · [Reportar un problema](https://github.com/JuanEstebanHerreraH/StanSsion/issues)**

La web se usa sin cuenta. El instalador de Windows está publicado en [Releases](https://github.com/JuanEstebanHerreraH/StanSsion/releases/tag/Exe).

![StanSsion: panel de audio, ambiente, temporizador y eventos](https://github.com/user-attachments/assets/0f53690f-27a5-4e1e-8faf-135c42cdb938)

## Una sesión en tres pasos

1. Elige un sonido ambiente, una emisora o archivos de música propios.
2. Ajusta el volumen y configura el temporizador.
3. Usa el área de trabajo para dejar notas, tareas e imágenes de la sesión.

## Qué incluye

| Área | Funciones |
| --- | --- |
| Ambiente | Lluvia, bosque y otros sonidos; intensidad, velocidad y filtro. |
| Emisoras | Búsqueda por nombre, país o género; favoritas y listas con Radio Browser. |
| Música propia | Archivos MP3/WAV/FLAC, listas, búsqueda y reproducción aleatoria. |
| Temporizador | Presets y duración personalizada con aviso al terminar. |
| Área de trabajo | Lienzo con zoom, notas, tareas, imágenes y conexiones entre nodos. |
| Personalización | Idioma español/inglés, tema, acento, fondo y preferencias visuales. |

## Una decisión de implementación

El audio usa Web Audio API para controlar volumen, velocidad y filtro desde el navegador. Las preferencias se guardan en localStorage y los audios propios en IndexedDB: no hace falta un backend de cuentas para conservar la sesión en ese navegador.

Las emisoras requieren conexión y dependen de Radio Browser, una base comunitaria. La opción de emisoras cercanas utiliza GeoJS para estimar el país por IP. Estas peticiones online son distintas del almacenamiento local de tus archivos.

## Límites actuales

- Las emisoras pueden dejar de estar disponibles; las que usan HTTP pueden bloquearse en una web HTTPS.
- Los datos se conservan por navegador y dispositivo; borrar sus datos elimina ese almacenamiento local.
- La reproducción de archivos depende de los formatos y códecs compatibles con el navegador.
- El código web de este repositorio se desarrolla con Vite. La descarga Windows se distribuye por separado en Releases.

<details>
<summary><strong>Desarrollo y despliegue</strong></summary>

React 18 · TypeScript · Vite 6 · Tailwind 4 · Web Audio API · IndexedDB.

### Ejecutar localmente

Requiere Node.js 18 o posterior según package.json y npm.

~~~sh
git clone https://github.com/JuanEstebanHerreraH/StanSsion.git
cd StanSsion
npm install
npm run dev
~~~

Abre la URL que muestre Vite en la terminal. No se necesitan claves de API para las funciones documentadas.

### Construir

~~~sh
npm run build
~~~

La salida estática queda en `dist/`. En Vercel, usa Vite como preset, `npm run build` como comando y `dist` como directorio de salida.

El código de interfaz está en `src/app/`; los componentes de audio, radio y área de trabajo en `src/app/components/atmos/`. Las atribuciones están en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

</details>

## Licencia

Código bajo licencia MIT; los recursos de terceros conservan sus atribuciones.
