# Feuille de route — MonAuto (AVS · VINET)

Synthèse hiérarchisée du cahier des charges consolidé. Ordre de travail, périmètre de chaque lot et critère de sortie.
Aucune durée n'est donnée : elles dépendent de l'équipe et des décisions de la phase 0.

## 1. Ce qui compte le plus

| Rang | Sujet | Pourquoi |
|---|---|---|
| 1 | Marketplace vente + location basique | C'est le produit. Sans annonces ni réservations, AVS n'a rien à protéger. |
| 2 | Passeport AVS + QR | Différenciation peu coûteuse : pas de matériel, utile dès la première annonce. |
| 3 | Suivi GPS (AVS Locate) | Valeur forte pour les agences de location ; dépend d'un fournisseur de trackers. |
| 4 | Security Center + déclaration de vol | N'a de sens qu'avec des véhicules déjà suivis. |
| 5 | VINET (Bluetooth collaboratif) | Dépend du matériel et d'une densité de partenaires ; prototype d'abord. |
| 6 | Écosystème (enchères, finance, assurance, pièces, IA, bateaux, avions) | Chaque module demande un partenaire ou un cadre légal spécifique. |

## 2. Cadrage (phase 0)

### Décidé

- **Nom commercial : MonAuto** (monauto.org). AVS reste le nom du système de sécurité, VINET celui du réseau de détection.
- **Direction visuelle :** la maquette de base est validée (bleu nuit, cobalt, accent or).
- **Mobile :** le site responsive est livré d'abord ; l'app Flutter suit une fois les parcours validés.
- **Périmètre du MVP :** voitures, motos et utilitaires ; Abidjan ; en français.
- **Paiement :** CinetPay.
- **Juridique :** le juriste de l'équipe amende les propositions du document « MonAuto — Propositions juridiques à amender » (https://claude.ai/artifact/VDbtGF8WLV4THATohPo567).

- **Hébergement, nom de domaine et e-mails :** LWS (lws.fr), en France.
- **Réponses juridiques du 10 novembre 2026** (détail dans la section 8 du document) :
  - MonAuto est un intermédiaire ; le contrat lie le loueur et le locataire.
  - Tout véhicule mis en location est équipé d'un GPS par son propriétaire.
  - Le propriétaire fournit une attestation d'assurance pour louer entre particuliers.
  - Le droit d'annulation du consommateur s'applique aux réservations en ligne.
  - Les durées de conservation des positions sont retenues telles que proposées.
  - L'hébergement hors de Côte d'Ivoire et la transmission aux autorités sont permis.

### Reste à décider

1. **Formule LWS.** Le site a besoin de Node.js et de PostgreSQL : une formule cPanel qui offre les deux, ou un VPS. Bloque la mise en ligne.
2. **SMS pour les codes de connexion.** LWS vend des SMS par API, à crédits ; la couverture et le prix pour la Côte d'Ivoire sont à confirmer. Bloque la connexion par téléphone en production.
3. **Paiement en ligne des ventes.** Proposition : le lot 2 se fait sans paiement en ligne (mise en relation, visite) ; le paiement arrive avec la location au lot 3.

### À faire confirmer par écrit par le juriste

- L'absence de formalité auprès de l'ARTCI pour la géolocalisation.
- L'absence d'agrément pour détenir un séquestre ou un dépôt de garantie. D'ici là, les fonds restent chez CinetPay.

## 3. Lots de réalisation

### Lot 1 — Fondations

Fait, dans `web/` :

- Une seule application Next.js porte le site et son API, sur PostgreSQL. Un service séparé sera extrait quand l'ingestion GPS l'exigera (lot 6).
- Comptes sans mot de passe : code à usage unique par téléphone (mobiles ivoiriens) ou par e-mail.
- Profils : particulier, agence, administrateur ; un visiteur est simplement non connecté. Le profil ne peut pas être choisi par l'utilisateur.
- Journal d'audit : création de compte et connexion.
- Couleurs et typographies de la maquette validée ; page d'accueil, connexion, compte.
- Intégration continue : lint, types, tests, compilation.

