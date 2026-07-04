<div align="center">

<img src="./docs/banner.svg" alt="StanSsion" width="100%" />

<br/>

**Espacio de audio ambiente para estudiar, concentrarte y trabajar — sin perder el foco.**

[![React](https://img.shields.io/badge/React-18-37D8FE?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-7c5cbf?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-4f8ef7?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-37D8FE?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

[**🚀 Deploy en Vercel**](https://stan-ssion.vercel.app/) · [**🐛 Reportar algo**](https://github.com/JuanEstebanHerreraH/StanSsion/issues)

</div>

---

## ✨ Qué es

**StanSsion** es una app web para crear tu propio ambiente sonoro mientras estudiás o trabajás: mezclás sonidos ambientales, escuchás radios del mundo, subís tu propia música, controlás temporizadores tipo Pomodoro y tenés un lienzo libre para notas y tareas. Todo corre en el navegador, sin cuentas ni nube.

## 🎧 Funciones

| | |
|---|---|
| 🌧️ **Ambiente** | Sonidos como lluvia y bosque, con controles de **intensidad, velocidad y filtro**. Subí los tuyos: se guardan localmente. |
| 📻 **Emisoras** | Radio en vivo de todo el mundo vía *Radio Browser*. Buscá por **nombre, país o género**, marcá **favoritas**, armá **listas** y poné modo **aleatorio**. |
| 🎵 **Lista de reproducción** | Subí tus MP3/WAV/FLAC, creá **listas y favoritas**, buscador, reproductor con barra de progreso y *shuffle*. |
| ⏱️ **Temporizador** | Presets con **horas / minutos / segundos**, siempre visible en la barra superior, con **celebración** (sonido, confeti y notificación) al llegar a cero. |
| 🧠 **Área de trabajo** | Lienzo con *pan/zoom*, notas, tareas e imágenes, conexiones entre nodos y exportación. |
| 🎨 **Personalización** | Tema claro/oscuro/sistema, color de acento, fondo personalizado, visualizador con **colores RGB** y modo sin animaciones. |

## 🛠️ Stack

<div align="center">

![React](https://img.shields.io/badge/React_18-20232a?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-FF5722?style=flat-square&logo=javascript&logoColor=white)
![IndexedDB](https://img.shields.io/badge/IndexedDB-4f8ef7?style=flat-square&logo=html5&logoColor=white)

</div>

- **UI:** React 18 + TypeScript, estilos inline con tokens y variables CSS para el theming.
- **Audio:** Web Audio API (samples reales, ganancia, *playbackRate* y filtro pasa-bajos).
- **Datos:** `localStorage` para preferencias y metadatos · `IndexedDB` para los audios.
- **APIs públicas (sin clave):** Radio Browser (emisoras) y GeoJS (país por IP).

## 🚀 Empezar

> Requisitos: **Node 18+** (recomendado 20).

```bash
# 1) Clonar
git clone https://github.com/JuanEstebanHerreraH/StanSsion.git
cd StanSsion

# 2) Instalar
npm install

# 3) Desarrollo (http://localhost:5173)
npm run dev

# 4) Build de producción
npm run build
```

No necesitás variables de entorno: la app no usa claves ni secretos. Si querés agregar alguna propia más adelante, copiá el ejemplo:

```bash
cp .env.example .env
```

## ☁️ Deploy en Vercel

La app es un sitio estático (SPA) — Vercel la detecta como **Vite** sin configuración extra.

| Ajuste | Valor |
|---|---|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Importás el repo en Vercel → *Deploy*, o usás el botón de arriba. Listo.

## 📁 Estructura

```
StanSsion/
├─ docs/                       # banner del README
├─ index.html                  # punto de entrada
├─ src/
│  ├─ main.tsx                 # bootstrap de React
│  ├─ app/
│  │  ├─ App.tsx               # estado central + theming
│  │  └─ components/atmos/      # Dashboard, Radio, Playlist, Timer, Workspace, Settings…
│  ├─ assets/                  # loops de audio
│  └─ styles/                  # theme.css, tailwind, fonts
├─ .env.example
├─ .gitignore
├─ .nvmrc
└─ vite.config.ts
```

## 💾 Cómo se guardan tus datos

Todo es **local en tu navegador**: las preferencias y metadatos van a `localStorage`, y los audios que subís a `IndexedDB`. No se sube nada a ningún servidor. Para liberar espacio, usá **"Borrar todo"** en la lista de reproducción.

## ⚠️ Sobre las emisoras

Las radios vienen de *Radio Browser*, una base **comunitaria**: la cobertura varía por país, los resultados están acotados (~120) y ordenados por popularidad, y las emisoras `http` pueden estar bloqueadas por el navegador cuando la app corre en `https`. "Cerca de ti" detecta tu país por IP, así que una VPN puede cambiarlo.

## 📄 Licencia

MIT — usalo, modificalo y compartilo libremente.

<div align="center">
<br/>
<sub>Hecho con 💙 para concentrarse mejor.</sub>
</div>
