# Mettre MonAuto en ligne sur le VPS LWS

Ce guide installe MonAuto sur le VPS (Ubuntu 24.04) à côté des sites déjà hébergés, sans les modifier. Chaque commande se copie et se colle dans le **Terminal SSH** du panneau LWS (panneau du VPS, rubrique « Administration avancée »).

Comptez une heure, plus le délai de propagation du nom de domaine (quelques minutes à quelques heures).

Ne collez jamais un mot de passe ou une clé dans une conversation, un e-mail ou un ticket.

## Ce que fait l'installation

- Node.js réservé à MonAuto, dans `/opt/monauto/node` : les autres sites gardent leur version.
- Une base PostgreSQL `monauto`, dont le mot de passe est créé sur le serveur.
- Le site, dans `/opt/monauto/app`, lancé par le service `monauto` au démarrage du serveur, sur le port 3100, accessible du serveur seul.
- Les photos et documents dans `/var/lib/monauto/uploads`.
- Une configuration pour `monauto.org` dans le serveur web déjà présent (Nginx ou Apache), ou Nginx s'il n'y en a aucun. Si le serveur web refuse cette configuration, elle est retirée et les autres sites ne sont pas touchés.
- Chaque nuit à 3 h 17 : suppression des données arrivées au bout de leur durée de conservation, puis sauvegarde de la base et des photos dans `/var/backups/monauto`, gardée 14 jours.

## 1. Faire pointer monauto.org vers le VPS

Dans l'espace client LWS, ouvrez le domaine **monauto.org**, puis sa **zone DNS** :

1. L'enregistrement **A** de `monauto.org` (souvent noté `@`) prend pour valeur l'**adresse IP** affichée dans le panneau du VPS, rubrique « Informations sur le compte ».
2. Faites de même pour `www` (enregistrement A vers la même adresse).
3. Ne touchez pas aux enregistrements **MX** : ils servent aux e-mails.

Si monauto.org affiche aujourd'hui un autre site, il sera remplacé par MonAuto.

## 2. Installer

Copiez ces deux commandes l'une après l'autre dans le Terminal SSH. La première télécharge le script d'installation, la seconde le lance (5 à 10 minutes).

```bash
curl -fsSL -o /root/install-monauto.sh https://raw.githubusercontent.com/paledebouna-lang/VINET/claude/great-curie-zfx98o/deploy/install.sh
```

```bash
sudo bash /root/install-monauto.sh
```

L'installation se termine par « Terminé ». Si elle s'arrête avant, copiez les dernières lignes affichées et transmettez-les : elles ne contiennent aucun secret.

## 3. Brancher l'envoi des e-mails

Sans cette étape, personne ne peut se connecter : les codes de connexion partent par e-mail tant que les SMS ne sont pas branchés.

1. Dans l'espace client LWS, créez la boîte **no-reply@monauto.org**. Donnez-lui un mot de passe fait **uniquement de lettres et de chiffres** (au moins 20 caractères) : les autres caractères devraient être convertis.
2. Relevez le **serveur SMTP** indiqué par LWS pour cette boîte.
3. Ouvrez le fichier de configuration :

```bash
sudo nano /opt/monauto/app/web/.env
```

4. Remplacez la ligne `SMTP_URL=""` par la vôtre, sur ce modèle (le `@` de l'adresse s'écrit `%40`) :

```
SMTP_URL="smtps://no-reply%40monauto.org:MOT_DE_PASSE@SERVEUR_SMTP:465"
```

5. Enregistrez avec **Ctrl+O**, puis **Entrée**, et quittez avec **Ctrl+X**.
6. Redémarrez le site :

```bash
sudo systemctl restart monauto
```

## 4. Activer HTTPS

Quand `monauto.org` affiche la page d'accueil de MonAuto (étape 1 propagée), relancez l'installation avec votre adresse e-mail. Let's Encrypt l'utilise pour prévenir si le certificat n'était pas renouvelé.

```bash
sudo CERTBOT_EMAIL=votre@adresse.ci bash /root/install-monauto.sh
```

Relancer l'installation ne recrée rien : la base, les secrets et les photos sont conservés. Le certificat se renouvelle ensuite tout seul.

