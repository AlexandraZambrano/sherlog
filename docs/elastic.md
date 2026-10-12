## Elasticsearch version

Sherlog uses **Elasticsearch 9.5.1**, pinned to this exact version everywhere:
the Docker image, the CI container and the npm client (`@elastic/elasticsearch` 9.x).

**Why 9.5:** it is the latest stable release line, so the project starts on current
ES|QL instead of inheriting an older version.

**Why pin an exact version:** a different version on my laptop, in CI or in the docs
can make the same ES|QL query behave differently or fail.

## Running the stack locally

### 1. First-time setup

Copy the example environment file:

```bash
cp .env.example .env
```

`docker-compose.yml` reads its variables from `.env`, for example `ELASTIC_VERSION`,
which sets the Elasticsearch and Kibana version. `.env` is ignored by git, so your own
settings and keys never get committed.

### 2. Start

```bash
docker compose up -d
```

The `-d` flag (detached) runs the containers in the background and gives you the terminal
back. The first run downloads the images and takes about a minute and a half. When it
finishes, compose reports Elasticsearch as healthy. Confirm with:

```bash
docker compose ps
```

Then open:

- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

Security is turned off on purpose, because the stack is for local development only. The
ports are bound to `127.0.0.1` so that nobody else on your network can reach it.

### 3. Stop, keeping your data

```bash
docker compose down
```

Stops and removes the containers. The data lives in the `es-data` volume, so it is still
there the next time you run `up -d`.

### 4. Reset, deleting all data

```bash
docker compose down -v
```

> **Warning:** `-v` also deletes the `es-data` volume, so **all indexed data is lost**.
> The downloaded images are kept, so the next start is fast but begins with an empty
> Elasticsearch. Use it when you want a clean start.

### 5. Read the logs

```bash
docker compose logs elasticsearch
```

Shows what Elasticsearch printed. Use it when something does not start. Replace
`elasticsearch` with `kibana` to see Kibana's logs.

### 6. If it never becomes healthy

1. Run `docker compose ps` and then the logs command above. The error is usually in the
   last lines.
2. Check Docker Desktop's memory limit (Settings, Resources). Elasticsearch is capped at
   2 GB and Kibana uses about 1 GB, so Docker needs more than that available, and more
   again once the demo shop is added.
3. Check that port 9200 or 5601 is not already used by another program.
