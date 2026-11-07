import {
  Copy,
  Expand,
  GitBranch,
  Layers,
  Leaf,
  Lightbulb,
  Move,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import {
  getDecorationVariantsForBiotope,
  getDefaultDecorationVariant,
  getPlantBiotopeStatus,
  type Biotope,
  type DecorationAxis,
  type DecorationKind,
  type PositionedDecoration,
} from "../../domain/projectLogic";
import { getPlantProfile, plantBiotopeStatusLabels, plantCatalog } from "../../data/plantCatalog";

export function decorationKindClass(kind: DecorationKind) {
  return kind.toLowerCase().replace(/\s+/g, "-");
}

export function DecorationIcon({ kind, size }: { kind: DecorationKind; size: number }) {
  if (kind === "Plante") return <Leaf size={size} />;
  if (kind === "Cachette") return <Expand size={size} />;
  if (kind === "Branche") return <GitBranch size={size} />;
  if (kind === "Plateforme") return <Layers size={size} />;
  if (kind === "Gamelle") return <Waves size={size} />;
  if (kind === "Lampe chauffante") return <Sun size={size} />;
  if (kind === "Tube UVB") return <Lightbulb size={size} />;
  return <span className="rock-icon" />;
}

type DecorationPanelProps = {
  decorations: PositionedDecoration[];
  dimensions: { width: number; depth: number; height: number };
  biotope: Biotope;
  selectedDecorationId: number | null;
  viewMode: "3d" | "plan";
  transformMode: "translate" | "rotate";
  onAddDecoration: (kind: DecorationKind) => void;
  onSelectTransformMode: (mode: "translate" | "rotate") => void;
  onDuplicateSelected: () => void;
  onRemoveDecoration: (id: number) => void;
  onUpdatePosition: (id: number, axis: DecorationAxis, value: string) => void;
  onUpdateSize: (id: number, value: string) => void;
  onUpdateRotation: (id: number, value: string) => void;
  onUpdateVariant: (id: number, variant: string) => void;
  onUpdatePlantSpecies: (id: number, plantSpeciesId: string) => void;
  onFinishNumericEdit: () => void;
};

export function DecorationPanel({
  decorations,
  dimensions,
  biotope,
  selectedDecorationId,
  viewMode,
  transformMode,
  onAddDecoration,
  onSelectTransformMode,
  onDuplicateSelected,
  onRemoveDecoration,
  onUpdatePosition,
  onUpdateSize,
  onUpdateRotation,
  onUpdateVariant,
  onUpdatePlantSpecies,
  onFinishNumericEdit,
}: DecorationPanelProps) {
  const plantOptions = [...plantCatalog].sort((first, second) => {
    const priority = { recommended: 0, unknown: 1, "not-recommended": 2 };
    return priority[getPlantBiotopeStatus(first, biotope)] - priority[getPlantBiotopeStatus(second, biotope)];
  });

  return (
    <section className="form-section decor-section">
      <div className="section-title"><span>03</span><h2>Le décor</h2><span className="count-pill">{decorations.length}</span></div>
      <div className="decor-tools">
        <button type="button" onClick={() => onAddDecoration("Plante")}><Plus size={14} /><Leaf size={15} /> Plante</button>
        <button type="button" onClick={() => onAddDecoration("Cachette")}><Plus size={14} /><Expand size={14} /> Cachette</button>
        <button type="button" onClick={() => onAddDecoration("Roche")}><Plus size={14} /><span className="rock-icon" /> Roche</button>
        <button type="button" onClick={() => onAddDecoration("Branche")}><Plus size={14} /><GitBranch size={14} /> Branche</button>
        <button type="button" onClick={() => onAddDecoration("Plateforme")}><Plus size={14} /><Layers size={14} /> Plate-forme</button>
        <button type="button" onClick={() => onAddDecoration("Gamelle")}><Plus size={14} /><Waves size={14} /> Gamelle</button>
        <button type="button" onClick={() => onAddDecoration("Lampe chauffante")}><Plus size={14} /><Sun size={14} /> Lampe</button>
        <button type="button" onClick={() => onAddDecoration("Tube UVB")}><Plus size={14} /><Lightbulb size={14} /> Tube UVB</button>
      </div>
      <p className="decor-variant-note">Variantes visuelles uniquement; vérifiez la compatibilité des matériaux avec l’espèce.</p>
      <div className="decor-list">
        {decorations.map((item, index) => {
          const selectedVariant = item.variant ?? getDefaultDecorationVariant(item.kind, biotope);
          const variantOptions = getDecorationVariantsForBiotope(item.kind, biotope);
          const variantIsSuggested = variantOptions.includes(selectedVariant);
          const plantProfile = item.kind === "Plante" ? getPlantProfile(item.plantSpeciesId) : undefined;
          const plantBiotopeStatus = plantProfile ? getPlantBiotopeStatus(plantProfile, biotope) : undefined;
          return <div className={`decor-item ${selectedDecorationId === item.id ? "selected" : ""}`} key={item.id}>
            <span className={`decor-swatch swatch-${decorationKindClass(item.kind)}`}><DecorationIcon kind={item.kind} size={14} /></span>
            <div className="decor-editor">
              <div className="decor-item-heading"><span>{item.kind} · {item.variant ?? getDefaultDecorationVariant(item.kind, biotope)} <small>{String(index + 1).padStart(2, "0")}</small></span><small className="decor-position">Paroi proche {item.nearestWallCm} cm</small></div>
              {selectedDecorationId === item.id && viewMode === "3d" && <div className="transform-tools" role="group" aria-label={`Outils pour ${item.kind}`}>
                <div className="transform-modes" role="group" aria-label="Mode de transformation">
                  <button type="button" className={transformMode === "translate" ? "active" : ""} aria-label="Déplacer" aria-pressed={transformMode === "translate"} title="Déplacer" onClick={() => onSelectTransformMode("translate")}><Move size={13} /></button>
                  <button type="button" className={transformMode === "rotate" ? "active" : ""} aria-label="Pivoter" aria-pressed={transformMode === "rotate"} title="Pivoter" onClick={() => onSelectTransformMode("rotate")}><RotateCcw size={13} /></button>
                </div>
                <button type="button" aria-label="Dupliquer" title="Dupliquer" onClick={onDuplicateSelected}><Copy size={13} /></button>
                <button type="button" className="transform-delete" aria-label="Supprimer" title="Supprimer" onClick={() => onRemoveDecoration(item.id)}><Trash2 size={13} /></button>
              </div>}
              {item.kind === "Plante" && <label className="decor-variant-control plant-species-control"><span>Espèce ({plantCatalog.length})</span><select aria-label={`Espèce botanique de la plante, ${plantCatalog.length} choix`} value={item.plantSpeciesId ?? ""} onChange={(event) => onUpdatePlantSpecies(item.id, event.target.value)}>
                <option value="">Style visuel uniquement</option>
                {(["recommended", "unknown", "not-recommended"] as const).map((status) => {
                  const plants = plantOptions.filter((plant) => getPlantBiotopeStatus(plant, biotope) === status);
                  if (plants.length === 0) return null;
                  const groupLabel = status === "recommended" ? `Conseillées · ${biotope}` : status === "unknown" ? "À vérifier" : "Peu adaptées à ce biotope";
                  return <optgroup key={status} label={groupLabel}>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.commonName} · {plant.scientificName}</option>)}</optgroup>;
                })}
              </select></label>}
              <label className="decor-variant-control"><span>Type</span><select aria-label={`Type de ${item.kind}`} value={selectedVariant} onChange={(event) => onUpdateVariant(item.id, event.target.value)}>{!variantIsSuggested && <option value={selectedVariant}>{selectedVariant} · non proposé pour {biotope.toLowerCase()}</option>}{variantOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              {item.kind === "Plante" && !plantProfile && <small className={`plant-variant-note ${variantIsSuggested ? "" : "not-suggested"}`}>{variantIsSuggested ? "Modèle visuel uniquement; choisissez une espèce botanique pour afficher ses besoins." : `Style non proposé pour le biotope ${biotope.toLowerCase()}.`}</small>}
              {plantProfile && plantBiotopeStatus && <div className={`plant-profile-note ${plantBiotopeStatus}`}><span>{plantProfile.scientificName} · {plantProfile.careSummary}</span><strong>Biotope {plantBiotopeStatusLabels[plantBiotopeStatus]}</strong><small>Sécurité pour reptiles non documentée.</small>{plantProfile.toxicityNote && <small className="plant-toxicity-note">{plantProfile.toxicityNote}</small>}<a href={plantProfile.source.url} target="_blank" rel="noreferrer">Source · {plantProfile.source.publisher}</a></div>}
              <div className="decor-coordinate-grid">
                <label><span>X · gauche</span><input type="number" min="0" max={dimensions.width} step="1" aria-label={`Position X de ${item.kind} en centimètres`} value={item.xCm} onChange={(event) => onUpdatePosition(item.id, "x", event.target.value)} onBlur={onFinishNumericEdit} /></label>
                <label><span>Z · haut</span><input type="number" min="0" max={dimensions.depth} step="1" aria-label={`Position Z de ${item.kind} en centimètres`} value={item.zCm} onChange={(event) => onUpdatePosition(item.id, "z", event.target.value)} onBlur={onFinishNumericEdit} /></label>
                <label><span>Y · hauteur</span><input type="number" min="0" max={dimensions.height} step="1" aria-label={`Hauteur Y de ${item.kind} en centimètres`} value={item.yCm} onChange={(event) => onUpdatePosition(item.id, "y", event.target.value)} onBlur={onFinishNumericEdit} /></label>
              </div>
              <label className="decor-size-control"><span>Taille visuelle <output>{item.size ?? 100}%</output></span><input type="range" min="50" max="150" step="10" aria-label={`Taille visuelle de ${item.kind}`} value={item.size ?? 100} onChange={(event) => onUpdateSize(item.id, event.target.value)} onBlur={onFinishNumericEdit} /></label>
              <label className="decor-rotation-control"><span>Rotation Y · degrés</span><input type="number" min="0" max="359" step="15" aria-label={`Rotation de ${item.kind} en degrés`} value={item.rotation ?? 0} onChange={(event) => onUpdateRotation(item.id, event.target.value)} onBlur={onFinishNumericEdit} /></label>
            </div>
            <button type="button" className="remove-button" title={`Retirer ${item.kind}`} aria-label={`Retirer ${item.kind}`} onClick={() => onRemoveDecoration(item.id)}><X size={14} /></button>
          </div>;
        })}
        {decorations.length === 0 && <p className="empty-decor">Le terrarium est vide pour le moment.</p>}
      </div>
    </section>
  );
}