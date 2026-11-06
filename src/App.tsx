import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Expand,
  Eye,
  Leaf,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sprout,
  Sun,
  Waves,
  X,
} from "lucide-react";

type Shape = "Basse" | "Cubique" | "Verticale";
type Biotope = "Désertique" | "Tropical" | "Paludarium";
type Decoration = { id: number; kind: "Plante" | "Cachette" | "Roche" };

const speciesList = [
  "Pogona vitticeps · Dragon barbu",
  "Eublepharis macularius · Gecko léopard",
  "Correlophus ciliatus · Gecko à crête",
  "Dendrobates tinctorius · Dendrobate",
];

const biotopeColors: Record<Biotope, { ground: number; plant: number; water: number }> = {
  Désertique: { ground: 0xcda875, plant: 0x74884b, water: 0x8dbdc1 },
  Tropical: { ground: 0x604c38, plant: 0x568b50, water: 0x83bfc0 },
  Paludarium: { ground: 0x665342, plant: 0x4c8051, water: 0x69abb0 },
};

function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<Shape>("Basse");
  const [biotope, setBiotope] = useState<Biotope>("Tropical");
  const [dimensions, setDimensions] = useState({ width: 120, depth: 60, height: 80 });
  const [species, setSpecies] = useState(speciesList[0]);
  const [decorations, setDecorations] = useState<Decoration[]>([
    { id: 1, kind: "Plante" },
    { id: 2, kind: "Roche" },
    { id: 3, kind: "Cachette" },
  ]);
  const [nextId, setNextId] = useState(4);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9ede4");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(4.8, 3.8, 5.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8e9, 0x65745c, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffedc8, 3.2);
    keyLight.position.set(-3, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc5e0d1, 1.3);
    fillLight.position.set(5, 3, -4);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0.9, 0);
    controls.minDistance = 3.2;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.48;

    const width = Math.min(3.2, Math.max(1.7, dimensions.width / 58));
    const depth = Math.min(2.5, Math.max(1.25, dimensions.depth / 38));
    const heightScale = shape === "Verticale" ? 0.038 : shape === "Cubique" ? 0.03 : 0.022;
    const height = Math.min(3.1, Math.max(1.65, dimensions.height * heightScale));
    const floorY = 0.12;
    const colors = biotopeColors[biotope];
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd9e6d9,
      transparent: true,
      opacity: 0.14,
      roughness: 0.12,
      metalness: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x414f43, roughness: 0.36 });
    const groundMaterial = new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 0.94 });
    const plantMaterial = new THREE.MeshStandardMaterial({ color: colors.plant, roughness: 0.72 });
    const widthHalf = width / 2;
    const depthHalf = depth / 2;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), groundMaterial);
    floor.position.y = floorY;
    scene.add(floor);

    if (biotope === "Paludarium") {
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.4, 0.045, depth * 0.94),
        new THREE.MeshPhysicalMaterial({ color: colors.water, roughness: 0.16, metalness: 0.12 }),
      );
      water.position.set(width * 0.28, floorY + 0.13, 0);
      scene.add(water);
    }

    const pane = (paneWidth: number, paneHeight: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(paneWidth, paneHeight), glass);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    };
    pane(width, height, 0, floorY + height / 2 + 0.1, -depthHalf);
    pane(depth, height, -widthHalf, floorY + height / 2 + 0.1, 0);
    pane(depth, height, widthHalf, floorY + height / 2 + 0.1, 0);
    pane(width, height, 0, floorY + height / 2 + 0.1, depthHalf);
    pane(width, height, 0, floorY + height + 0.1, 0);

    const addBeam = (beamWidth: number, beamHeight: number, beamDepth: number, x: number, y: number, z: number) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, beamHeight, beamDepth), frameMaterial);
      beam.position.set(x, y, z);
      scene.add(beam);
    };
    const rail = 0.045;
    for (const x of [-widthHalf, widthHalf]) {
      for (const z of [-depthHalf, depthHalf]) {
        addBeam(rail, height + rail, rail, x, floorY + height / 2 + 0.1, z);
      }
    }
    for (const y of [floorY + 0.1, floorY + height + 0.1]) {
      addBeam(width + rail, rail, rail, 0, y, -depthHalf);
      addBeam(width + rail, rail, rail, 0, y, depthHalf);
      addBeam(rail, rail, depth + rail, -widthHalf, y, 0);
      addBeam(rail, rail, depth + rail, widthHalf, y, 0);
    }

    decorations.forEach((item, index) => {
      const x = -width * 0.31 + (index % 4) * width * 0.2;
      const z = index % 2 === 0 ? -depth * 0.21 : depth * 0.2;
      if (item.kind === "Plante") {
        const plant = new THREE.Group();
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.026, 0.62, 7),
          new THREE.MeshStandardMaterial({ color: 0x65804b, roughness: 0.8 }),
        );
        stem.position.y = 0.38;
        plant.add(stem);
        for (let leaf = 0; leaf < 5; leaf += 1) {
          const foliage = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.42, 5),
            new THREE.MeshStandardMaterial({ color: leaf % 2 ? 0x55804b : colors.plant, roughness: 0.78 }),
          );
          foliage.position.set(Math.cos(leaf * 1.25) * 0.13, 0.48 + leaf * 0.1, Math.sin(leaf * 1.25) * 0.13);
          foliage.rotation.z = Math.cos(leaf * 1.25) * 0.5;
          foliage.rotation.x = Math.sin(leaf * 1.25) * 0.4;
          plant.add(foliage);
        }
        plant.position.set(x, floorY + 0.1, z);
        scene.add(plant);
      } else if (item.kind === "Cachette") {
        const hide = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({ color: 0x88735b, roughness: 1 }),
        );
        body.scale.set(1.25, 0.68, 0.95);
        body.position.y = 0.26;
        hide.add(body);
        const entrance = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16),
          new THREE.MeshStandardMaterial({ color: 0x352e27, roughness: 1 }),
        );
        entrance.rotation.x = Math.PI / 2;
        entrance.position.set(0, 0.19, 0.36);
        hide.add(entrance);
        hide.position.set(x, floorY + 0.1, z);
        scene.add(hide);
      } else {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.28 + (index % 3) * 0.06, 0),
          new THREE.MeshStandardMaterial({ color: index % 2 ? 0x9a8b76 : 0x776a5d, roughness: 0.98 }),
        );
        rock.scale.set(1.2, 0.82, 0.95);
        rock.position.set(x, floorY + 0.28, z);
        scene.add(rock);
      }
    });

    const grid = new THREE.GridHelper(12, 24, 0xadb8aa, 0xcbd1c7);
    grid.position.y = -0.02;
    scene.add(grid);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.replaceChildren();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, [shape, dimensions, biotope, decorations]);

  const updateDimension = (key: keyof typeof dimensions, value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      setDimensions((current) => ({ ...current, [key]: numericValue }));
    }
  };

  const addDecoration = (kind: Decoration["kind"]) => {
    setDecorations((current) => [...current, { id: nextId, kind }]);
    setNextId((current) => current + 1);
  };

  const removeDecoration = (id: number) => {
    setDecorations((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Terrarium Studio, accueil">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
          <span>terrarium<span className="brand-light"> studio</span></span>
        </a>
        <div className="project-name"><span className="live-dot" /> Habitat sans titre <ChevronDown size={14} /></div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={17} /></button>
          <button className="save-button" type="button" onClick={() => window.alert("La sauvegarde de projet sera ajoutée dans une prochaine étape.")}>Enregistrer le projet</button>
        </div>
      </header>

      <section className="workspace" id="top">
        <aside className="panel left-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">NOUVEAU PROJET</p><h1>Votre habitat</h1></div>
            <span className="step-count">01 <span>/ 04</span></span>
          </div>

          <section className="form-section">
            <div className="section-title"><span>01</span><h2>Le contenant</h2></div>
            <p className="field-label">Format du terrarium</p>
            <div className="shape-options" role="group" aria-label="Format du terrarium">
              {(["Basse", "Cubique", "Verticale"] as Shape[]).map((option) => (
                <button key={option} className={`shape-option ${shape === option ? "selected" : ""}`} type="button" onClick={() => setShape(option)}>
                  <span className={`shape-glyph ${option.toLowerCase()}`}><i /></span>
                  <span>{option}</span>
                </button>
              ))}
            </div>

            <div className="section-label-row"><p className="field-label">Dimensions intérieures</p><span className="unit-label">cm</span></div>
            <div className="dimension-grid">
              {(["width", "depth", "height"] as const).map((key) => (
                <label className="dimension-field" key={key}>
                  <span>{key === "width" ? "Largeur" : key === "depth" ? "Profondeur" : "Hauteur"}</span>
                  <input aria-label={key === "width" ? "Largeur en centimètres" : key === "depth" ? "Profondeur en centimètres" : "Hauteur en centimètres"} type="number" min="20" max="300" value={dimensions[key]} onChange={(event) => updateDimension(key, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="size-summary"><Ruler size={14} /> Volume estimé <strong>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</strong></div>
          </section>

          <section className="form-section">
            <div className="section-title"><span>02</span><h2>Le biotope</h2></div>
            <div className="biotope-options" role="group" aria-label="Type de terrarium">
              {(["Désertique", "Tropical", "Paludarium"] as Biotope[]).map((option) => (
                <button key={option} type="button" className={`biotope-option ${biotope === option ? "selected" : ""}`} onClick={() => setBiotope(option)}>
                  <span className="biotope-icon">{option === "Désertique" ? <Sun size={16} /> : option === "Paludarium" ? <Waves size={16} /> : <Sprout size={16} />}</span>
                  <span>{option}</span>
                  {biotope === option && <Check size={14} className="option-check" />}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section decor-section">
            <div className="section-title"><span>03</span><h2>Le décor</h2><span className="count-pill">{decorations.length}</span></div>
            <div className="decor-tools">
              <button type="button" onClick={() => addDecoration("Plante")}><Plus size={14} /><Leaf size={15} /> Plante</button>
              <button type="button" onClick={() => addDecoration("Cachette")}><Plus size={14} /><Expand size={14} /> Cachette</button>
              <button type="button" onClick={() => addDecoration("Roche")}><Plus size={14} /><span className="rock-icon" /> Roche</button>
            </div>
            <div className="decor-list">
              {decorations.map((item, index) => (
                <div className="decor-item" key={item.id}>
                  <span className={`decor-swatch swatch-${item.kind.toLowerCase()}`}>{item.kind === "Plante" ? <Leaf size={14} /> : item.kind === "Cachette" ? <Expand size={14} /> : <span className="rock-icon" />}</span>
                  <span>{item.kind} <small>{String(index + 1).padStart(2, "0")}</small></span>
                  <button type="button" className="remove-button" title={`Retirer ${item.kind}`} aria-label={`Retirer ${item.kind}`} onClick={() => removeDecoration(item.id)}><X size={14} /></button>
                </div>
              ))}
              {decorations.length === 0 && <p className="empty-decor">Le terrarium est vide pour le moment.</p>}
            </div>
          </section>

          <section className="form-section species-section">
            <div className="section-title"><span>04</span><h2>Son habitant</h2></div>
            <label className="species-select-wrap">
              <span className="sr-only">Espèce de reptile ou amphibien</span>
              <select value={species} onChange={(event) => setSpecies(event.target.value)}>
                {speciesList.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <p className="species-note"><CircleHelp size={13} /> La base d'espèces sera enrichie avec des sources vérifiables.</p>
          </section>
        </aside>

        <section className="stage-column" aria-label="Visualisation 3D">
          <div className="stage-toolbar">
            <div className="view-tabs"><button className="active" type="button"><Eye size={14} /> Vue 3D</button><button type="button" title="La vue en plan sera ajoutée ensuite">Plan</button></div>
            <span className="stage-dimensions">{dimensions.width} × {dimensions.depth} × {dimensions.height} cm</span>
          </div>
          <div className="viewport-wrap">
            <div className="viewport" ref={viewportRef} />
            <div className="viewport-label"><span className="live-dot" /> APERÇU EN DIRECT</div>
            <div className="viewport-tools"><button type="button" title="Réinitialiser le décor" aria-label="Réinitialiser le décor" onClick={() => setDecorations([])}><RotateCcw size={16} /></button></div>
            <div className="viewport-caption"><span className="caption-index">FIG. 01</span><span>{biotope} <b>·</b> {shape.toLowerCase()}</span></div>
          </div>
          <div className="stage-footer"><span><span className="legend-dot glass-dot" /> Verre clair</span><span><span className="legend-dot ground-dot" /> Substrat {biotope.toLowerCase()}</span><span className="orbit-hint">{decorations.length} éléments dans la scène</span></div>
        </section>

        <aside className="panel right-panel">
          <div className="analysis-heading"><span className="analysis-icon"><ShieldCheck size={19} /></span><div><p className="eyebrow">BILAN DU PROJET</p><h2>Conformité</h2></div></div>
          <div className="status-block">
            <div className="status-top"><span className="status-mark"><AlertTriangle size={15} /></span><span>À documenter</span></div>
            <p>La vérification des besoins de cette espèce n'est pas encore disponible.</p>
          </div>
          <div className="selected-species"><p className="field-label">ESPÈCE SÉLECTIONNÉE</p><strong>{species.split(" · ")[1]}</strong><span>{species.split(" · ")[0]}</span></div>
          <div className="checklist-heading"><span>Points à vérifier</span><span className="checklist-line" /></div>
          <div className="check-row"><span className="check-icon pending"><CircleHelp size={14} /></span><span>Dimensions minimales</span><small>À sourcer</small></div>
          <div className="check-row"><span className="check-icon pending"><CircleHelp size={14} /></span><span>Gradient thermique</span><small>À sourcer</small></div>
          <div className="check-row"><span className="check-icon pending"><CircleHelp size={14} /></span><span>Humidité et ventilation</span><small>À sourcer</small></div>
          <div className="check-row"><span className="check-icon pending"><CircleHelp size={14} /></span><span>Cachettes et enrichissement</span><small>À sourcer</small></div>
          <div className="report-note"><AlertTriangle size={15} /><p>Le futur bilan devra citer ses sources et signaler les informations manquantes. Ce prototype ne valide pas encore un habitat.</p></div>
          <div className="habitat-summary"><p className="field-label">RÉCAPITULATIF</p><div><span>Type</span><strong>{biotope}</strong></div><div><span>Volume</span><strong>{(dimensions.width * dimensions.depth * dimensions.height / 1000).toFixed(0)} L</strong></div><div><span>Décor</span><strong>{decorations.length} éléments</strong></div></div>
          <button className="review-button" type="button" onClick={() => window.alert("Le rapport détaillé sera disponible après l'ajout de données d'élevage sourcées.")}>Voir le rapport <ChevronDown size={15} className="rotate-icon" /></button>
        </aside>
      </section>
      <footer className="app-footer"><span>PROTOTYPE · CONFIGURATEUR D'HABITAT</span><span>Terrarium Studio <span className="footer-separator">/</span> v0.1</span></footer>
    </main>
  );
}

export default App;
