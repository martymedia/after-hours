# Deploy (a small VPS shared with other services)

Server: `ssh root@SERVER`, project dir `/opt/after-hours`. Own compose
project; it joins the reverse proxy's external Docker network (set
`PROXY_NETWORK` in `.env`, default `marty-media_default`) so the host's
shared Caddy can proxy to it. Nothing here touches the proxy's own files.

Local (Git Bash, from the repo root). Commit first: the tarball is the
committed tree, which avoids shipping half-edited files.

```bash
git archive --format=tar.gz -o after-hours.tar.gz HEAD
scp after-hours.tar.gz root@SERVER:/opt/after-hours/deploy.tar.gz
rm after-hours.tar.gz
```

Server:

```bash
ssh root@SERVER
mkdir -p /opt/after-hours && cd /opt/after-hours
rm -rf src scripts deploy public docs && tar xzf deploy.tar.gz
test -f .env || cp .env.example .env
docker compose build web
docker compose up -d
docker compose ps
```

The `rm -rf` of the source dirs matters: tar extracts over the old tree and
never deletes removed files.

The build runs on the box (2 GB RAM plus swap). If it OOMs, build locally
and `docker save | ssh ... docker load` instead.

Domain: https://after-hour.net (live since 2026-09-13). Copy `deploy/afterhours.caddy`
into the shared Caddy's `conf.d/` and reload it
(`docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile` in
that compose project). The DNS A record must point at the server first.

Disk hygiene after each build: `docker builder prune -f && df -h /`.

## Force a universe rebuild on the server

The collector rebuilds the token universe every 6 h, counted from process
start. To rebuild now (after changing listing rules), clear the meta key and
restart the collector; clearing alone does nothing until the restart.

```bash
ssh root@SERVER 'cd /opt/after-hours && docker compose exec -T collector node -e "const {DatabaseSync}=require(\"node:sqlite\");const db=new DatabaseSync(process.env.AFTER_HOURS_DB);db.prepare(\"DELETE FROM meta WHERE key=?\").run(\"universe_updated_at\")" && docker compose restart collector'
```

Both services run the same `after-hours:latest` image, so `docker compose
build web` also refreshes the collector's code; the collector still needs the
restart to pick it up.

Gotcha: when a deploy script is piped in over `ssh 'bash -s'`, every
`docker compose exec -T ...` swallows the rest of the script from stdin.
Append `</dev/null` to each exec, or run those commands in a separate ssh call.
