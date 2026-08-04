# Guide d'installation — Vérification des licences côté serveur

## Étape 1 : Créer le Google Sheet

1. Va sur [sheets.google.com](https://sheets.google.com) et crée une nouvelle feuille.
2. Renomme l'onglet en bas en **Clients** (exactement ce nom, sans majuscule différente).
3. Dans la première ligne, mets les en-têtes :
   - A1 : `Email`
   - B1 : `Code`
   - C1 : `Ecole`
4. Pour chaque client déjà activé (ou nouveau), ajoute une ligne : son email, le code que tu lui donnes, le nom exact de son école.

## Étape 2 : Installer le script serveur

1. Dans ton Google Sheet, va dans le menu **Extensions > Apps Script**.
2. Supprime le contenu par défaut (`function myFunction() {...}`) et colle à la place tout le contenu du fichier **Code.gs** que je t'ai fourni.
3. Clique sur l'icône de sauvegarde (💾) en haut.

## Étape 3 : Déployer comme application Web

1. En haut à droite, clique sur **Déployer > Nouveau déploiement**.
2. Clique sur l'icône ⚙️ à côté de "Sélectionner le type" et choisis **Application Web**.
3. Configure :
   - **Exécuter en tant que** : Moi (ton compte)
   - **Qui a accès** : Tout le monde
4. Clique sur **Déployer**.
5. Google va te demander d'autoriser l'accès à ton compte — accepte (c'est ton propre script, sur ta propre feuille).
6. Une **URL** va s'afficher, du type :
   `https://script.google.com/macros/s/AKfycb.../exec`
   **Copie cette URL en entier.**

## Étape 4 : Connecter l'application à ce script

Envoie-moi cette URL (ou colle-la toi-même) : dans le fichier `app.min.js`, remplace le texte
`COLLE_ICI_TON_URL_APPS_SCRIPT`
par l'URL complète que tu as copiée.

## Étape 5 : Tester

1. Ouvre l'URL directement dans ton navigateur en ajoutant à la fin :
   `?email=test@test.com&code=TEST&ecole=Test`
   Tu dois voir apparaître `{"valide":false}` — c'est normal, ce triplet n'existe pas dans ton Sheet.
2. Ajoute une vraie ligne de test dans ton Sheet (ex: ton propre email, un code, une école), refais le test avec ces valeurs dans l'URL — tu dois voir `{"valide":true}`.
3. Une fois confirmé, teste directement dans l'application avec le formulaire d'activation.

## Comment ajouter un nouveau client par la suite

1. Le client te contacte et te paie.
2. Tu ouvres l'admin panel de l'app (code maître `Juillet_27`), tu saisis son email + nom d'école : un code est suggéré, et une ligne "à copier dans le Sheet" apparaît.
3. Tu ouvres ton Google Sheet sur ton téléphone (appli Google Sheets) et tu ajoutes cette ligne (Email, Code, Ecole).
4. Tu envoies le code au client par SMS/WhatsApp.
5. Le client active l'app avec son email + ce code + le nom de son école. Ça marche instantanément (connexion internet nécessaire une seule fois, à l'activation).

## Important à savoir

- **Cette vérification n'a plus rien à voir avec le formulaire local d'avant** : même si quelqu'un lit tout le code JavaScript de l'app, il ne pourra plus deviner de code valide, puisque la seule source de vérité est ton Google Sheet, jamais exposée publiquement.
- Une même combinaison email + code + école peut être activée sur **plusieurs appareils** (comme demandé), tant que les 3 valeurs correspondent exactement à une ligne du Sheet.
- Pour révoquer un client, supprime simplement sa ligne du Sheet — les appareils déjà activés avant continueront de fonctionner hors-ligne (ils ont mis en cache la validation), mais toute nouvelle activation avec ce code échouera.
