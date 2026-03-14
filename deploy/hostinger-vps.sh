#!/usr/bin/env bash
# One-time setup script for a fresh Ubuntu VPS (Hostinger KVM / DigitalOcean Droplet)
# Run as root or with sudo: bash hostinger-vps.sh
set -e

APP_DIR="/var/www/rupeezy-dashboard"
DOMAIN="your-domain.com"   # ← replace with your domain or VPS IP

# ── 1. System deps ────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y python3 python3-pip python3-venv nodejs npm nginx git

# ── 2. Clone / copy app ───────────────────────────────────────────────────────
# If deploying via git:
# git clone https://github.com/YOUR_USER/rupeezy-dashboard.git $APP_DIR
# Otherwise scp/rsync your folder here.
mkdir -p $APP_DIR
echo ">> Copy your project files to $APP_DIR, then press Enter."
read -r

# ── 3. Build frontend ─────────────────────────────────────────────────────────
cd "$APP_DIR/frontend"
npm ci && npm run build

# ── 4. Python venv ────────────────────────────────────────────────────────────
cd "$APP_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

# ── 5. .env file ─────────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
  echo ">> Edit $APP_DIR/backend/.env with your real credentials, then press Enter."
  read -r
fi

# ── 6. Systemd service ────────────────────────────────────────────────────────
cat > /etc/systemd/system/rupeezy.service <<EOF
[Unit]
Description=Rupeezy Trading Dashboard
After=network.target

[Service]
User=www-data
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/.venv/bin/gunicorn \\
  --worker-class eventlet \\
  -w 1 \\
  --bind 127.0.0.1:5000 \\
  --timeout 120 \\
  app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "$APP_DIR"
systemctl daemon-reload
systemctl enable rupeezy
systemctl start rupeezy
echo ">> Service status:"
systemctl status rupeezy --no-pager

# ── 7. Nginx reverse proxy ────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/rupeezy <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # WebSocket upgrade for Socket.IO
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # All other traffic → Flask (which serves React too)
    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/rupeezy /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "========================================================"
echo " Done! Visit http://$DOMAIN to open your dashboard."
echo " To add SSL: apt install certbot python3-certbot-nginx"
echo "             certbot --nginx -d $DOMAIN"
echo "========================================================"
