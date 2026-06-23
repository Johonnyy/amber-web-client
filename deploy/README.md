# Deploying the Amber web client

Mirrors the Amber backend's setup: a systemd service on the same VPS, served over
https (mic access requires it).

## First install

```bash
sudo git clone <repo> /opt/amber-web
cd /opt/amber-web
npm ci
npm run build
sudo cp .env.example .env   # then edit — at minimum set AMBER_UPDATE_TOKEN
sudo cp deploy/amber-web.service /etc/systemd/system/amber-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now amber-web
```

Put it behind your existing TLS reverse proxy (Caddy/nginx) so it's reachable
over https. `npm run start` serves on port 3000 by default.

## Self-update (voice-driven)

The client can update itself: say **"Amber, update yourself."** Amber calls the
client's `update` tool → the browser POSTs `/api/update` → the server runs
[`scripts/self-update.sh`](../scripts/self-update.sh) (git pull → `npm ci` →
`npm run build` → restart), and the page reloads once the new build is live.

**The cgroup gotcha.** If the updater runs inside the `amber-web` service's own
cgroup, `systemctl restart` kills it mid-build. Run it decoupled by setting, in
`.env`:

```bash
AMBER_UPDATE_CMD=sudo systemd-run --collect --unit=amber-web-update bash /opt/amber-web/scripts/self-update.sh
```

`systemd-run` launches the updater as its own transient unit, so it survives the
service restart it triggers.

### Required sudoers

The service user (`amber`) needs passwordless sudo for just the update + restart:

```
# /etc/sudoers.d/amber-web
amber ALL=(root) NOPASSWD: /usr/bin/systemctl restart amber-web, /usr/bin/systemd-run *
```

### Auth

Set `AMBER_UPDATE_TOKEN` in `.env` and the same value in the client's **Update
token** setting (Esc → Settings). `/api/update` rejects requests without it. With
no token set the endpoint is open — fine for localhost, not for a public host.

## Manual update

```bash
cd /opt/amber-web && AMBER_UPDATE_BRANCH=main bash scripts/self-update.sh
```
