# 🌑 AstroMoon

**AstroMoon** est un outil d'analyse sélénographique conçu pour les astrophotographes. Il permet de superposer des calques vectoriels précis sur vos propres photographies de la Lune pour identifier les formations géologiques et valider vos conditions de prise de vue.

<p align="center">
  <img src="assets/header.png" width="400">
</p>

## ✨ Fonctionnalités principales

- **Alignement Intelligent :** Superposition automatique des mers et des cratères majeurs selon la date et l'heure.
- **Synchronisation Temporelle :** Récupération automatique de la date via le nom du fichier ou les données EXIF de la photo.
- **Adaptation au Matériel :** Bascule rapide de l'orientation du calque selon l'utilisation d'un simple trépied ou d'une monture équatoriale.
- **Visualisation de la Phase :** Affichage dynamique du terminateur (ligne de séparation jour/nuit).

## 🧪 Tester l'application

Vous n'avez pas de photo de la Lune sous la main ? Des clichés de test sont disponibles dans le dossier `/assets`.
Remerciement à **Maxime Goyard** pour ces clichés.

1. **Téléchargez** une image depuis le dossier `/assets`.
2. **Glissez-déposez** le fichier dans **AstroMoon**.
3. **Synchronisation :** Le widget temporel détectera automatiquement la date et l'heure grâce au nom du fichier.
4. **Localisation :** Pour ces clichés de test, assurez-vous de régler manuellement le lieu sur **Thionville** afin d'obtenir un alignement parfait du calque.

## 📚 Ressources et Sources

Le projet s'appuie sur des outils et des données de référence :

- **Préparation des données :** [QGIS](https://qgis.org/), le système d'information géographique open source.
- **Données Géologiques :** Cartographie issue de l'[USGS (Unified Geologic Map of the Moon)](https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020).
- **Moteur Astronomique :** Calculs de position et de libration via la bibliothèque [Astronomy.js](https://github.com/cosinekitty/astronomy).

## 🚀 Suite du projet

Le développement d'**AstroMoon** se poursuit avec les axes suivants :
- **Optimisation :** Amélioration de la fluidité de l'interface et du rendu des calques.
- **Sauvegarde :** Mise en place d'un système pour enregistrer vos sessions de travail.
- **Résolution :** Meilleure gestion du changement de taille des images importées.
- **Enrichissement :** Ajout d'informations détaillées sur les formations lunaires lors du survol.

---

### 💬 Suggestions
Le projet est en phase bêta. Si vous avez des idées d'amélioration ou des retours sur l'utilisation d'**AstroMoon**, n'hésitez pas à en faire part !

---

*Bon ciel à tous !* 🔭