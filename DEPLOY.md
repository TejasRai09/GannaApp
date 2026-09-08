# Deploying GannaApp to AWS Lightsail

This is the full, start-to-finish guide. Architecture: **one Lightsail instance** running
Node (the app), MySQL (the database), and nginx (the web front door). With ~5 users this
is more than enough and costs about **$10–12/month**.

```
Internet  →  nginx  (port 80/443)  →  Node/Express  (port 4000)  →  MySQL  (localhost:3306)
                                          └─ also serves the built React frontend
```

---

## 1. Create the Lightsail instance

1. AWS console → **Lightsail** → *Create instance*
2. Region: **Mumbai (ap-south-1)** — closest to the mill, lowest latency
3. Platform: **Linux/Unix** → Blueprint: **OS Only → Ubuntu 22.04 LTS**
4. Plan: **$10/mo** (2 GB RAM, 2 vCPU, 60 GB SSD).
   *Do not pick the $5 plan* — 1 GB RAM is not enough to build the frontend.
5. Name it `gannaapp-prod` → **Create instance**

Then:

- **Networking** tab → *Attach static IP* → attach one. (Free while attached; without it
  the IP changes on every reboot.)
- **Networking → IPv4 Firewall** → make sure **HTTP (80)** and **HTTPS (443)** are allowed.
  Do **not** open port 4000 or 3306 — they stay internal.

---

## 2. Connect and pull the code

Click **Connect using SSH** in the Lightsail console (browser terminal), then:

```bash
cd ~
git clone https://github.com/TejasRai09/GannaApp.git
cd GannaApp
```

If the repo is private, create a GitHub personal access token and use:
`git clone https://<token>@github.com/TejasRai09/GannaApp.git`

---

## 3. Run the one-time server setup

```bash
cd ~/GannaApp
sudo DB_PASSWORD='pick-a-strong-db-password' bash deploy/setup.sh
```

This installs Node 20, MySQL, nginx and git; creates the `ganna` database and user;
loads `deploy/schema.sql`; installs the systemd service and nginx site; and turns on the
firewall. It takes about 5 minutes.

---

## 4. Create the environment file

```bash
cd ~/GannaApp
cp .env.example .env
openssl rand -base64 48        # copy the output — this is your JWT_SECRET
nano .env
```

Fill in:

```
NODE_ENV=production
PORT=4000
DB_HOST=localhost
DB_USER=ganna
DB_PASSWORD=<the same password you passed to setup.sh>
DB_NAME=ganna
JWT_SECRET=<the openssl output>
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

> **Why this matters:** in production the app now *refuses* to issue login tokens if
> `JWT_SECRET` is missing, rather than silently falling back to a well-known default.

---

## 5. Deploy

```bash
cd ~/GannaApp
bash deploy/deploy.sh
```

This pulls the latest code, installs dependencies, builds the backend (`src` → `dist`)
and the frontend (`frontend` → `frontend/dist`), restarts the service, and runs a health
check. First run takes 3–5 minutes (the frontend build is the slow part).

Now open **`http://<your-static-ip>/`** in a browser. You should see the login page.

---

## 6. Create the first user

The signup endpoint creates `member` accounts. To create the first admin, insert
directly:

```bash
# generate a bcrypt hash for the password you want
cd ~/GannaApp
node -e "console.log(require('bcryptjs').hashSync('YourPassword123', 10))"
```

```bash
mysql -u ganna -p ganna
```

```sql
INSERT INTO organizations (name) VALUES ('Gobind Sugar Mills');

INSERT INTO users (org_id, name, email, password_hash, role, is_active)
VALUES (1, 'Tejas Rai', 'tejas.rai@adventz.com', '<paste the hash>', 'superadmin', 1);
```

---

## 7. Add a domain and HTTPS (recommended)

Point an `A` record for your domain at the static IP, wait for DNS to propagate, then:

```bash
sudo nano /etc/nginx/sites-available/gannaapp   # set: server_name your-domain.com;
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot adds the HTTPS block and sets up automatic renewal.

---

## Day-to-day operations

| Task | Command |
|---|---|
| Deploy new code | `cd ~/GannaApp && bash deploy/deploy.sh` |
| Live logs | `sudo journalctl -u gannaapp -f` |
| Last 100 log lines | `sudo journalctl -u gannaapp -n 100 --no-pager` |
| Restart the app | `sudo systemctl restart gannaapp` |
| Service status | `sudo systemctl status gannaapp` |
| Health check | `curl http://127.0.0.1:4000/api/health` |
| Database check | `curl http://127.0.0.1:4000/api/db-test` |

### Backups

Two layers, both worth having:

1. **Lightsail automatic snapshots** — Instance → *Snapshots* tab → enable automatic
   snapshots. Whole-machine restore point, ~$0.05/GB/month.
2. **Nightly database dump** — cheap insurance for the data itself:

```bash
mkdir -p ~/backups
crontab -e
```

Add:

```
0 2 * * * mysqldump -u ganna -p'<db-password>' ganna | gzip > ~/backups/ganna-$(date +\%F).sql.gz && find ~/backups -name '*.sql.gz' -mtime +14 -delete
```

---

## Troubleshooting

**App won't start** — `sudo journalctl -u gannaapp -n 50 --no-pager`.
Usual causes: `.env` missing or malformed, or `dist/server.js` absent (the TypeScript
build failed — rerun `npx tsc -p tsconfig.json` and read the errors).

**502 Bad Gateway from nginx** — Node is down. Check the service status and logs above.

**Login returns "Server misconfigured"** — `JWT_SECRET` is empty in `.env`. Set it and
`sudo systemctl restart gannaapp`.

**Frontend build killed / out of memory** — you are on the 1 GB plan. Either upgrade the
instance, or add swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Uploads rejected** — CSV/Excel uploads are capped at 10 MB by Express and 12 MB by
nginx. Raise `client_max_body_size` in the nginx config and the `express.json` limit in
[src/server.ts](src/server.ts) together if you ever need more.

---

## Security checklist before going live

- [ ] `JWT_SECRET` is a random 48-byte value, not the placeholder
- [ ] `DB_PASSWORD` is strong and matches between `.env` and MySQL
- [ ] `.env` is **not** in git (`git check-ignore .env` should print `.env`)
- [ ] Lightsail firewall exposes only 22, 80, 443
- [ ] MySQL is bound to localhost only (Ubuntu's default — verify with
      `sudo ss -lntp | grep 3306`, it should show `127.0.0.1:3306`)
- [ ] HTTPS enabled via certbot before real users log in
- [ ] Automatic snapshots turned on
