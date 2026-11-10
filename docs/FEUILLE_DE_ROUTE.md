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

### Reste à décider avant le lot 1

1. **Périmètre du MVP.** Proposé : voitures, motos, utilitaires ; Abidjan ; français, anglais prêt mais non traduit.
2. **Paiement.** Choix du ou des prestataires (mobile money, carte) et décision sur le séquestre.
3. **Juridique.** Protection des données de localisation, contrat de location électronique, mentions de transfert de propriété. Avis local requis avant lancement.

Sortie : décisions écrites, périmètre MVP figé.

## 3. Lots de réalisation

### Lot 1 — Fondations
- Monolithe modulaire (NestJS, PostgreSQL/PostGIS), site Next.js, CI, environnements.
- Comptes, authentification (téléphone + OTP, e-mail), MFA pour les comptes sensibles.
- Rôles MVP : visiteur, acheteur/locataire, vendeur, agence, administrateur. Journal d'audit.
- Modèle de données : utilisateur, organisation, véhicule, annonce, réservation, location, contrat, paiement, inspection.
  Les tables passeport AVS et événement de position sont prévues dès le schéma, même vides.
- Design system issu de la maquette validée.

Sortie : un utilisateur crée un compte, se connecte, voit une page d'accueil vide mais réelle.

### Lot 2 — Vente
- Création d'annonce avec photos, contrôle de cohérence, VIN à visibilité contrôlée, localisation approximative.
- Recherche, filtres, favoris, contact sécurisé, signalement d'annonce.
- Vérification du vendeur, file de modération.

Sortie : une annonce passe de la création à la publication modérée et reçoit une demande.

### Lot 3 — Location basique
- Calendrier, tarifs, réservation, dépôt de garantie, paiement.
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
