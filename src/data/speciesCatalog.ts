import type { SpeciesProfile } from "../domain/projectLogic";

export const speciesCatalog: SpeciesProfile[] = [
  {
    label: "Pogona vitticeps · Dragon barbu",
    scientificName: "Pogona vitticeps",
    commonName: "Dragon barbu",
    source: { title: "Caring for your bearded dragon", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/beardeddragon", checkedAt: "2026-11-07" },
    biotopeGuidance: {
      Désertique: { status: "compatible", detail: "La RSPCA décrit un habitat d’origine sec et recommande 30–40 % d’humidité." },
      Tropical: { status: "incompatible", detail: "La RSPCA décrit un habitat sec et une humidité basse (30–40 %)." },
      Paludarium: { status: "incompatible", detail: "La RSPCA recommande un habitat sec, bien ventilé et à faible humidité (30–40 %)." },
    },
    stageGuidance: {
      hatchling: "La RSPCA indique deux repas par jour pour les bébés dragons barbus.",
      juvenile: "La RSPCA indique un repas par jour pour les juvéniles; la part de végétaux augmente avec l’âge.",
      adult: "La RSPCA indique un repas par jour; pour les dragons de plus de 30 cm, elle recommande environ 40 % de proies et 60 % de végétaux.",
    },
    minimumDimensions: { width: 120, depth: 60, height: 60 },
    referenceRanges: { hotSideTemperature: [38, 42], coolSideTemperature: [22, 26], baskingUvi: [3, 5], coolSideHumidity: [30, 40] },
    hidesAtBothEnds: true,
  },
  {
    label: "Eublepharis macularius · Gecko léopard",
    scientificName: "Eublepharis macularius",
    commonName: "Gecko léopard",
    source: { title: "Leopard Gecko Care Guide", publisher: "ReptiFiles", url: "https://reptifiles.com/leopard-gecko-care/", checkedAt: "2026-11-07" },
    minimumDimensions: { width: 92, depth: 46, height: 46 },
    referenceRanges: { hotSideTemperature: [32.2, 35], coolSideTemperature: [22.2, 25], baskingUvi: [2, 3], coolSideHumidity: [30, 40] },
    hidesAtBothEnds: null,
    biotopeGuidance: {
      Désertique: { status: "compatible", detail: "ReptiFiles situe l’espèce en zones semi-désertiques et prairies arides, avec 30–40 % d’humidité." },
      Tropical: { status: "incompatible", detail: "Les repères ReptiFiles sont adaptés à un habitat aride et une humidité de 30–40 %." },
      Paludarium: { status: "incompatible", detail: "Les repères ReptiFiles indiquent un habitat aride et une humidité de 30–40 %, pas une configuration humide." },
    },
  },
  {
    label: "Correlophus ciliatus · Gecko à crête",
    scientificName: "Correlophus ciliatus",
    commonName: "Gecko à crête",
    source: { title: "Crested Gecko Care Guide", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko-care/", checkedAt: "2026-11-07" },
    minimumDimensions: { width: 45.72, depth: 45.72, height: 91.44 },
    referenceRanges: { hotSideTemperature: [23.9, 26.7], coolSideTemperature: [21.1, 23.9], baskingUvi: [1, 2], coolSideHumidity: [60, 80] },
    hidesAtBothEnds: null,
    stageProfiles: {
      hatchling: {
        minimumDimensions: { width: 30.48, depth: 30.48, height: 30.48 },
        dimensionGuidance: "Profil ReptiFiles pour hatchling de moins de 12 g.",
        referenceRanges: null,
        hidesAtBothEnds: null,
        environmentGuidance: "Sous 13 g, ReptiFiles recommande un éclairage UVB compact à faible intensité et un tapis chauffant contrôlé par thermostat; la température ne doit pas dépasser 29 °C. Aucun UVI minimal de hatchling n’est publié dans ce guide.",
        sources: [
          { title: "Enclosure Size & Cohabitation", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-terrarium-size-cohabitation", checkedAt: "2026-11-07" },
          { title: "Lighting, Heating & Humidity", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-temperatures-humidity", checkedAt: "2026-11-07" },
        ],
      },
      juvenile: {
        minimumDimensions: { width: 45.72, depth: 45.72, height: 91.44 },
        dimensionGuidance: "Profil ReptiFiles pour juvénile de plus de 12 g.",
        referenceRanges: { hotSideTemperature: [23.9, 26.7], coolSideTemperature: [21.1, 23.9], baskingUvi: [1, 2], coolSideHumidity: [60, 80] },
        hidesAtBothEnds: null,
        sources: [
          { title: "Enclosure Size & Cohabitation", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-terrarium-size-cohabitation", checkedAt: "2026-11-07" },
          { title: "Lighting, Heating & Humidity", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-temperatures-humidity", checkedAt: "2026-11-07" },
        ],
      },
      adult: {
        minimumDimensions: { width: 45.72, depth: 45.72, height: 91.44 },
        dimensionGuidance: "Profil ReptiFiles pour adulte de plus de 12 g.",
        referenceRanges: { hotSideTemperature: [23.9, 26.7], coolSideTemperature: [21.1, 23.9], baskingUvi: [1, 2], coolSideHumidity: [60, 80] },
        hidesAtBothEnds: null,
        sources: [
          { title: "Enclosure Size & Cohabitation", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-terrarium-size-cohabitation", checkedAt: "2026-11-07" },
          { title: "Lighting, Heating & Humidity", publisher: "ReptiFiles", url: "https://reptifiles.com/crested-gecko/care-guide/crested-gecko-temperatures-humidity", checkedAt: "2026-11-07" },
        ],
      },
    },
    biotopeGuidance: {
      Désertique: { status: "incompatible", detail: "ReptiFiles décrit une espèce arboricole de Nouvelle-Calédonie avec 60–80 % d’humidité." },
      Tropical: { status: "compatible", detail: "ReptiFiles décrit un gecko arboricole de Nouvelle-Calédonie avec une humidité de 60–80 %." },
    },
  },
  {
    label: "Dendrobates tinctorius · Dendrobate",
    scientificName: "Dendrobates tinctorius",
    commonName: "Dendrobate",
    source: null,
    minimumDimensions: null,
    referenceRanges: null,
    hidesAtBothEnds: null,
  },
  {
    label: "Pantherophis guttatus · Serpent des blés",
    scientificName: "Pantherophis guttatus",
    commonName: "Serpent des blés",
    source: { title: "Corn snake care", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/cornsnake", checkedAt: "2026-11-07" },
    stageGuidance: {
      hatchling: "La RSPCA indique un souriceau tous les 5–6 jours pour les nouveau-nés.",
      adult: "La RSPCA indique une souris adulte tous les 7–14 jours.",
    },
    minimumDimensions: null,
    dimensionGuidance: "La longueur du vivarium doit au moins égaler celle du serpent; profondeur et hauteur : au moins un tiers de sa longueur (exemple RSPCA : 150 × 50 × 50 cm pour un serpent de 150 cm).",
    environmentGuidance: "La RSPCA indique aussi 16–20 °C la nuit et un gradient UV jusqu’à UVI 1; pour les morphes albinos, le maximum indiqué est UVI 0,7.",
    referenceRanges: { hotSideTemperature: [28, 30], coolSideTemperature: [20, 24], baskingUvi: [1, 1], coolSideHumidity: [40, 50] },
    hidesAtBothEnds: true,
  },
  {
    label: "Python regius · Python royal",
    scientificName: "Python regius",
    commonName: "Python royal",
    source: { title: "Keeping a royal python as a pet", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/royalpython", checkedAt: "2026-11-07" },
    stageGuidance: {
      juvenile: "La RSPCA indique un repas tous les 5–6 jours pour les jeunes serpents.",
      adult: "La RSPCA indique un repas tous les 7–14 jours à l’âge adulte, selon le poids.",
    },
    minimumDimensions: null,
    dimensionGuidance: "La longueur du vivarium doit au moins égaler celle du serpent; profondeur et hauteur : au moins un tiers de sa longueur (exemple RSPCA : 120 × 40 × 40 cm pour un serpent de 120 cm).",
    environmentGuidance: "La RSPCA recommande un refuge humide et une hausse temporaire de l’humidité vers 80 % après brumisation, puis une baisse.",
    referenceRanges: { hotSideTemperature: [30, 32], coolSideTemperature: [24, 26], baskingUvi: [1, 1], coolSideHumidity: [50, 60] },
    hidesAtBothEnds: true,
  },
];

export const speciesLabels = speciesCatalog.map((species) => species.label);