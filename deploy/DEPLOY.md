# Deploy (Hetzner, shared box)

Server: `ssh root@167.233.192.162`, project dir `/opt/after-hours`.
Own compose project; joins the `marty-media_default` network so the shared
Caddy can proxy to it. Nothing here touches `/opt/marty-media`.

Local (PowerShell or Git Bash, from the repo root):

```bash
tar czf after-hours.tar.gz --exclude=node_modules --exclude=.next --exclude=data --exclude=.git --exclude=.env .
scp after-hours.tar.gz root@167.233.192.162:/opt/after-hours/deploy.tar.gz
```

Server:

```bash
ssh root@167.233.192.162
mkdir -p /opt/after-hours && cd /opt/after-hours
rm -rf src scripts && tar xzf deploy.tar.gz
test -f .env || cp .env.example .env
docker compose build web
docker compose up -d
docker compose ps
```

The build runs on the box (2 GB RAM plus swap). If it OOMs, build locally
and `docker save | ssh ... docker load` instead.

Domain: copy `deploy/afterhours.caddy` to
`/opt/marty-media/deploy/conf.d/afterhours.caddy` with the real hostname,
then `cd /opt/marty-media && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`.
DNS A record for the hostname must point at 167.233.192.162 first.

Disk hygiene after each build: `docker builder prune -f && df -h /`.
