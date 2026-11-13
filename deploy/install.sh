#!/usr/bin/env bash
# Installs MonAuto on Ubuntu 24.04, next to the sites already on the server, without touching them.
# Run as root:  sudo bash install.sh
# Settings (optional):  DOMAIN=monauto.org  CERTBOT_EMAIL=vous@exemple.com  BRANCH=…  PORT=3100
#   WEB_SERVER=external  another web server publishes the site (e.g. Caddy in Docker): no Nginx/Apache, no certbot.
#   LISTEN=172.18.0.1    address the site listens on; for a web server in Docker, its network's gateway.
# Safe to run again: what already exists is kept (database, secrets, uploads).
set -euo pipefail

DOMAIN="${DOMAIN:-monauto.org}"
BRANCH="${BRANCH:-claude/great-curie-zfx98o}"
PORT="${PORT:-3100}"
LISTEN="${LISTEN:-127.0.0.1}"
WEB_SERVER="${WEB_SERVER:-auto}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
REPO="https://github.com/paledebouna-lang/VINET.git"
NODE_VERSION="22.23.5"
APP=/opt/monauto
DATA=/var/lib/monauto
WEB="$APP/app/web"
NODE="$APP/node/bin/node"
say() { printf '\n== %s\n' "$*"; }
as_app() { sudo -u monauto -H env PATH="$APP/node/bin:/usr/bin:/bin" bash -c "$1"; }

[ "$(id -u)" = 0 ] || { echo "Lancez ce script avec sudo : sudo bash install.sh"; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] || echo "Attention : ce script est prévu pour Ubuntu, le système est $PRETTY_NAME."

say "Vérification du port $PORT"
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN && ! systemctl is-active --quiet monauto; then
  echo "Le port $PORT est déjà utilisé par un autre programme. Relancez avec un autre port : sudo PORT=3200 bash install.sh"
  exit 1
fi

say "Paquets du système"
apt-get update -q
apt-get install -y -q git curl ca-certificates xz-utils postgresql

say "Node.js $NODE_VERSION, réservé à MonAuto (les autres sites gardent le leur)"
if [ ! -x "$NODE" ] || [ "$("$NODE" -v)" != "v$NODE_VERSION" ]; then
  tmp=$(mktemp -d)
  file="node-v$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSL -o "$tmp/$file" "https://nodejs.org/dist/v$NODE_VERSION/$file"
  curl -fsSL -o "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf "$APP/node" && mkdir -p "$APP/node"
  tar -xJf "$tmp/$file" -C "$APP/node" --strip-components=1
  rm -rf "$tmp"
fi

say "Compte système et dossiers"
id -u monauto >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin monauto
mkdir -p "$DATA/uploads" /var/backups/monauto
chown -R monauto:monauto "$APP" "$DATA" /var/backups/monauto
chmod 750 "$DATA" /var/backups/monauto

say "Code de MonAuto (branche $BRANCH)"
if [ ! -d "$APP/app/.git" ]; then
  as_app "git clone --quiet --branch '$BRANCH' '$REPO' '$APP/app'"
fi

say "Base de données"
if [ ! -f "$WEB/.env" ]; then
  db_password=$(openssl rand -hex 24)
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = 'monauto'" | grep -q 1; then
    sudo -u postgres psql -qc "alter role monauto with login password '$db_password'"
  else
    sudo -u postgres psql -qc "create role monauto with login password '$db_password'"
  fi
  sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'monauto'" | grep -q 1 \
    || sudo -u postgres createdb -O monauto monauto
  # Secrets are made here, on the server, and never leave it.
  cat > "$WEB/.env" <<ENV
DATABASE_URL="postgresql://monauto:$db_password@127.0.0.1:5432/monauto?schema=public"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="https://$DOMAIN"
# Encrypts VINET beacon keys. Write it down somewhere safe: without it, beacons must be registered again.
VINET_SECRET="$(openssl rand -base64 32)"
UPLOAD_DIR="$DATA/uploads"
# E-mail codes and notifications: smtps://adresse%40$DOMAIN:mot-de-passe@serveur-smtp:465 (see docs/MISE_EN_LIGNE.md)
SMTP_URL=""
MAIL_FROM="MonAuto <no-reply@$DOMAIN>"
# Set to 1 once an SMS provider is wired: sign-in by phone is then offered.
NEXT_PUBLIC_SMS_ENABLED=""
ENV
  chown monauto:monauto "$WEB/.env"
  chmod 600 "$WEB/.env"
  echo "Fichier de configuration créé : $WEB/.env"
fi

say "Installation des dépendances, mise à jour de la base et construction du site (quelques minutes)"
as_app "cd '$WEB' && npm ci --no-audit --no-fund && npx prisma migrate deploy && npm run build"

