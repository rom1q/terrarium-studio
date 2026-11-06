# Terrarium Studio

Configurateur web en cours de création pour concevoir un terrarium, visualiser son aménagement en 3D et, à terme, vérifier les besoins d'une espèce à partir de références documentées.

## Prototype

La première version propose une scène 3D manipulable, le choix du format et des dimensions, trois biotopes, quelques éléments de décor et une sélection d'espèces. Le volet de conformité est volontairement signalé comme incomplet : aucune exigence d'élevage n'est affirmée sans fiche d'espèce sourcée.

## Lancer le projet

Prérequis : Node.js 20.19+ ou 22.12+ et npm.

```powershell
npm install
npm run dev
```

Pour vérifier le build de production :

```powershell
npm run build
```

## Pistes de développement

- Ajouter des paramètres de placement et une sauvegarde de projets.
- Créer une base d'espèces avec sources, dates de vérification et niveaux de confiance.
- Implémenter un moteur de règles séparant les critères obligatoires, recommandés et inconnus.
- Ajouter une vue en plan et des exports de plans et de listes de matériel.

Les alertes futures devront rester explicables, citer leurs références et distinguer un manque de données d'une non-conformité confirmée. L'application ne remplace pas l'avis d'un vétérinaire spécialisé.
