#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GannaApp — one-time server setup for an AWS Lightsail Ubuntu 22.04 instance.
# Run ONCE on a fresh instance:   sudo bash deploy/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="ubuntu"
APP_DIR="/home/${APP_USER}/GannaApp"
NODE_MAJOR=20

echo "==> Updating packages"
apt-get update -y
apt-get upgrade -y

echo "==> Installing Node.js ${NODE_MAJOR}, MySQL, nginx, git"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs mysql-server nginx git ufw

echo "==> Node version: $(node -v), npm: $(npm -v)"

echo "==> Securing MySQL and creating the app database"
# Creates database + user. CHANGE THE PASSWORD before running, or set DB_PASSWORD env.
DB_PASSWORD="${DB_PASSWORD:-changeme_please}"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS ganna CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ganna'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ganna.* TO 'ganna'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "    database 'ganna' and user 'ganna'@'localhost' ready"

echo "==> Loading schema (if deploy/schema.sql present)"
if [ -f "${APP_DIR}/deploy/schema.sql" ]; then
  mysql ganna < "${APP_DIR}/deploy/schema.sql"
  echo "    schema loaded"
else
  echo "    !! ${APP_DIR}/deploy/schema.sql not found — load it manually later"
fi

echo "==> Installing systemd service"
cp "${APP_DIR}/deploy/gannaapp.service" /etc/systemd/system/gannaapp.service
systemctl daemon-reload
systemctl enable gannaapp

echo "==> Configuring nginx reverse proxy"
cp "${APP_DIR}/deploy/nginx-gannaapp.conf" /etc/nginx/sites-available/gannaapp
ln -sf /etc/nginx/sites-available/gannaapp /etc/nginx/sites-enabled/gannaapp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "==> Firewall (allow SSH + HTTP + HTTPS only; app port stays internal)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

cat <<'DONE'

────────────────────────────────────────────────────────────
Server setup complete.

Next steps:
  1. Create the environment file:   cp deploy/.env.example .env  &&  nano .env
     - set a STRONG JWT_SECRET   (openssl rand -base64 48)
     - set DB_PASSWORD to match what you used above
     - set NODE_ENV=production
  2. Deploy the app:               bash deploy/deploy.sh
  3. Point your domain at this instance's static IP, then enable HTTPS:
       sudo apt install -y certbot python3-certbot-nginx
       sudo certbot --nginx -d your-domain.com
────────────────────────────────────────────────────────────
DONE
