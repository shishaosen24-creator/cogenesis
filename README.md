# CoGenesis

CoGenesis is an AI creation workspace based on the open source
`basketikun/infinite-canvas` project. It keeps the infinite canvas,
asset library, prompt vault and OpenAI-compatible generation workflow,
then adds a Sacred Technology visual system and a director-style
storyboard workflow for image and video creation.

This repository is a modified distribution of
[basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas).
The original project is licensed under GNU AGPL-3.0, and this fork keeps
the same license.

## Features

- Infinite canvas with draggable nodes, connections, zoom, minimap,
  import and export.
- Image, video, text and audio model configuration with
  OpenAI-compatible Base URL and API Key fields.
- Director workflow for turning a theme into storyboard, visual
  direction and generation nodes.
- Prompt vault and asset library for collecting reusable creative
  material.
- Dark Sacred Technology UI with stage background, glass panels and
  CoGenesis branding.
- Go backend with Next.js frontend, packaged for Docker deployment.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Ant Design,
  Zustand, TanStack Query.
- Backend: Go, Gin, GORM.
- Storage: SQLite by default, with DSN configuration for other database
  drivers.
- Deployment: Docker and Docker Compose.

## Quick Start

```bash
git clone <your-repository-url>
cd infinite-canvas
cp .env.example .env
docker compose up -d --build
```

The default app entry is:

```text
http://localhost:3000
```

For local frontend development:

```bash
cd web
bun install
bun run dev
```

For backend development:

```bash
go run .
```

## Environment

Start from `.env.example` and fill only the values required for your
own deployment.

Do not commit real API keys, JWT secrets, database passwords, SSH keys,
cookies or production `.env` files. This repository intentionally ignores
`.env*`, local databases, generated test output and local automation
artifacts.

## Model Configuration

CoGenesis supports separate model settings for image, video, text and
audio workflows. Users may leave a module empty to fall back to the
general configuration, or fill a dedicated Base URL, API Key and model
selection in the app configuration panel.

## Documentation

- [Documentation index](docs/index.md)
- [Feature overview](docs/content/docs/overview/features.mdx)
- [Docker deployment](docs/content/docs/overview/docker.mdx)
- [Local development](docs/content/docs/backend/local-development.mdx)
- [Canvas node manual](docs/content/docs/canvas/canvas-node-manual.mdx)
- [Canvas shortcuts](docs/content/docs/canvas/canvas-shortcuts.mdx)
- [Backend database](docs/content/docs/backend/backend-database.mdx)
- [API response convention](docs/content/docs/backend/api-response.mdx)
- [Pending test items](docs/content/docs/progress/pending-test.mdx)
- [Todo](docs/content/docs/progress/todo.mdx)

## Attribution

CoGenesis is based on
[basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas).
Please keep the upstream attribution and AGPL-3.0 license notice when
redistributing modified versions.

## License

GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
