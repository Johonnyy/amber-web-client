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

## Kiosk / Pi deployment

For an always-on screen (a Pi wired to a display), two units run side by side:
`amber-web.service` *serves* the page (above), and
[`amber-web-kiosk.service`](amber-web-kiosk.service) *displays* it — Chromium
full-screen at `http://localhost:3000`, respawned if it ever dies.

```bash
# Edit User=/DISPLAY/XAUTHORITY and the chromium path to match your box first.
sudo cp deploy/amber-web-kiosk.service /etc/systemd/system/amber-web-kiosk.service
sudo systemctl daemon-reload
sudo systemctl enable --now amber-web-kiosk
```

The kiosk unit runs in the logged-in desktop user's graphical session, so set
`User=` to that user and point `DISPLAY`/`XAUTHORITY` at their X session. The
Chromium binary is `/usr/bin/chromium-browser` on Raspberry Pi OS and may be
`/usr/bin/chromium` on Debian/Ubuntu — check `which chromium-browser`.

### Auto-login (so it comes up unattended)

Set the desktop user to log in automatically on boot, so the graphical session
exists for the kiosk unit to attach to with no keyboard:

- **Raspberry Pi OS:** `sudo raspi-config` → *System Options* → *Boot / Auto
  Login* → *Desktop Autologin*.
- **Ubuntu/GNOME:** *Settings → System → Users → Automatic Login*, or set
  `AutomaticLoginEnable=true` / `AutomaticLogin=<user>` in
  `/etc/gdm3/custom.conf`.

Power cut and back? The box boots → auto-logs-in → `graphical.target` is reached
→ both units start. If Chromium crashes, systemd relaunches it in 5s (rate-limited
by `StartLimitBurst` so a hard crash-loop backs off instead of thrashing).

### Hardware watchdog (recover from a full lockup)

The above survives a process crash; a *kernel* watchdog reboots the box if the
whole system hangs. On most Pi/Linux boxes, enable systemd's built-in watchdog by
setting in `/etc/systemd/system.conf`:

```ini
RuntimeWatchdogSec=15
```

then `sudo systemctl daemon-reexec`. systemd pings the hardware watchdog every
~7s; if the kernel stops responding for 15s the board resets. (This is distinct
from the `watchdog` *daemon* package + `/etc/watchdog.conf`, which adds
configurable health checks on top — install that only if you need them.)

### Voice screen control

Say "Amber, turn off the screen" and the `set_screen` client tool POSTs
`/api/screen`, which runs your configured `xset` command on the host. Because that
runs inside `amber-web.service` (user `amber`, no X session), the command has to
reach the desktop user's display. Hop to that user with the right `DISPLAY`:

```bash
# .env
AMBER_SCREEN_OFF_CMD=sudo -u johnny DISPLAY=:0 xset dpms force off
AMBER_SCREEN_ON_CMD=sudo -u johnny DISPLAY=:0 xset dpms force on
```

and grant just that via sudoers:

```
# /etc/sudoers.d/amber-web-screen
amber ALL=(johnny) NOPASSWD: /usr/bin/xset
```

If the kiosk *is* logged in as `amber` (single-user box), drop the `sudo -u` and
just set `DISPLAY=:0` on `amber-web.service` instead. Either way the route reuses
`AMBER_UPDATE_TOKEN` as its control secret, so set the matching **Update token**
in client Settings if you've set the token.

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