say "Service monauto (démarrage automatique)"
cat > /etc/systemd/system/monauto.service <<UNIT
[Unit]
Description=MonAuto
# docker.service: LISTEN may be the gateway of a Docker network, which exists only once Docker is up.
After=network.target postgresql.service docker.service

[Service]
User=monauto
WorkingDirectory=$WEB
Environment=NODE_ENV=production
ExecStart=$NODE $WEB/node_modules/next/dist/bin/next start -H $LISTEN -p $PORT
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --quiet monauto
systemctl restart monauto

say "Serveur web"
# Photos: 8 of 8 MB at most, plus an attestation.
if [ "$WEB_SERVER" = external ]; then
  echo "Le serveur web existant publie le site : il doit transmettre $DOMAIN à http://$LISTEN:$PORT (voir docs/MISE_EN_LIGNE.md)."
  web=external
elif systemctl is-active --quiet apache2; then
  a2enmod -q proxy proxy_http headers >/dev/null
  cat > /etc/apache2/sites-available/monauto.conf <<SITE
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    ProxyPreserveHost On
    ProxyPass / http://$LISTEN:$PORT/
    ProxyPassReverse / http://$LISTEN:$PORT/
    RequestHeader set X-Forwarded-Proto expr=%{REQUEST_SCHEME}
    LimitRequestBody 83886080
</VirtualHost>
SITE
  a2ensite -q monauto >/dev/null
  # A configuration Apache refuses would also stop the other sites at the next reload: it is removed at once.
  if ! apachectl configtest; then
    a2dissite -q monauto >/dev/null
    echo "Apache refuse la configuration de MonAuto ; elle a été retirée et les autres sites ne sont pas touchés."
    exit 1
  fi
  systemctl reload apache2
  web=apache
else
  if ! systemctl is-active --quiet nginx && ss -ltn "( sport = :80 )" | grep -q LISTEN; then
    echo "Le port 80 est utilisé par un serveur web qui n'est ni Apache ni Nginx :"
    ss -ltnp "( sport = :80 )"
    echo "MonAuto tourne sur $LISTEN:$PORT ; il reste à le relier à ce serveur web, puis à relancer avec WEB_SERVER=external."
    exit 1
  fi
  apt-get install -y -q nginx
  ipv6=""
  [ -f /proc/net/if_inet6 ] && ipv6="listen [::]:80;"
  cat > /etc/nginx/sites-available/monauto <<SITE
server {
    listen 80;
    $ipv6
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 80m;

    location / {
        proxy_pass http://$LISTEN:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
SITE
  ln -sf /etc/nginx/sites-available/monauto /etc/nginx/sites-enabled/monauto
  # A configuration Nginx refuses would also stop the other sites at the next reload: it is removed at once.
  if ! nginx -t; then
    rm -f /etc/nginx/sites-enabled/monauto
    echo "Nginx refuse la configuration ; celle de MonAuto a été retirée et les autres sites ne sont pas touchés."
    exit 1
  fi
  systemctl reload nginx
  web=nginx
fi
if ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

say "Tâches quotidiennes : suppression des anciennes données et sauvegarde"
cat > /etc/cron.d/monauto <<CRON
# MonAuto: retention (docs/FEUILLE_DE_ROUTE.md, section 2) and local backups, every night.
17 3 * * * root bash $APP/app/deploy/daily.sh >> /var/log/monauto-daily.log 2>&1
CRON

say "HTTPS"
if [ "$web" = external ]; then
  echo "Le certificat HTTPS est géré par le serveur web existant."
elif [ -z "$CERTBOT_EMAIL" ]; then
  echo "Certificat non demandé : relancez avec CERTBOT_EMAIL=votre@adresse quand $DOMAIN pointe vers ce serveur."
else
  apt-get install -y -q certbot "python3-certbot-$web"
  domains=(-d "$DOMAIN")
  getent hosts "www.$DOMAIN" >/dev/null && domains+=(-d "www.$DOMAIN")
  certbot "--$web" --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" "${domains[@]}" \
    || echo "Le certificat n'a pas pu être obtenu : vérifiez que $DOMAIN pointe bien vers ce serveur, puis relancez."
fi

say "Terminé"
systemctl --no-pager --lines=0 status monauto || true
echo "MonAuto écoute sur $LISTEN:$PORT, publié par $web pour $DOMAIN."
grep -q '^SMTP_URL=""' "$WEB/.env" && echo "À faire : renseigner SMTP_URL dans $WEB/.env, sinon personne ne pourra se connecter (voir docs/MISE_EN_LIGNE.md)."
exit 0
