## Elasticsearch version

Sherlog uses **Elasticsearch 9.5.1**, pinned to this exact version everywhere:
the Docker image, the CI container and the npm client (`@elastic/elasticsearch` 9.x).

**Why 9.5:** it is the latest stable release line, so the project starts on current
ES|QL instead of inheriting an older version.

**Why pin an exact version:** a different version on my laptop, in CI or in the docs
can make the same ES|QL query behave differently or fail.