Reste à faire avant la mise en ligne :

- Brancher l'envoi des SMS (aujourd'hui les codes SMS s'affichent dans le journal du serveur de développement). L'e-mail part déjà par SMTP dès que la boîte LWS est renseignée.
- Seconde vérification pour les comptes agence et administrateur.
- Déploiement.

Le modèle de données grandit lot par lot : chaque lot ajoute ses tables par migration, plutôt que de créer d'avance des tables vides.

Sortie : un utilisateur crée un compte, se connecte, voit une page d'accueil vide mais réelle. Vérifié en local.

### Lot 2 — Vente
- Création d'annonce avec photos, contrôle de cohérence, VIN à visibilité contrôlée, localisation approximative.
- Recherche, filtres, favoris, contact sécurisé, signalement d'annonce.
- Vérification du vendeur, file de modération.

Sortie : une annonce passe de la création à la publication modérée et reçoit une demande.

### Lot 3 — Location basique
- Mise en location refusée sans GPS déclaré par le propriétaire et sans attestation d'assurance.
- Calendrier, tarifs, réservation, annulation selon le droit du consommateur, dépôt de garantie, paiement par CinetPay.
- Contrat électronique et consentement au suivi affiché avant signature.
- AVS Rental Check : inspection photo au départ et au retour, kilométrage, carburant, clôture.

Sortie : une location complète réservation → départ → retour → clôture, sans intervention technique.

### Lot 4 — Administration et support
- Utilisateurs, rôles, modération, paiements, litiges, paramètres pays/devise.

Sortie : **MVP marketplace** (phase 1 du cahier).

### Lot 5 — Passeport AVS et QR
- Identifiant AVS, QR signé côté serveur, page publique de vérification à statut limité.
- Signalement et observation depuis un scan, position du déclarant uniquement avec accord.
- Inspections rattachées au passeport.

Sortie : un scan affiche l'identité vérifiée et permet un signalement qualifié comme tel.

### Lot 6 — AVS Locate (GPS)
- Intégration d'un ou deux trackers commerciaux, enregistrement des balises, ingestion des positions.
- Carte, historique, zones autorisées, alertes (sortie de zone, retard, débranchement, hors ligne).
- Espace agence/flotte ; suivi limité à la durée du contrat.

Sortie : une agence suit un véhicule loué et reçoit une alerte de sortie de zone.

### Lot 7 — Security Center
- Déclaration de vol vérifiée (propriété, documents, confirmation humaine).
- Dossier, timeline, preuves, export aux autorités, clôture.

Sortie : un dossier de vol est ouvert, instruit et clos avec une trace complète.

### Lot 8 — Prototype VINET
- Balise BLE à identifiant rotatif, détecteur partenaire, serveur d'événements, anti-abus.
- Tests terrain de portée et de fiabilité.

Sortie : une « dernière détection » réelle apparaît sur la carte avec rayon et qualité.

### Lot 9 — Pilote Côte d'Ivoire
Agences sélectionnées, véhicules volontaires, procédures de vol, support, mesure.

### Lot 10 — Extension
Nouveaux pays et devises, bateaux et avions (opérateurs agréés), enchères, assurance et financement partenaires, pièces, IA.

## 4. Règles valables pour tous les lots

- Une position live n'est jamais confondue avec une dernière position, une détection ou une observation. Chaque point affiche source, heure, précision et confiance.
- Aucun suivi sans information et consentement ; aucun accès aux positions hors des rôles autorisés ; chaque accès est journalisé.
- Le QR identifie et signale. Il ne localise pas.
- Un transfert de propriété n'est jamais présenté comme réalisé tant que la formalité officielle reste à faire.
- L'application ne demande jamais à un utilisateur de confronter un suspect. La récupération relève des autorités.
- Aucune intégration matérielle n'est inventée : chaque tracker est intégré à partir de sa documentation réelle.

## 5. Hors périmètre MVP

Enchères, financement, assurance, pièces détachées, maintenance, livraison, assistant IA, satellite, caméras partenaires, bateaux, avions, API partenaires publiques.
