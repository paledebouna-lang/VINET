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

- **Hébergement, nom de domaine et e-mails :** LWS (lws.fr), en France, sur un VPS déjà utilisé par d'autres sites.
- **Ventes sans paiement en ligne :** mise en relation seulement ; le paiement arrive avec la location au lot 3.
- **Réponses juridiques du 10 novembre 2026** (détail dans la section 8 du document) :
  - MonAuto est un intermédiaire ; le contrat lie le loueur et le locataire.
  - Tout véhicule mis en location est équipé d'un GPS par son propriétaire.
  - Le propriétaire fournit une attestation d'assurance pour louer entre particuliers.
  - Le droit d'annulation du consommateur s'applique aux réservations en ligne.
  - Les durées de conservation des positions sont retenues telles que proposées.
  - L'hébergement hors de Côte d'Ivoire et la transmission aux autorités sont permis.

### Reste à décider

1. **Préparation du VPS.** Le site sera installé sur le VPS LWS existant, à côté des autres sites, comme un service séparé. Il faut connaître son système, son serveur web, son éventuel panneau de gestion et sa mémoire libre. Bloque la mise en ligne.
2. **SMS pour les codes de connexion.** LWS vend des SMS par API, à crédits ; la couverture et le prix pour la Côte d'Ivoire sont à confirmer. Bloque la connexion par téléphone en production.

4. **Paiement en ligne des locations.** Deux voies : le locataire paie toute la location en ligne, et MonAuto reverse au loueur ; ou il ne paie en ligne que les frais de service de MonAuto, le reste étant réglé au loueur au départ. La seconde évite à MonAuto de détenir l'argent d'un tiers. Il faut aussi fixer le taux de commission.

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

Fait, sans paiement en ligne :

- **Matricule MonAuto**, attribué automatiquement à chaque compte dès l'inscription : `MA-E-000123` pour un vendeur rattaché à une entreprise, `MA-P-000123` pour un particulier. Le numéro ne change jamais ; la lettre suit la présence d'une entreprise. Il n'apparaît pas sur les annonces.
- **Identité du vendeur**, demandée avant le premier dépôt : nom et prénoms obligatoires ; entreprise, fonction et années d'expérience facultatives. Ni téléphone ni e-mail ne sont affichés. Un administrateur valide l'identité ; toute modification la remet en vérification.
- **Dépôt d'annonce** avec 1 à 8 photos et contrôle de cohérence (année, kilométrage, prix, numéro de série).
- **Modification d'une annonce** par son vendeur, photos comprises. Une annonce modifiée repasse par la validation.
- Photos réencodées à l'envoi : la position GPS enregistrée par le téléphone est retirée.
- Seule la commune est publique ; le numéro de série n'apparaît que masqué.
- **Modération** : rien n'est en ligne avant la décision d'un administrateur ; un refus est motivé ; chaque décision est journalisée.
- **Recherche** par marque ou modèle, catégorie, commune et budget.
- **Messagerie interne** : acheteur et vendeur échangent sur le site, sans jamais voir les coordonnées de l'autre. Seuls les deux interlocuteurs lisent une conversation. Les numéros de téléphone et les e-mails écrits dans un message ou dans une description sont masqués. L'e-mail de notification ne contient ni le message ni un contact.
- **Notifications par e-mail** : un compte créé par téléphone peut ajouter une adresse e-mail vérifiée par code.
- **Alerte de prix** : mettre une annonce en favori, c'est suivre son prix. Une baisse est signalée dans les favoris, sur l'annonce et par e-mail.
- **Comparaison** de deux à quatre favoris, côte à côte.
- Signalement d'une annonce, retrait par le vendeur ou par un administrateur.

Reste à faire :

- Notifications par SMS pour les comptes sans e-mail : il faut un compte SMS chez LWS et ses identifiants.
- Le masquage ne reconnaît pas un numéro écrit en toutes lettres.
- Les réponses dans une conversation apparaissent au plus tard après 15 secondes, pas instantanément.

Sortie : une annonce passe de la création à la publication modérée et reçoit une demande. Vérifié en local.

