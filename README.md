# Terrarium Studio

Configurateur web pour concevoir un terrarium, visualiser son aménagement en 3D et comparer certains paramètres d'habitat à des références documentées.

## Fonctionnalités

- Scène 3D manipulable, formats et dimensions, trois biotopes, décor et plantes.
- Projets enregistrés localement, import/export JSON, historique annulable et points de restauration nommés.
- Vue en plan cotée, rapport imprimable et vérifications d'implantation.
- Catalogue de six espèces. Cinq fiches ont une référence consultée; le dendrobate n'a pas encore de source de maintenance vérifiée.
- Les critères non documentés restent inconnus. Le bilan ne certifie pas un habitat et ne remplace pas l'avis d'un vétérinaire spécialisé.

## Lancer le projet

Prérequis : Node.js 20.19+ ou 22.12+ et npm.

Sous Windows, double-cliquez sur `start-terrarium.cmd` pour installer les dépendances manquantes, lancer le serveur de développement et ouvrir l’application dans le navigateur par défaut.

```powershell
npm install
npm run dev
```

Pour lancer les tests unitaires :

```powershell
npm test
```

Pour lancer les tests navigateur Playwright, installez Chromium une première fois :

```powershell
npx playwright install chromium
npm run test:e2e
```

Pour vérifier le build de production :

```powershell
npm run build
```

## À poursuivre

- Ajouter des fiches d'espèces et des étapes de vie à partir de références spécifiques et vérifiables.
- Étendre les tests navigateur aux workflows d'édition, d'import/export et de rapport.

Les alertes doivent rester explicables, citer leurs références et distinguer un manque de données d'une non-conformité confirmée.