Dans le panneau du VPS, rubrique **Firewall**, vérifiez que les ports **80** et **443** sont ouverts (et le port 22, qui sert au terminal).

## 5. Créer le premier administrateur

1. Ouvrez https://monauto.org, connectez-vous avec votre adresse e-mail.
2. Puis, dans le terminal, en remplaçant l'adresse :

```bash
sudo -u monauto bash -c 'cd /opt/monauto/app/web && /opt/monauto/node/bin/node --env-file=.env scripts/set-role.mjs votre@adresse.ci admin'
```

Déconnectez-vous puis reconnectez-vous : le menu « Modération » apparaît dans « Mon compte ».

## 6. Mettre les secrets à l'abri

Le fichier `.env` contient trois secrets créés à l'installation. Notez-les dans un gestionnaire de mots de passe, jamais dans un e-mail ou un document partagé :

```bash
sudo grep -E '^(BETTER_AUTH_SECRET|VINET_SECRET|DATABASE_URL)=' /opt/monauto/app/web/.env
```

- Sans `VINET_SECRET`, les balises VINET enregistrées devraient l'être à nouveau.
- Les sauvegardes de nuit ne contiennent pas ces secrets, volontairement.

## 7. Sauvegardes hors du serveur

Les sauvegardes de nuit restent sur le VPS : elles ne protègent pas d'une panne du serveur. Activez aussi les **Sauvegardes** ou les **Snapshots** du panneau LWS, ou copiez régulièrement `/var/backups/monauto` ailleurs.

## Au quotidien

Mettre en ligne la dernière version (une sauvegarde est faite d'abord ; le site peut être indisponible une minute) :

```bash
sudo bash /opt/monauto/app/deploy/update.sh
```

Voir si le site tourne :

```bash
sudo systemctl status monauto
```

Lire ses derniers messages en cas de problème :

```bash
sudo journalctl -u monauto -n 50 --no-pager
```

## Si les autres sites passent par un serveur web dans Docker (Caddy, Traefik…)

C'est le cas quand l'installation s'arrête sur « Le port 80 est utilisé par un serveur web qui n'est ni Apache ni Nginx » et cite `docker-proxy`. Le serveur web dans Docker garde la main sur les ports 80 et 443, et gère le HTTPS.

1. Relancer l'installation pour que MonAuto écoute sur la passerelle du réseau Docker de ce serveur web (son adresse se lit avec `docker inspect <conteneur>`), sans configurer Nginx, Apache ni certbot : `sudo WEB_SERVER=external LISTEN=<passerelle> bash /root/install-monauto.sh`.
2. Ajouter `monauto.org` à la configuration de ce serveur web, vers `http://<passerelle>:3100`. Pour Caddy : un bloc `monauto.org, www.monauto.org { reverse_proxy <passerelle>:3100 }` dans son Caddyfile, puis `caddy validate` et `caddy reload` dans le conteneur.
3. Si le pare-feu du serveur (ufw) est actif, autoriser le port 3100 depuis ce réseau Docker seulement.

## Pour un technicien

- Fichiers : `deploy/install.sh`, `deploy/update.sh`, `deploy/daily.sh` ; service `/etc/systemd/system/monauto.service` ; tâche `/etc/cron.d/monauto` ; journal de nuit `/var/log/monauto-daily.log`.
- Variables de l'installation : `DOMAIN` (défaut `monauto.org`), `PORT` (défaut 3100), `BRANCH`, `CERTBOT_EMAIL`. La branche suivie est celle du premier clonage ; la changer : `sudo -u monauto git -C /opt/monauto/app checkout <branche>`, puis `update.sh`.
- Restaurer une sauvegarde : arrêter le service, puis `pg_restore --clean --if-exists -d "<DATABASE_URL sans ?schema=public>" /var/backups/monauto/db-<date>.dump` et `tar -xzf /var/backups/monauto/uploads-<date>.tar.gz -C /var/lib/monauto`, puis redémarrer.
- SMS : quand un fournisseur sera branché, mettre `NEXT_PUBLIC_SMS_ENABLED="1"` dans `.env` et lancer `update.sh` (la valeur est lue à la construction du site).
