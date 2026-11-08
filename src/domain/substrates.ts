import type { Biotope } from "./projectLogic";

export type SubstrateTexture = "fine-sand" | "gravel" | "soil" | "bark" | "moss";
export type SubstrateScatter = { shape: "pebble" | "chunk" | "tuft"; colors: readonly number[]; size: number; density: number };
export type SubstrateProfile = {
  description: string;
  drainage: "Rapide" | "Moyen" | "Lent";
  moisture: "Faible" | "Moyenne" | "Élevée";
  color: number;
  roughness: number;
  texture: SubstrateTexture;
  scatter?: SubstrateScatter;
};

export const substrateCatalog = {
  "Sable fin": {
    description: "Sable fin et sec, aspect dunaire. Draine vite et retient très peu d’humidité.",
    drainage: "Rapide", moisture: "Faible", color: 0xd2b27b, roughness: 0.96, texture: "fine-sand",
  },
  "Mélange sable-argile": {
    description: "Mélange compactable qui permet de modeler des reliefs stables. Sèche lentement en surface.",
    drainage: "Moyen", moisture: "Faible", color: 0xb98d5f, roughness: 0.94, texture: "soil",
  },
  "Gravier fin": {
    description: "Petits graviers roulés, très drainants et stables. Surface irrégulière de type reg.",
    drainage: "Rapide", moisture: "Faible", color: 0xa59b8b, roughness: 0.9, texture: "gravel",
    scatter: { shape: "pebble", colors: [0x8d8576, 0xb4a995, 0x7a7266, 0xc2b8a3], size: 0.022, density: 520 },
  },
  "Argile rouge": {
    description: "Terre argileuse ocre-rouge, compacte et sèche. Rendu de sol aride et fissuré.",
    drainage: "Lent", moisture: "Faible", color: 0x94644a, roughness: 0.97, texture: "soil",
  },
  "Terreau tropical": {
    description: "Terreau organique aéré, brun foncé. Garde l’humidité tout en restant drainant.",
    drainage: "Moyen", moisture: "Élevée", color: 0x5a4331, roughness: 0.98, texture: "soil",
    scatter: { shape: "chunk", colors: [0x6b4c34, 0x45331f, 0x7a5a3d], size: 0.016, density: 160 },
  },
  "Fibre de coco": {
    description: "Fibres de coco brun chaud. Retient bien l’eau et garde une structure aérée.",
    drainage: "Moyen", moisture: "Élevée", color: 0x7a5636, roughness: 1, texture: "bark",
    scatter: { shape: "chunk", colors: [0x8a6240, 0x6d4a2d, 0x9a7249], size: 0.014, density: 300 },
  },
  "Écorce de pin": {
    description: "Morceaux d’écorce drainants, aspect sous-bois. Sèche plus vite qu’un terreau.",
    drainage: "Rapide", moisture: "Moyenne", color: 0x7a5236, roughness: 0.96, texture: "bark",
    scatter: { shape: "chunk", colors: [0x8f6140, 0x6a4529, 0xa4724c, 0x7a5236], size: 0.052, density: 320 },
  },
  "Mousse sphaigne": {
    description: "Mousse pâle qui retient fortement l’humidité; rendu de litière de sous-bois humide.",
    drainage: "Lent", moisture: "Élevée", color: 0x8c8a52, roughness: 1, texture: "moss",
    scatter: { shape: "tuft", colors: [0xa3a05f, 0x8a8a4c, 0xb7b06c], size: 0.03, density: 340 },
  },
  "Terreau humide": {
    description: "Terreau sombre gorgé d’humidité pour la partie terrestre. Retient l’eau longtemps.",
    drainage: "Lent", moisture: "Élevée", color: 0x41301f, roughness: 0.99, texture: "soil",
  },
  "Argile expansée": {
    description: "Billes d’argile orangées, légères et stables. Couche drainante idéale près de l’eau.",
    drainage: "Rapide", moisture: "Moyenne", color: 0xa4613b, roughness: 0.92, texture: "gravel",
    scatter: { shape: "pebble", colors: [0xb36f43, 0x9a5733, 0xc58253], size: 0.03, density: 360 },
  },
  "Gravier de rivière": {
    description: "Galets roulés gris-beige pour les berges et le fond. Stable et facile à rincer.",
    drainage: "Rapide", moisture: "Moyenne", color: 0x877f72, roughness: 0.86, texture: "gravel",
    scatter: { shape: "pebble", colors: [0x938a7a, 0x6f695f, 0xa89f8e, 0x7d7569], size: 0.04, density: 300 },
  },
  "Tapis de mousse": {
    description: "Couche de mousse verte pour la zone humide; apparence naturelle de berge.",
    drainage: "Lent", moisture: "Élevée", color: 0x4f6a35, roughness: 1, texture: "moss",
    scatter: { shape: "tuft", colors: [0x5f8040, 0x4a6a30, 0x759a4c], size: 0.035, density: 420 },
  },
} as const satisfies Record<string, SubstrateProfile>;

export type Substrate = keyof typeof substrateCatalog;

export const substratesByBiotope: Record<Biotope, readonly Substrate[]> = {
  Désertique: ["Sable fin", "Mélange sable-argile", "Gravier fin", "Argile rouge"],
  Tropical: ["Terreau tropical", "Fibre de coco", "Écorce de pin", "Mousse sphaigne"],
  Paludarium: ["Terreau humide", "Argile expansée", "Gravier de rivière", "Tapis de mousse"],
};

export function isKnownSubstrate(value: unknown): value is Substrate {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(substrateCatalog, value);
}

export function getDefaultSubstrate(biotope: Biotope): Substrate {
  return substratesByBiotope[biotope][0];
}

export function isSubstrateAvailable(substrate: Substrate | undefined, biotope: Biotope): substrate is Substrate {
  return substrate !== undefined && substratesByBiotope[biotope].includes(substrate);
}

export function normalizeSubstrate(substrate: Substrate | undefined, biotope: Biotope): Substrate | undefined {
  return isSubstrateAvailable(substrate, biotope) ? substrate : undefined;
}

export function resolveSubstrate(substrate: Substrate | undefined, biotope: Biotope): Substrate {
  return normalizeSubstrate(substrate, biotope) ?? getDefaultSubstrate(biotope);
}
