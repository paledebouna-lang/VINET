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

Fait :

- **Passeport AVS** : le propriétaire enregistre son véhicule (catégorie, marque, modèle, année, couleur, numéro de série, immatriculation) avec une photo de la carte grise. Le véhicule reçoit un identifiant AVS aléatoire, par exemple `AVS-CI-UKZB-EB6M-BH25`. Un même numéro de série ne peut pas avoir deux passeports.
- **Vérification** : un administrateur compare la carte grise et valide le passeport. La carte grise n'est vue que du propriétaire et de l'équipe.
- **Étiquette QR** à imprimer depuis la page du passeport ; l'impression ne sort que l'étiquette.
- **Page publique de vérification**, ouverte par le scan : description du véhicule, numéro de série et immatriculation masqués au milieu, propriété vérifiée ou non. Rien sur le propriétaire ni sur la position. Un identifiant que MonAuto n'a pas délivré est rejeté. La page n'est pas indexée par les moteurs de recherche.
- **Signalement après un scan**, réservé aux membres connectés : observation (« j'ai vu ce véhicule ici ») ou soupçon. La position du téléphone n'est jointe que si le déclarant coche la case, et elle est toujours présentée comme la position du déclarant, jamais comme celle du véhicule.
- Le propriétaire voit les observations sans l'identité du déclarant et en est prévenu par e-mail. Un soupçon ne va qu'à l'équipe, car il peut viser le propriétaire.
- **Annonce rattachée à un passeport** : elle affiche l'identifiant AVS et un lien de vérification. Le passeport garde l'historique des annonces et des états des lieux de location.

À savoir avant d'imprimer une étiquette : le QR contient l'adresse du site. Les étiquettes ne doivent être imprimées qu'une fois le site en ligne à son adresse définitive.

Écart avec le cahier des charges : le QR n'est pas « signé » par un calcul cryptographique. L'identifiant est tiré au hasard et enregistré côté serveur, ce qui donne la même garantie (un identifiant inconnu est rejeté) sans clé secrète dont la perte invaliderait toutes les étiquettes déjà collées.

Reste à faire :

- Statut « volé » ou « recherché » sur la page publique : il arrive avec la déclaration de vol vérifiée du lot 7.
- Une étiquette copiée sur un autre véhicule affiche la description du véhicule d'origine : c'est au lecteur de comparer. Étiquettes inviolables et second QR caché restent à étudier.
- Réparations déclarées et documents joints au passeport.
- Signalement sans compte.

Sortie : un scan affiche l'identité vérifiée et permet un signalement qualifié comme tel. Vérifié en local, sans lecture du QR par un vrai téléphone.

### Lot 6 — AVS Locate (GPS)

Fait, sans balise réelle :

- **Déclaration de la balise** sur le passeport du véhicule : marque, modèle, numéro de série ou IMEI. Le site délivre une clé propre à la balise, affichée une seule fois et conservée sous forme d'empreinte. La remplacer rend l'ancienne inutilisable.
- **Réception des positions** : la balise, ou la passerelle qui traduit son protocole, envoie ses positions par lots de 500 au plus, pour transmettre ce qu'elle a stocké hors couverture. Une position reçue deux fois est enregistrée une fois ; une position datée dans le futur ou de plus de 90 jours est écartée. Le format est décrit dans le README.
- **Carte et historique**, pour le propriétaire seul. « En direct » si la balise a transmis dans les deux dernières minutes, sinon « dernière position » avec son heure et un avertissement. Source, heure, précision et vitesse sont affichées. Les observations QR du lot 5 figurent sur la même carte, chacune avec sa forme et son libellé.
- **Zone autorisée** (un cercle) et **alertes** : sortie de zone, coupure d'alimentation de la balise. Une alerte n'est levée qu'au changement, pas à chaque position. Le propriétaire est prévenu par e-mail ; pendant une location rattachée au passeport, le locataire l'est aussi pour une sortie de zone.
- **Vue du parc** : véhicules suivis, en location, retours en retard, alertes à voir, balises silencieuses.
- **Durées de conservation** de la section 2 appliquées : positions supprimées après 90 jours, et 30 jours après la clôture pour celles enregistrées pendant une location.
- **Journal** : chaque consultation des positions est journalisée, une fois par heure et par personne.
- Ni l'équipe ni un locataire ne voient les positions, sauf l'équipe pendant un dossier de vol confirmé (lot 7).

Reste à faire :

- **Raccorder une balise réelle** : choisir le modèle, puis écrire la passerelle entre son protocole et l'adresse de réception. Il faut le modèle et sa documentation.
- **Relier l'annonce de location à la balise suivie** : le GPS déclaré sur l'annonce (lot 3) et la balise suivie sur le passeport sont deux déclarations séparées.
- **Fournisseur de fonds de carte** : ils viennent d'OpenStreetMap, dont les règles interdisent un trafic important et qui reçoit la zone consultée. À remplacer par un fournisseur sous contrat avant l'ouverture.
- Limite de débit par balise sur l'adresse de réception.
- La purge des anciennes positions se fait quand la balise transmet ; une tâche planifiée est à mettre en place au déploiement.
- Alertes de remorquage, de vitesse et d'immobilisation : dépendent des capacités de la balise. Alertes par SMS : dépendent du compte SMS.

Sortie : un propriétaire suit un véhicule et reçoit une alerte de sortie de zone. Vérifié en local avec des positions simulées, hors location.

### Lot 7 — Security Center

Fait :

- **Déclaration de vol** par le propriétaire, depuis le passeport : date et heure, lieu, circonstances, numéro de plainte et photo du récépissé (facultatifs), et quatre engagements cochés un à un (propriété, autorisation de transmettre aux autorités, conséquences d'une fausse déclaration, ne pas récupérer le véhicule soi-même). Un seul dossier ouvert par véhicule ; trois déclarations en attente au plus par compte.
- **Confirmation humaine** : rien ne change en public tant qu'un membre de l'équipe n'a pas confirmé. La confirmation est refusée si la carte grise du passeport n'a pas été vérifiée. Un refus exige un motif, transmis au déclarant.
- **À la confirmation** : la page de scan du QR affiche « Ce véhicule est déclaré volé » avec la consigne de ne confronter personne ; les annonces du véhicule sont retirées et ne peuvent pas être republiées ; le déclarant est prévenu par e-mail.
- **Centre de sécurité** (`/admin/securite`) : déclarations à confirmer, recherches actives, derniers dossiers traités.
- **Dossier** : déclaration, déclarant, véhicule et carte grise, location en cours éventuelle. Pendant la recherche seulement, l'équipe voit les positions GPS depuis la veille du vol, les signalements après scan avec leurs auteurs et les alertes, dans un tableau qui donne pour chaque ligne sa source et sa fiabilité, et sur la carte. Chaque consultation est journalisée. Chronologie complète, notes de travail réservées à l'équipe.
- **Le propriétaire** suit son dossier, ajoute des informations et signale que le véhicule est retrouvé ; il ne voit pas les notes de l'équipe. Sa page de suivi GPS lui rappelle de ne pas se rendre sur place.
- **Signalements pendant une recherche** : chaque nouveau signalement après scan prévient l'équipe par e-mail.
- **Transmission aux autorités** : l'équipe indique le destinataire et la référence de sa demande, ce qui est journalisé, puis imprime le dossier ou l'enregistre en PDF. Il contient le véhicule, la déclaration, les engagements, les positions et les signalements, sans l'identité des personnes qui ont signalé (communiquée sur réquisition) ni les notes de travail.
- **Clôture** avec son issue (retrouvé, non retrouvé, fausse déclaration) et un résumé transmis au propriétaire. Le véhicule n'est plus signalé volé et l'équipe n'a plus accès à ses positions.
- **Journal** : déclaration, confirmation, refus, transmission et clôture.

Reste à faire :

- Faire valider par le juriste la formule des engagements, en particulier « consulter et transmettre aux autorités ».
- Signature électronique ou cachet du dossier transmis : aujourd'hui une page imprimable, sans valeur de constat officiel.
- Procédure avec les autorités (à qui transmettre, sous quelle forme) : à établir pendant le pilote (lot 9).
- Alertes SMS à l'équipe : dépendent du compte SMS.
- La fausse déclaration se sanctionne à la main en suspendant le compte.

Sortie : un dossier de vol est ouvert, instruit et clos avec une trace complète. Vérifié en local de bout en bout (52 contrôles), avec des positions simulées.

### Lot 8 — Prototype VINET

Fait, côté serveur, sans balise ni détecteur réels :

- **Identifiant tournant** selon le standard publié Eddystone-EID (Google) : la balise diffuse un identifiant qui change toutes les 2^K secondes ; seul MonAuto, qui détient la clé, sait le relier au véhicule. Le calcul est vérifié sur des valeurs produites par une réimplémentation indépendante de l'outil de référence de Google.
- **Enregistrement de la balise** par le propriétaire, sur la page de suivi du véhicule, avec quatre valeurs relevées au même moment dans l'outil de configuration de la balise ; l'identifiant diffusé prouve que la clé et l'horloge ont été recopiées correctement. La clé est chiffrée en base (`VINET_SECRET`) et n'est jamais réaffichée. Une même balise ne peut pas être rattachée à deux véhicules. Retirer la balise efface ses détections.
- **Détecteurs partenaires** créés par l'équipe (`/admin/detecteurs`), chacun avec sa clé, affichée une fois et révocable.
- **Serveur d'événements** (`/api/vinet/detections`, format dans le README). Anti-abus : clé de détecteur obligatoire, 5 000 détections par heure et par détecteur, identifiant accepté seulement autour de son heure de validité (un identifiant capté puis rejoué plus tard est ignoré), doublons ignorés. Les identifiants qui n'appartiennent à aucune balise enregistrée ne sont pas conservés.
- **Dernière détection sur la carte** avec sa zone probable (un cercle) et sa qualité : « moyenne » avec un seul détecteur, « bonne » quand un deuxième détecteur proche la confirme dans le quart d'heure. Visible du propriétaire, et de l'équipe pendant un dossier de vol confirmé (tableau des sources, carte, dossier imprimable sans le nom des détecteurs). L'équipe est prévenue par e-mail quand un véhicule volé est détecté, au plus une fois par heure.
- Détections supprimées après 90 jours, comme les positions GPS.

Reste à faire :

- **Choisir une balise réelle** compatible Eddystone-EID, avec un outil de configuration qui affiche la clé d'identité, le compteur et l'identifiant diffusé. Il faut le modèle et sa documentation.
- **Détecteur partenaire** : passerelle Bluetooth (boîtier fixe) ou application de téléphone, qui capte les identifiants et les envoie au format du README. À choisir avec les partenaires ; le site ne peut pas écouter le Bluetooth depuis un navigateur sur iPhone.
- **Tests terrain** de portée et de fiabilité : la portée retenue pour le rayon (50 m) est une hypothèse à remplacer par la valeur mesurée.
- Retrouver une balise dont l'horloge a dérivé de plus de quelques minutes ou s'est remise à zéro (changement de pile) : aujourd'hui il faut la réenregistrer.
- Enregistrement par échange de clés (méthode plus sûre du standard) si la balise retenue le permet.
- Au-delà de quelques milliers de balises, précalculer les identifiants attendus au lieu de les recalculer à chaque détection.

Sortie : une dernière détection apparaît sur la carte avec rayon et qualité. Vérifié en local de bout en bout (33 contrôles) avec un détecteur simulé et des identifiants calculés par l'implémentation de référence ; pas encore avec une balise réelle.

### Lot 9 — Pilote Côte d'Ivoire

Fait :

- **Plan du pilote et procédures**, dans un document partagé que l'équipe et le juriste peuvent modifier : objet et chiffres proposés, sélection des agences, véhicules volontaires et accord des propriétaires, procédure vol pour l'équipe (avec son schéma), support et litiges, indicateurs et cibles proposées, liste de ce qui bloque avant le lancement.
- **Page Pilote** dans l'administration (`/admin/pilote`) : indicateurs depuis une date choisie (90 derniers jours par défaut). Activité, délai de modération, réponses sous 24 h, locations signées et terminées avec leurs états des lieux, support, passeports vérifiés, balises GPS qui transmettent, signalements, détections VINET, dossiers de vol et délai de confirmation. Elle compte aussi les consultations de positions par l'équipe hors d'un dossier de vol confirmé, qui doivent rester à zéro.
- Une annonce modifiée garde sa date de soumission à la modération, pour que le délai de modération soit juste.

Reste à faire, avant le lancement (le détail est dans le plan du pilote) :

- **Mettre le site en ligne** sur le VPS : il faut le système, le serveur web ou le panneau de contrôle, la mémoire libre et un accès. Puis installation, sauvegardes, HTTPS et la tâche planifiée qui supprime les anciennes données.
- Décider de la **double vérification** des comptes administrateur et agence (recommandée).
- Choisir la **balise GPS** réelle et le **fournisseur de fonds de carte**.
- Faire relire par le juriste le contrat de location, les engagements de vol, la lettre d'engagement des agences et l'accord des propriétaires.
- Valider les chiffres et les cibles du plan, choisir les agences, former l'équipe.

Sortie : le pilote peut démarrer dès que le site est en ligne et que les blocages listés sont levés ; ses résultats se lisent sur la page Pilote.

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
