# Greenhouse Harvest – CV Exporter

Script en Node.js para:

- Listar Candidates, Attachments (resume), Jobs (open) y Applications (active) desde Greenhouse Harvest.

- Construir un índice por Application (con jobName, candidateId, uploadedAt, etc.) y deduplicar por candidato si lo necesitás.

- Descargar currículums:

  - Estructurado: output/YYYY/MM/<job-name>/<file>

  - Flat (una carpeta): output/flat/<file>

- Generar CSV con metadatos.

- Comprimir en ZIP el directorio de salida.

- Hecho para grandes volúmenes, con concurrencia (N descargas a la vez) y reintentos con backoff.

## Requisitos

- Node.js 18+
- Clave API de Harvest (HARVEST_API_KEY) con permisos de lectura a Candidates, Applications, Jobs y Attachments.
- Accesos de red a harvest.greenhouse.io

## Instalación

```bash
npm install
```

## Uso

1. Crear un archivo `.env` en la raíz del proyecto con la variable `HARVEST_API_KEY`:

```env
HARVEST_API_KEY=tu_clave_api
```

2. Ejecutar el script:

```bash
node index.js
```

3. Los currículums y el CSV se guardarán en la carpeta `output/`.
4. Un ZIP se generará en la carpeta raíz como `resumes_export.zip`.
