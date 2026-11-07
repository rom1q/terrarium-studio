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
      juvenile: "Les jeunes dragons ont besoin d’une plus grande part de proies; la part de végétaux augmente avec l’âge. La RSPCA indique deux repas par jour pour les bébés et un pour les juvéniles.",
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
    minimumDimensions: { width: 46, depth: 46, height: 61 },
    referenceRanges: { hotSideTemperature: [23.9, 26.7], coolSideTemperature: [21.1, 23.9], baskingUvi: [1, 2], coolSideHumidity: [60, 80] },
    hidesAtBothEnds: null,
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
    minimumDimensions: null,
    dimensionGuidance: "La longueur du vivarium doit au moins égaler celle du serpent; largeur et hauteur : au moins un tiers de sa longueur (exemple RSPCA : 150 × 50 × 50 cm pour un serpent de 150 cm).",
    environmentGuidance: "La RSPCA indique aussi 16–20 °C la nuit et un gradient UV jusqu’à UVI 1; pour les morphes albinos, le maximum indiqué est UVI 0,7.",
    referenceRanges: { hotSideTemperature: [28, 30], coolSideTemperature: [20, 24], baskingUvi: [1, 1], coolSideHumidity: [40, 50] },
    hidesAtBothEnds: null,
  },
  {
    label: "Python regius · Python royal",
    scientificName: "Python regius",
    commonName: "Python royal",
    source: { title: "Keeping a royal python as a pet", publisher: "RSPCA", url: "https://www.rspca.org.uk/adviceandwelfare/pets/other/royalpython", checkedAt: "2026-11-07" },
    minimumDimensions: null,
    dimensionGuidance: "La longueur du vivarium doit au moins égaler celle du serpent; largeur et hauteur : au moins un tiers de sa longueur (exemple RSPCA : 120 × 40 × 40 cm pour un serpent de 120 cm).",
    environmentGuidance: "La RSPCA recommande un refuge humide et une hausse temporaire de l’humidité vers 80 % après brumisation, puis une baisse.",
    referenceRanges: { hotSideTemperature: [30, 32], coolSideTemperature: [24, 26], baskingUvi: [1, 1], coolSideHumidity: [50, 60] },
    hidesAtBothEnds: null,
  },
];

export const speciesLabels = speciesCatalog.map((species) => species.label);