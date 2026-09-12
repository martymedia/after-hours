# Deploy (Hetzner, shared box)

Server: `ssh root@167.233.192.162`, project dir `/opt/after-hours`.
Own compose project; joins the `marty-media_default` network so the shared
Caddy can proxy to it. Nothing here touches `/opt/marty-media`.

Local (Git Bash, from the repo root). Commit first: the tarball is the
committed tree, which avoids shipping half-edited files.

```bash
git archive --format=tar.gz -o after-hours.tar.gz HEAD
scp after-hours.tar.gz root@167.233.192.162:/opt/after-hours/deploy.tar.gz
rm after-hours.tar.gz
```

Server:

```bash
ssh root@167.233.192.162
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

Domain: copy `deploy/afterhours.caddy` to
`/opt/marty-media/deploy/conf.d/afterhours.caddy` with the real hostname,
then `cd /opt/marty-media && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`.
DNS A record for the hostname must point at 167.233.192.162 first.

Disk hygiene after each build: `docker builder prune -f && df -h /`.