### Lot 3 — Location basique

Fait, sans paiement en ligne :

- **Annonce de location** : prix par jour, dépôt de garantie, kilomètres inclus, zone autorisée. Elle est refusée sans GPS déclaré (marque et numéro de série) et sans photo de l'attestation d'assurance. Le numéro du GPS et l'attestation ne sont vus que par l'équipe.
- **Demande de réservation** par le locataire : dates, nom du conducteur, numéro et photo du permis. Le jour du départ et le jour du retour sont comptés. Les jours déjà pris sont affichés et ne peuvent pas être réservés deux fois.
- **Réponse du loueur** : il voit le conducteur et son permis, puis accepte ou refuse.
- **Contrat** figé à l'acceptation, signé par les deux parties. Le locataire accepte séparément la géolocalisation. Chaque signature est journalisée avec la date, l'adresse réseau et l'empreinte du texte signé.
- **États des lieux** (AVS Rental Check) : au départ puis au retour, le loueur enregistre kilométrage, carburant, photos, remarques et remise du dépôt ; le locataire confirme. Le départ confirmé démarre la location, le retour confirmé la clôture.
- **Bilan de clôture** : distance parcourue, dépassement des kilomètres inclus, retard.
- **Annulation** sans frais par l'une ou l'autre partie tant que le véhicule n'est pas parti.
- Permis, attestations et photos d'état des lieux ne sont visibles que des deux parties et de l'équipe.

Reste à faire :

- **Paiement en ligne par CinetPay.** Aujourd'hui le contrat prévoit que le prix et le dépôt se règlent entre loueur et locataire au départ. Il faut les identifiants CinetPay et décider ce qui se paie en ligne (voir « Reste à décider »).
- **Contrat à faire amender par le juriste** : c'est une première version, sans barème de retard ni de frais.
- Signature confirmée par un code à usage unique : dépend des SMS.
- Suivi GPS réel pendant la location : lot 6. Le lot 3 enregistre le GPS déclaré et le consentement.
- Location à l'heure, à la semaine ou au mois, avec chauffeur, prolongation : seule la location à la journée existe.
- Attestation d'assurance et permis en PDF : seules les photos sont acceptées.

Sortie : une location complète réservation → départ → retour → clôture, sans intervention technique. Vérifié en local.

### Lot 4 — Administration et support

Fait :

- **Espace d'administration** en quatre écrans, réservé aux administrateurs : modération, utilisateurs, demandes et litiges, journal.
- **Tableau de bord** : comptes, annonces en ligne, locations en cours, demandes en attente.
- **Utilisateurs** : recherche par nom, téléphone, e-mail ou matricule ; changement de rôle ; suspension et réactivation. Suspendre un compte le déconnecte partout, l'empêche de se reconnecter et retire ses annonces. Un administrateur ne peut ni changer son propre rôle ni se suspendre.
- **Aide** : tout membre écrit à l'équipe depuis « Aide et assistance » et y lit la réponse, aussi envoyée par e-mail.
- **Litiges de location** : une des deux parties signale un problème depuis la page de la location. L'équipe consulte alors le contrat, les états des lieux et les échanges entre les deux parties, puis répond ; les deux parties voient la réponse.
- **Journal d'audit** consultable et filtrable : connexions, décisions de modération, rôles, suspensions, signatures, étapes des locations, réponses de l'équipe.

Reste à faire :

- **Double vérification des comptes agence et administrateur.** Le module de la bibliothèque d'authentification ne couvre pas la connexion par code : c'est un travail à part, à faire avant la mise en ligne.
- **Paiements** : rien à administrer tant que CinetPay n'est pas branché.
- **Pays et devises** : un seul pays et une seule devise pour le MVP ; le reste arrive au lot 10.
- Un litige se conclut par une réponse de l'équipe, sans remboursement ni pénalité automatiques.

Sortie : **MVP marketplace**. Les fonctions sont là et vérifiées en local ; la mise en ligne attend le VPS, les SMS, CinetPay et la double vérification.

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
