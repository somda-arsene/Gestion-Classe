const { useState, useEffect, useMemo } = React;

// ---- Icônes simplifiées (émoji), remplacent lucide-react pour une version 100% autonome ----
const TAILLE_ICONES = { "3.5": 14, "4": 16, "5": 20, "6": 24, "7": 28, "8": 32 };
function tailleDepuisClassName(className) {
  const m = className && className.match(/w-([\d.]+)/);
  return (m && TAILLE_ICONES[m[1]]) || 16;
}
function creerIcone(symbole) {
  return function Icone({ className }) {
    return (
      <span className={className} style={{ fontSize: tailleDepuisClassName(className) + "px", lineHeight: 1, display: "inline-block" }}>
        {symbole}
      </span>
    );
  };
}
const Users = creerIcone("👥");
const BookOpen = creerIcone("📖");
const CalendarCheck = creerIcone("🗓️");
const FileText = creerIcone("📄");
const Plus = creerIcone("➕");
const Trash2 = creerIcone("🗑️");
const X = creerIcone("✖️");
const ChevronRight = creerIcone("›");
const GraduationCap = creerIcone("🎓");
const Settings = creerIcone("⚙️");
const Printer = creerIcone("🖨️");
const Award = creerIcone("🏅");
const Lock = creerIcone("🔒");
const ShieldCheck = creerIcone("🛡️");
const KeyRound = creerIcone("🔑");

// ---- Stockage 100% local (hors-ligne), remplace window.storage de Claude ----
window.storage = {
  async get(key) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return null;
      return { key, value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
  async list(prefix) {
    const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
    return { keys, prefix };
  },
};

const STORAGE_KEY = "gestion-classe-data-v2";

// ⚠️ Change ces deux valeurs avant de distribuer l'application (fichier app.js après build, ou directement ici).
// CODE_MAITRE_ADMIN : te donne accès à l'outil de génération de codes clients.
// SEL_SECRET : rend les codes générés imprévisibles. Garde-le pour toi, ne le partage jamais.
const CODE_MAITRE_ADMIN = "CHANGE_MOI_1234";
const SEL_SECRET = "CHANGE_MOI_AUSSI_9999";

const emptyData = {
  parametres: { ceb: "", ecole: "", annee: "2025/2026" },
  classes: [],
  eleves: [],
  matieres: [],
  notes: [],
  presences: [],
  decisions: [], // { eleveId, decision } override manuel
};

const TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function ordinal(n) {
  if (n == null) return "—";
  return n === 1 ? "1er" : `${n}ème`;
}

// Calcule la moyenne pondérée d'un élève pour une période donnée
function calcMoyenne(eleveId, matieres, notes, periode) {
  let sommeCoef = 0;
  let sommePonderee = 0;
  matieres.forEach((m) => {
    const n = notes.find(
      (nn) => nn.eleveId === eleveId && nn.matiereId === m.id && nn.periode === periode
    );
    if (n && n.valeur !== "" && !isNaN(Number(n.valeur))) {
      sommePonderee += Number(n.valeur) * m.coefficient;
      sommeCoef += m.coefficient;
    }
  });
  if (sommeCoef === 0) return null;
  return { moyenne: sommePonderee / sommeCoef, total: sommePonderee, coef: sommeCoef };
}

// Classement avec gestion des ex-aequo
function calculerClassement(eleveIds, matieres, notes, periode) {
  const rows = eleveIds.map((id) => {
    const r = calcMoyenne(id, matieres, notes, periode);
    return { eleveId: id, moyenne: r ? r.moyenne : null };
  });
  const avecMoyenne = rows.filter((r) => r.moyenne !== null).sort((a, b) => b.moyenne - a.moyenne);
  let rangCourant = 1;
  const result = [];
  for (let i = 0; i < avecMoyenne.length; i++) {
    if (i > 0 && avecMoyenne[i].moyenne === avecMoyenne[i - 1].moyenne) {
      // même rang
    } else {
      rangCourant = i + 1;
    }
    result.push({ ...avecMoyenne[i], rang: rangCourant });
  }
  const rangCounts = {};
  result.forEach((r) => (rangCounts[r.rang] = (rangCounts[r.rang] || 0) + 1));
  result.forEach((r) => (r.exaequo = rangCounts[r.rang] > 1));
  const sansMoyenne = rows
    .filter((r) => r.moyenne === null)
    .map((r) => ({ ...r, rang: null, exaequo: false }));
  return [...result, ...sansMoyenne];
}

function rangLabel(rang, exaequo, effectif) {
  if (rang == null) return "—";
  return `${ordinal(rang)}${exaequo ? " ex" : ""} / ${effectif} élèves`;
}

function ClassManagerApp() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [classeId, setClasseId] = useState(null);
  const [tab, setTab] = useState("eleves");
  const [periode, setPeriode] = useState("Trimestre 1");
  const [showParams, setShowParams] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData({ ...emptyData, ...parsed, parametres: { ...emptyData.parametres, ...(parsed.parametres || {}) } });
          if (parsed.classes && parsed.classes.length > 0) {
            setClasseId(parsed.classes[0].id);
          }
        }
      } catch (e) {
        // pas de données existantes
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error("Erreur de sauvegarde", e);
      }
    })();
  }, [data, loaded]);

  const classes = data.classes;
  const classeActuelle = classes.find((c) => c.id === classeId) || null;
  const elevesClasse = data.eleves.filter((e) => e.classeId === classeId);
  const matieres = data.matieres;
  const bareme = classeActuelle?.bareme || 10;

  // ---------- Actions ----------
  function ajouterClasse(nom, bareme, sousCycle) {
    const nc = { id: uid(), nom, bareme: Number(bareme) || 10, sousCycle: sousCycle || "" };
    setData((d) => ({ ...d, classes: [...d.classes, nc] }));
    setClasseId(nc.id);
  }
  function supprimerClasse(id) {
    setData((d) => ({
      ...d,
      classes: d.classes.filter((c) => c.id !== id),
      eleves: d.eleves.filter((e) => e.classeId !== id),
    }));
    if (classeId === id) setClasseId(null);
  }
  function ajouterEleve(nom, prenom, genre) {
    setData((d) => ({
      ...d,
      eleves: [...d.eleves, { id: uid(), classeId, nom, prenom, genre }],
    }));
  }
  function supprimerEleve(id) {
    setData((d) => ({
      ...d,
      eleves: d.eleves.filter((e) => e.id !== id),
      notes: d.notes.filter((n) => n.eleveId !== id),
      presences: d.presences.filter((p) => p.eleveId !== id),
      decisions: d.decisions.filter((dec) => dec.eleveId !== id),
    }));
  }
  function ajouterMatiere(nom, coefficient) {
    setData((d) => ({
      ...d,
      matieres: [...d.matieres, { id: uid(), nom, coefficient: Number(coefficient) || 1 }],
    }));
  }
  function supprimerMatiere(id) {
    setData((d) => ({
      ...d,
      matieres: d.matieres.filter((m) => m.id !== id),
      notes: d.notes.filter((n) => n.matiereId !== id),
    }));
  }
  function setNote(eleveId, matiereId, valeur) {
    setData((d) => {
      const existant = d.notes.find(
        (n) => n.eleveId === eleveId && n.matiereId === matiereId && n.periode === periode
      );
      if (existant) {
        return { ...d, notes: d.notes.map((n) => (n.id === existant.id ? { ...n, valeur } : n)) };
      }
      return { ...d, notes: [...d.notes, { id: uid(), eleveId, matiereId, periode, valeur }] };
    });
  }
  function getNote(eleveId, matiereId) {
    const n = data.notes.find(
      (n) => n.eleveId === eleveId && n.matiereId === matiereId && n.periode === periode
    );
    return n ? n.valeur : "";
  }
  function toggleStatutPresence(eleveId, date, statut) {
    setData((d) => {
      const existant = d.presences.find((p) => p.eleveId === eleveId && p.date === date);
      if (existant) {
        return { ...d, presences: d.presences.map((p) => (p.id === existant.id ? { ...p, statut } : p)) };
      }
      return { ...d, presences: [...d.presences, { id: uid(), eleveId, date, statut }] };
    });
  }
  function setDecisionManuelle(eleveId, decision) {
    setData((d) => {
      const existant = d.decisions.find((dc) => dc.eleveId === eleveId);
      if (existant) {
        return { ...d, decisions: d.decisions.map((dc) => (dc.eleveId === eleveId ? { ...dc, decision } : dc)) };
      }
      return { ...d, decisions: [...d.decisions, { eleveId, decision }] };
    });
  }
  function majParametres(champ, valeur) {
    setData((d) => ({ ...d, parametres: { ...d.parametres, [champ]: valeur } }));
  }

  // ---------- Calculs ----------
  const elevesIds = elevesClasse.map((e) => e.id);
  const classementPeriode = useMemo(
    () => calculerClassement(elevesIds, matieres, data.notes, periode),
    [elevesIds, matieres, data.notes, periode]
  );
  const classementParTrimestre = useMemo(() => {
    const out = {};
    TRIMESTRES.forEach((t) => {
      out[t] = calculerClassement(elevesIds, matieres, data.notes, t);
    });
    return out;
  }, [elevesIds, matieres, data.notes]);

  const moyenneAnnuelleParEleve = useMemo(() => {
    const out = {};
    elevesIds.forEach((id) => {
      const vals = TRIMESTRES.map((t) => {
        const r = classementParTrimestre[t].find((x) => x.eleveId === id);
        return r ? r.moyenne : null;
      }).filter((v) => v !== null);
      out[id] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return out;
  }, [elevesIds, classementParTrimestre]);

  const classementAnnuel = useMemo(() => {
    const rows = elevesIds.map((id) => ({ eleveId: id, moyenne: moyenneAnnuelleParEleve[id] }));
    const avec = rows.filter((r) => r.moyenne !== null).sort((a, b) => b.moyenne - a.moyenne);
    let rangCourant = 1;
    const result = [];
    for (let i = 0; i < avec.length; i++) {
      if (i > 0 && avec[i].moyenne === avec[i - 1].moyenne) {
        // même rang
      } else {
        rangCourant = i + 1;
      }
      result.push({ ...avec[i], rang: rangCourant });
    }
    const rangCounts = {};
    result.forEach((r) => (rangCounts[r.rang] = (rangCounts[r.rang] || 0) + 1));
    result.forEach((r) => (r.exaequo = rangCounts[r.rang] > 1));
    const sans = rows.filter((r) => r.moyenne === null).map((r) => ({ ...r, rang: null, exaequo: false }));
    return [...result, ...sans];
  }, [elevesIds, moyenneAnnuelleParEleve]);

  function decisionAuto(moyenne) {
    if (moyenne === null) return "—";
    return moyenne >= bareme / 2 ? "Passe en classe supérieure" : "Redouble sa classe";
  }
  function decisionEleve(eleveId, moyenne) {
    const override = data.decisions.find((d) => d.eleveId === eleveId);
    if (override) return override.decision;
    return decisionAuto(moyenne);
  }

  const statsClasse = useMemo(() => {
    const valides = classementPeriode.filter((r) => r.moyenne !== null);
    if (valides.length === 0) return null;
    const moyennes = valides.map((r) => r.moyenne);
    return {
      moyenneGenerale: moyennes.reduce((a, b) => a + b, 0) / moyennes.length,
      meilleure: Math.max(...moyennes),
      plusBasse: Math.min(...moyennes),
    };
  }, [classementPeriode]);

  const tauxAbsence = useMemo(() => {
    const presencesClasse = data.presences.filter((p) => elevesClasse.some((e) => e.id === p.eleveId));
    if (presencesClasse.length === 0) return null;
    const absents = presencesClasse.filter((p) => p.statut === "absent").length;
    return (absents / presencesClasse.length) * 100;
  }, [data.presences, elevesClasse]);

  // ---------- UI ----------
  const tabs = [
    { key: "eleves", label: "Élèves", icon: Users },
    { key: "notes", label: "Notes", icon: BookOpen },
    { key: "presences", label: "Présences", icon: CalendarCheck },
    { key: "bulletins", label: "Bulletins", icon: FileText },
    { key: "finannee", label: "Fin d'année", icon: Award },
  ];

  return (
    <div className="min-h-screen bg-[#F6F1E4] font-sans text-[#2B2118]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
        .font-display { font-family: 'Lora', serif; }
        .font-mono-num { font-family: 'JetBrains Mono', monospace; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .fille { color: #B23A2E; }
        .garcon { color: #2B2118; }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="bg-[#1F3A2E] text-[#F6F1E4] border-b-4 border-[#C89B3C] no-print">
        <div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#C89B3C]" />
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Cahier de Classe</h1>
              <p className="text-xs text-[#C9BFA0] font-sans">
                {data.parametres.ceb ? `${data.parametres.ceb} · ` : ""}
                {data.parametres.ecole ? `${data.parametres.ecole} · ` : ""}
                {data.parametres.annee}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowParams(true)}
            className="p-2 rounded hover:bg-[#2A4A3B]"
            title="Paramètres de l'établissement"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {showParams && (
        <ParametresModal
          parametres={data.parametres}
          onChange={majParametres}
          onClose={() => setShowParams(false)}
        />
      )}

      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row gap-6">
        <aside className="md:w-64 shrink-0 no-print">
          <div className="bg-white rounded-lg border border-[#E3D9BF] shadow-sm">
            <div className="px-4 py-3 border-b border-[#E3D9BF] flex items-center justify-between">
              <span className="font-display font-semibold text-[#1F3A2E]">Classes</span>
            </div>
            <ul className="divide-y divide-[#EFE9D6]">
              {classes.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setClasseId(c.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition ${
                      classeId === c.id ? "bg-[#1F3A2E] text-white" : "hover:bg-[#F6F1E4] text-[#2B2118]"
                    }`}
                  >
                    <span className="font-medium">
                      {c.nom} <span className="opacity-60 text-xs">/{c.bareme}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                </li>
              ))}
              {classes.length === 0 && (
                <li className="px-4 py-4 text-sm text-[#8A7F63]">Aucune classe. Ajoute-en une ci-dessous.</li>
              )}
            </ul>
            <NouvelleClasseForm onAdd={ajouterClasse} />
          </div>

          {classeActuelle && (
            <button
              onClick={() => {
                if (confirm(`Supprimer la classe "${classeActuelle.nom}" et tous ses élèves ?`)) {
                  supprimerClasse(classeActuelle.id);
                }
              }}
              className="mt-3 text-xs text-[#A33] flex items-center gap-1 px-2 py-1 hover:underline"
            >
              <Trash2 className="w-3 h-3" /> Supprimer cette classe
            </button>
          )}
        </aside>

        <main className="flex-1 min-w-0">
          {!classeActuelle ? (
            <div className="bg-white rounded-lg border border-[#E3D9BF] p-8 text-center text-[#8A7F63] no-print">
              Sélectionne ou crée une classe pour commencer.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 no-print">
                <h2 className="font-display text-xl font-semibold text-[#1F3A2E]">{classeActuelle.nom}</h2>
                <select
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  className="text-sm border border-[#E3D9BF] rounded px-2 py-1 bg-white"
                >
                  {TRIMESTRES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 mb-4 border-b border-[#E3D9BF] no-print">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                        tab === t.key ? "border-[#C89B3C] text-[#1F3A2E]" : "border-transparent text-[#8A7F63] hover:text-[#1F3A2E]"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "eleves" && (
                <EleveTab eleves={elevesClasse} onAdd={ajouterEleve} onDelete={supprimerEleve} />
              )}

              {tab === "notes" && (
                <NotesTab
                  eleves={elevesClasse}
                  matieres={matieres}
                  getNote={getNote}
                  setNote={setNote}
                  onAddMatiere={ajouterMatiere}
                  onDeleteMatiere={supprimerMatiere}
                  classement={classementPeriode}
                  bareme={bareme}
                />
              )}

              {tab === "presences" && (
                <PresencesTab eleves={elevesClasse} presences={data.presences} onToggle={toggleStatutPresence} />
              )}

              {tab === "bulletins" && (
                <BulletinsTab
                  classement={classementPeriode}
                  eleves={elevesClasse}
                  matieres={matieres}
                  data={data}
                  periode={periode}
                  statsClasse={statsClasse}
                  tauxAbsence={tauxAbsence}
                  classeActuelle={classeActuelle}
                  bareme={bareme}
                />
              )}

              {tab === "finannee" && (
                <FinAnneeTab
                  classementAnnuel={classementAnnuel}
                  classementParTrimestre={classementParTrimestre}
                  eleves={elevesClasse}
                  data={data}
                  classeActuelle={classeActuelle}
                  moyenneAnnuelleParEleve={moyenneAnnuelleParEleve}
                  decisionEleve={decisionEleve}
                  setDecisionManuelle={setDecisionManuelle}
                  bareme={bareme}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ParametresModal({ parametres, onChange, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 no-print p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-[#1F3A2E]">Paramètres de l'établissement</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#8A7F63] block mb-1">CEB (Circonscription d'Éducation de Base)</label>
            <input
              value={parametres.ceb}
              onChange={(e) => onChange("ceb", e.target.value)}
              placeholder="Ex: CEB DE YAKO"
              className="w-full text-sm border border-[#E3D9BF] rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#8A7F63] block mb-1">École</label>
            <input
              value={parametres.ecole}
              onChange={(e) => onChange("ecole", e.target.value)}
              placeholder="Ex: École Saint Kisito"
              className="w-full text-sm border border-[#E3D9BF] rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs text-[#8A7F63] block mb-1">Année scolaire</label>
            <input
              value={parametres.annee}
              onChange={(e) => onChange("annee", e.target.value)}
              placeholder="Ex: 2025/2026"
              className="w-full text-sm border border-[#E3D9BF] rounded px-2 py-1.5"
            />
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-[#1F3A2E] text-white rounded px-3 py-2 text-sm hover:bg-[#16291F]"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function NouvelleClasseForm({ onAdd }) {
  const [nom, setNom] = useState("");
  const [bareme, setBareme] = useState(10);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        onAdd(nom.trim(), bareme);
        setNom("");
      }}
      className="p-3 border-t border-[#E3D9BF] flex gap-2"
    >
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Ex: CM2"
        className="flex-1 text-sm border border-[#E3D9BF] rounded px-2 py-1.5"
      />
      <select
        value={bareme}
        onChange={(e) => setBareme(e.target.value)}
        className="text-sm border border-[#E3D9BF] rounded px-1.5"
        title="Barème de notation"
      >
        <option value={10}>/10</option>
        <option value={20}>/20</option>
      </select>
      <button type="submit" className="bg-[#1F3A2E] text-white rounded px-2.5 py-1.5 hover:bg-[#16291F]">
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
}

function NomEleve({ eleve }) {
  return <span className={eleve.genre === "F" ? "fille" : "garcon"}>{eleve.nom} {eleve.prenom}</span>;
}

function EleveTab({ eleves, onAdd, onDelete }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [genre, setGenre] = useState("G");
  const nbG = eleves.filter((e) => e.genre === "G").length;
  const nbF = eleves.filter((e) => e.genre === "F").length;
  return (
    <div className="bg-white rounded-lg border border-[#E3D9BF] shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          onAdd(nom.trim(), prenom.trim(), genre);
          setNom("");
          setPrenom("");
        }}
        className="p-4 border-b border-[#E3D9BF] flex flex-wrap gap-2"
      >
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="flex-1 min-w-[120px] text-sm border border-[#E3D9BF] rounded px-2 py-1.5" />
        <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" className="flex-1 min-w-[120px] text-sm border border-[#E3D9BF] rounded px-2 py-1.5" />
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="text-sm border border-[#E3D9BF] rounded px-2 py-1.5">
          <option value="G">Garçon</option>
          <option value="F">Fille</option>
        </select>
        <button type="submit" className="bg-[#1F3A2E] text-white rounded px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-[#16291F]">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </form>
      <div className="px-4 py-2 text-xs text-[#8A7F63] border-b border-[#EFE9D6]">
        Effectif : G={nbG} <span className="fille">F={nbF}</span> T={eleves.length}
      </div>
      <ul className="divide-y divide-[#EFE9D6]">
        {eleves.map((e, i) => (
          <li key={e.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
            <span><span className="font-mono-num text-[#8A7F63] mr-2">{i + 1}.</span><NomEleve eleve={e} /></span>
            <button onClick={() => onDelete(e.id)} className="text-[#A33] hover:opacity-70"><X className="w-4 h-4" /></button>
          </li>
        ))}
        {eleves.length === 0 && <li className="px-4 py-6 text-center text-[#8A7F63] text-sm">Aucun élève dans cette classe.</li>}
      </ul>
    </div>
  );
}

function NotesTab({ eleves, matieres, getNote, setNote, onAddMatiere, onDeleteMatiere, classement, bareme }) {
  const [nomMat, setNomMat] = useState("");
  const [coef, setCoef] = useState(1);
  const moyByEleve = {};
  classement.forEach((r) => (moyByEleve[r.eleveId] = r.moyenne));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-[#E3D9BF] p-4 no-print">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nomMat.trim()) return;
            onAddMatiere(nomMat.trim(), coef);
            setNomMat("");
            setCoef(1);
          }}
          className="flex flex-wrap gap-2 items-center"
        >
          <input value={nomMat} onChange={(e) => setNomMat(e.target.value)} placeholder="Nouvelle matière (ex: Français)" className="flex-1 min-w-[160px] text-sm border border-[#E3D9BF] rounded px-2 py-1.5" />
          <input type="number" min="1" value={coef} onChange={(e) => setCoef(e.target.value)} className="w-20 text-sm border border-[#E3D9BF] rounded px-2 py-1.5" title="Coefficient" />
          <button type="submit" className="bg-[#1F3A2E] text-white rounded px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-[#16291F]">
            <Plus className="w-4 h-4" /> Matière
          </button>
        </form>
        {matieres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {matieres.map((m) => (
              <span key={m.id} className="bg-[#F6F1E4] border border-[#E3D9BF] rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                {m.nom} <span className="text-[#8A7F63] font-mono-num">×{m.coefficient}</span>
                <button onClick={() => onDeleteMatiere(m.id)} className="text-[#A33]"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {matieres.length === 0 ? (
        <p className="text-sm text-[#8A7F63] px-1">Ajoute d'abord une matière pour saisir des notes.</p>
      ) : (
        <div className="bg-white rounded-lg border border-[#E3D9BF] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1F3A2E] text-white">
                <th className="text-left px-3 py-2 font-medium">Élève</th>
                {matieres.map((m) => (
                  <th key={m.id} className="px-2 py-2 font-medium text-center whitespace-nowrap">{m.nom}</th>
                ))}
                <th className="px-3 py-2 font-medium text-center">Moyenne /{bareme}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9D6]">
              {eleves.map((el) => {
                const moy = moyByEleve[el.id];
                return (
                  <tr key={el.id}>
                    <td className="px-3 py-2 whitespace-nowrap"><NomEleve eleve={el} /></td>
                    {matieres.map((m) => (
                      <td key={m.id} className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={bareme}
                          value={getNote(el.id, m.id)}
                          onChange={(ev) => setNote(el.id, m.id, ev.target.value)}
                          className="w-16 text-center border border-[#E3D9BF] rounded px-1 py-1 font-mono-num"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono-num font-semibold text-[#1F3A2E]">
                      {moy == null ? "—" : moy.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {eleves.length === 0 && (
                <tr><td colSpan={matieres.length + 2} className="px-3 py-6 text-center text-[#8A7F63]">Aucun élève dans cette classe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PresencesTab({ eleves, presences, onToggle }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  function statutDe(eleveId) {
    const p = presences.find((p) => p.eleveId === eleveId && p.date === date);
    return p ? p.statut : "present";
  }
  const options = [
    { key: "present", label: "Présent", color: "bg-[#2F6B4F] text-white" },
    { key: "absent", label: "Absent", color: "bg-[#A33] text-white" },
    { key: "retard", label: "Retard", color: "bg-[#C89B3C] text-white" },
  ];
  return (
    <div className="bg-white rounded-lg border border-[#E3D9BF] shadow-sm">
      <div className="p-4 border-b border-[#E3D9BF] flex items-center gap-2">
        <label className="text-sm text-[#8A7F63]">Date :</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border border-[#E3D9BF] rounded px-2 py-1.5" />
      </div>
      <ul className="divide-y divide-[#EFE9D6]">
        {eleves.map((el, i) => {
          const statut = statutDe(el.id);
          return (
            <li key={el.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="text-sm"><span className="font-mono-num text-[#8A7F63] mr-2">{i + 1}.</span><NomEleve eleve={el} /></span>
              <div className="flex gap-1.5">
                {options.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => onToggle(el.id, date, o.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${statut === o.key ? o.color + " border-transparent" : "bg-white text-[#8A7F63] border-[#E3D9BF] hover:bg-[#F6F1E4]"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
        {eleves.length === 0 && <li className="px-4 py-6 text-center text-[#8A7F63] text-sm">Aucun élève dans cette classe.</li>}
      </ul>
    </div>
  );
}

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-1.5 text-xs bg-[#1F3A2E] text-white rounded px-3 py-1.5 hover:bg-[#16291F]"
    >
      <Printer className="w-3.5 h-3.5" /> Imprimer / Exporter PDF
    </button>
  );
}

function EnTeteOfficiel({ parametres, classe }) {
  return (
    <div className="text-center mb-3">
      <div className="flex justify-between text-xs font-semibold">
        <span>{parametres.ceb || "CEB"}</span>
        <span>Année : {parametres.annee}</span>
      </div>
      <div className="flex justify-between text-xs font-semibold">
        <span>{parametres.ecole || "École"}</span>
        <span>Classe : {classe}</span>
      </div>
    </div>
  );
}

function BulletinsTab({ classement, eleves, matieres, data, periode, statsClasse, tauxAbsence, classeActuelle, bareme }) {
  const [eleveId, setEleveId] = useState(classement[0]?.eleveId || null);
  useEffect(() => {
    if (!classement.find((r) => r.eleveId === eleveId)) setEleveId(classement[0]?.eleveId || null);
    // eslint-disable-next-line
  }, [classement.length]);

  const eleveActuel = eleves.find((e) => e.id === eleveId);
  const rowActuel = classement.find((r) => r.eleveId === eleveId);
  const numTrimestre = periode.replace("Trimestre ", "");

  let total = 0, coefTotal = 0;
  matieres.forEach((m) => {
    const n = data.notes.find((nn) => nn.eleveId === eleveId && nn.matiereId === m.id && nn.periode === periode);
    if (n && n.valeur !== "" && !isNaN(Number(n.valeur))) {
      total += Number(n.valeur) * m.coefficient;
      coefTotal += m.coefficient;
    }
  });

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg border border-[#E3D9BF] md:col-span-1 no-print">
        <div className="px-4 py-3 border-b border-[#E3D9BF] font-display font-semibold text-[#1F3A2E]">
          Classement — {periode}
        </div>
        <ul className="divide-y divide-[#EFE9D6] max-h-[420px] overflow-y-auto">
          {classement.map((r) => {
            const el = eleves.find((e) => e.id === r.eleveId);
            if (!el) return null;
            return (
              <li key={r.eleveId}>
                <button
                  onClick={() => setEleveId(r.eleveId)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm ${eleveId === r.eleveId ? "bg-[#1F3A2E] text-white" : "hover:bg-[#F6F1E4]"}`}
                >
                  <span><span className="font-mono-num opacity-70 mr-2">{ordinal(r.rang)}</span><span className={eleveId === r.eleveId ? "" : el.genre === "F" ? "fille" : "garcon"}>{el.nom} {el.prenom}</span></span>
                  <span className="font-mono-num font-semibold">{r.moyenne == null ? "—" : r.moyenne.toFixed(2)}</span>
                </button>
              </li>
            );
          })}
          {classement.length === 0 && <li className="px-4 py-6 text-center text-[#8A7F63] text-sm">Aucun élève.</li>}
        </ul>
        {statsClasse && (
          <div className="border-t border-[#E3D9BF] p-4 text-sm space-y-1">
            <p className="font-display font-semibold text-[#1F3A2E] mb-1">Statistiques classe</p>
            <p>Moyenne générale : <span className="font-mono-num font-semibold">{statsClasse.moyenneGenerale.toFixed(2)}</span></p>
            <p>Meilleure moyenne : <span className="font-mono-num font-semibold">{statsClasse.meilleure.toFixed(2)}</span></p>
            <p>Moyenne la plus basse : <span className="font-mono-num font-semibold">{statsClasse.plusBasse.toFixed(2)}</span></p>
            {tauxAbsence !== null && <p>Taux d'absentéisme : <span className="font-mono-num font-semibold">{tauxAbsence.toFixed(1)}%</span></p>}
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        {!eleveActuel ? (
          <div className="bg-white rounded-lg border border-[#E3D9BF] p-8 text-center text-[#8A7F63]">Sélectionne un élève pour voir son bulletin.</div>
        ) : (
          <div className="bg-white rounded-lg border border-[#E3D9BF] p-6 print-area">
            <EnTeteOfficiel parametres={data.parametres} classe={classeActuelle.nom} />
            <p className="text-center font-display font-bold text-base mb-1">
              BULLETIN DU {numTrimestre} TRIMESTRE CLASSE {classeActuelle.nom}
            </p>
            <p className={`text-center font-semibold mb-3 ${eleveActuel.genre === "F" ? "fille" : "garcon"}`}>
              {eleveActuel.nom} {eleveActuel.prenom}
            </p>
            <table className="w-full text-sm border border-[#2B2118]">
              <thead>
                <tr className="border-b border-[#2B2118]">
                  <th className="text-left py-1.5 px-2 font-semibold border-r border-[#2B2118]">Matières</th>
                  <th className="py-1.5 px-2 font-semibold border-r border-[#2B2118] w-24">Notes</th>
                  <th className="py-1.5 px-2 font-semibold w-28">Coefficients</th>
                </tr>
              </thead>
              <tbody>
                {matieres.map((m) => {
                  const n = data.notes.find((nn) => nn.eleveId === eleveId && nn.matiereId === m.id && nn.periode === periode);
                  return (
                    <tr key={m.id} className="border-b border-[#E3D9BF]">
                      <td className="py-1.5 px-2 border-r border-[#E3D9BF]">{m.nom}</td>
                      <td className="py-1.5 px-2 text-center border-r border-[#E3D9BF] font-mono-num">{n && n.valeur !== "" ? Number(n.valeur).toFixed(1) : "-"}</td>
                      <td className="py-1.5 px-2 text-center font-mono-num">{n && n.valeur !== "" ? m.coefficient : "-"}</td>
                    </tr>
                  );
                })}
                {matieres.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-[#8A7F63]">Aucune matière définie.</td></tr>
                )}
              </tbody>
            </table>
            <div className="border border-[#2B2118] rounded-xl mt-3 p-3 text-sm space-y-0.5">
              <p>Coefficient : <span className="font-mono-num font-semibold">{coefTotal}</span></p>
              <p>Total : <span className="font-mono-num font-semibold">{total.toFixed(1)} / {coefTotal * bareme}</span></p>
              <p>Moyenne : <span className="font-mono-num font-semibold">{rowActuel?.moyenne != null ? rowActuel.moyenne.toFixed(2) : "0,00"} /{bareme}</span></p>
              <p>Rang : <span className="font-mono-num font-semibold">{rangLabel(rowActuel?.rang, rowActuel?.exaequo, eleves.length)}</span></p>
            </div>
            <div className="flex justify-between mt-8 text-sm">
              <span className="border-t border-[#2B2118] pt-1 px-4">Les Enseignants</span>
              <span className="border-t border-[#2B2118] pt-1 px-4">Les Parents</span>
            </div>
            <div className="mt-4"><PrintButton /></div>
          </div>
        )}
      </div>
    </div>
  );
}

function FinAnneeTab({ classementAnnuel, classementParTrimestre, eleves, data, classeActuelle, moyenneAnnuelleParEleve, decisionEleve, setDecisionManuelle, bareme }) {
  const [vue, setVue] = useState("proposition"); // proposition | individuel
  const [eleveId, setEleveId] = useState(classementAnnuel[0]?.eleveId || null);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print">
        <button onClick={() => setVue("proposition")} className={`text-sm px-3 py-1.5 rounded ${vue === "proposition" ? "bg-[#1F3A2E] text-white" : "bg-white border border-[#E3D9BF]"}`}>
          Proposition de fin d'année (classe)
        </button>
        <button onClick={() => setVue("individuel")} className={`text-sm px-3 py-1.5 rounded ${vue === "individuel" ? "bg-[#1F3A2E] text-white" : "bg-white border border-[#E3D9BF]"}`}>
          Bulletin annuel individuel
        </button>
      </div>

      {vue === "proposition" && (
        <div className="bg-white rounded-lg border border-[#E3D9BF] p-6 print-area">
          <EnTeteOfficiel parametres={data.parametres} classe={classeActuelle.nom} />
          <p className="text-center font-display font-bold text-base mb-3">PROPOSITION DE FIN D'ANNÉE</p>
          <table className="w-full text-sm border border-[#2B2118]">
            <thead>
              <tr className="border-b border-[#2B2118] bg-[#F6F1E4]">
                <th className="text-left py-1.5 px-2 font-semibold border-r border-[#2B2118]">Élève</th>
                <th className="py-1.5 px-2 font-semibold border-r border-[#2B2118]">Annuelle</th>
                <th className="py-1.5 px-2 font-semibold border-r border-[#2B2118]">Rang Annuel</th>
                <th className="py-1.5 px-2 font-semibold">Décision du conseil</th>
              </tr>
            </thead>
            <tbody>
              {classementAnnuel.map((r) => {
                const el = eleves.find((e) => e.id === r.eleveId);
                if (!el) return null;
                const decision = decisionEleve(r.eleveId, r.moyenne);
                return (
                  <tr key={r.eleveId} className="border-b border-[#E3D9BF]">
                    <td className={`py-1.5 px-2 border-r border-[#E3D9BF] ${el.genre === "F" ? "fille" : "garcon"}`}>{el.nom} {el.prenom}</td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E3D9BF] font-mono-num">{r.moyenne != null ? r.moyenne.toFixed(2) : "—"}</td>
                    <td className="py-1.5 px-2 text-center border-r border-[#E3D9BF] font-mono-num">{ordinal(r.rang)}{r.exaequo ? " ex" : ""}</td>
                    <td className={`py-1.5 px-2 text-center ${decision.includes("supérieure") ? "text-[#2F6B4F] font-medium" : decision === "—" ? "" : "text-[#A33] font-medium"}`}>
                      {decision}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4"><PrintButton /></div>
        </div>
      )}

      {vue === "individuel" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-[#E3D9BF] no-print">
            <ul className="divide-y divide-[#EFE9D6] max-h-[420px] overflow-y-auto">
              {classementAnnuel.map((r) => {
                const el = eleves.find((e) => e.id === r.eleveId);
                if (!el) return null;
                return (
                  <li key={r.eleveId}>
                    <button
                      onClick={() => setEleveId(r.eleveId)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm ${eleveId === r.eleveId ? "bg-[#1F3A2E] text-white" : "hover:bg-[#F6F1E4]"}`}
                    >
                      <span className={eleveId === r.eleveId ? "" : el.genre === "F" ? "fille" : "garcon"}>{el.nom} {el.prenom}</span>
                      <span className="font-mono-num">{r.moyenne != null ? r.moyenne.toFixed(2) : "—"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="md:col-span-2">
            {eleveId && (() => {
              const el = eleves.find((e) => e.id === eleveId);
              const moyAnn = moyenneAnnuelleParEleve[eleveId];
              const rangAnn = classementAnnuel.find((r) => r.eleveId === eleveId);
              const override = data.decisions.find((d) => d.eleveId === eleveId);
              return (
                <div className="bg-white rounded-lg border border-[#E3D9BF] p-6 print-area">
                  <EnTeteOfficiel parametres={data.parametres} classe={classeActuelle.nom} />
                  <p className="text-center font-display font-bold text-base mb-1">BULLETIN DE FIN D'ANNÉE</p>
                  <p className={`text-center font-semibold mb-3 ${el.genre === "F" ? "fille" : "garcon"}`}>{el.nom} {el.prenom}</p>
                  <table className="w-full text-sm border border-[#2B2118]">
                    <thead>
                      <tr className="border-b border-[#2B2118] bg-[#F6F1E4]">
                        <th className="text-left py-1.5 px-2 font-semibold border-r border-[#2B2118]">Trimestres</th>
                        <th className="py-1.5 px-2 font-semibold border-r border-[#2B2118]">Moyennes</th>
                        <th className="py-1.5 px-2 font-semibold">Rangs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TRIMESTRES.map((t) => {
                        const r = classementParTrimestre[t].find((x) => x.eleveId === eleveId);
                        return (
                          <tr key={t} className="border-b border-[#E3D9BF]">
                            <td className="py-1.5 px-2 border-r border-[#E3D9BF]">{t}</td>
                            <td className="py-1.5 px-2 text-center border-r border-[#E3D9BF] font-mono-num">{r?.moyenne != null ? `${r.moyenne.toFixed(2)}/${bareme}` : "—"}</td>
                            <td className="py-1.5 px-2 text-center font-mono-num">{r?.rang != null ? `${ordinal(r.rang)}${r.exaequo ? " ex" : ""}/${eleves.length}` : "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="font-semibold bg-[#F6F1E4]">
                        <td className="py-1.5 px-2 border-r border-[#E3D9BF]">Moyenne Annuelle</td>
                        <td className="py-1.5 px-2 text-center border-r border-[#E3D9BF] font-mono-num">{moyAnn != null ? `${moyAnn.toFixed(2)}/${bareme}` : "—"}</td>
                        <td className="py-1.5 px-2 text-center font-mono-num">{rangAnn?.rang != null ? `${ordinal(rangAnn.rang)}${rangAnn.exaequo ? " ex" : ""}/${eleves.length}` : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="border border-[#2B2118] rounded-xl mt-3 p-3 text-sm flex items-center justify-between gap-2 no-print">
                    <span>Décision du conseil des enseignants :</span>
                    <select
                      value={override ? override.decision : "auto"}
                      onChange={(e) => setDecisionManuelle(eleveId, e.target.value === "auto" ? (moyAnn != null && moyAnn >= bareme / 2 ? "Passe en classe supérieure" : "Redouble sa classe") : e.target.value)}
                      className="text-sm border border-[#E3D9BF] rounded px-2 py-1"
                    >
                      <option value="auto">Automatique</option>
                      <option value="Passe en classe supérieure">Passe en classe supérieure</option>
                      <option value="Redouble sa classe">Redouble sa classe</option>
                      <option value="Passe avec encouragement">Passe avec encouragement</option>
                    </select>
                  </div>
                  <p className="border border-[#2B2118] rounded-xl mt-3 p-3 text-sm text-center font-medium">
                    Le conseil des enseignants : {decisionEleve(eleveId, moyAnn)}
                  </p>
                  <div className="mt-4"><PrintButton /></div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Licence hors-ligne : le code est calculé à partir de l'email + un sel secret ----
// Aucune connexion internet requise, aucun serveur : chaque appareil vérifie seul.
function hachageSimple(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) {
    h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  }
  return h;
}
function genererCodeLicence(email) {
  const base = hachageSimple(email.trim().toLowerCase() + SEL_SECRET);
  return base.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
function verifierCodeLicence(email, code) {
  return genererCodeLicence(email) === code.trim().toUpperCase();
}

const LICENCE_LOCALE_KEY = "licence-locale-v1";
const REGISTRE_CLIENTS_KEY = "registre-clients-admin-v1"; // simple carnet de bord local, ne sert pas à la validation

function AccessGate({ onValidated }) {
  const [chargement, setChargement] = useState(true);
  const [mode, setMode] = useState("connexion");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(LICENCE_LOCALE_KEY);
        if (res && res.value) {
          const licence = JSON.parse(res.value);
          if (verifierCodeLicence(licence.email, licence.code)) {
            onValidated();
            return;
          }
        }
      } catch (e) {}
      setChargement(false);
    })();
  }, []);

  function handleConnexion(e) {
    e.preventDefault();
    setErreur("");
    if (code.trim() === CODE_MAITRE_ADMIN) {
      setMode("admin");
      return;
    }
    if (verifierCodeLicence(email, code)) {
      window.storage.set(LICENCE_LOCALE_KEY, JSON.stringify({ email: email.trim(), code: code.trim() }));
      onValidated();
    } else {
      setErreur("Adresse email ou code d'activation incorrect. Vérifie auprès du vendeur.");
    }
  }

  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F6F1E4] text-[#8A7F63]">Chargement…</div>;
  }
  if (mode === "admin") {
    return <AdminPanel onRetour={() => setMode("connexion")} />;
  }
  return (
    <div className="min-h-screen bg-[#F6F1E4] font-sans text-[#2B2118] flex items-center justify-center px-5">
      <div className="bg-white rounded-lg border border-[#E3D9BF] shadow-sm w-full max-w-sm p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="bg-[#1F3A2E] p-3 rounded-full mb-3"><GraduationCap className="w-7 h-7 text-[#C89B3C]" /></div>
          <h1 className="font-display text-xl font-semibold text-[#1F3A2E]">Cahier de Classe</h1>
          <p className="text-xs text-[#8A7F63] mt-1">Accès réservé aux utilisateurs activés</p>
        </div>
        <form onSubmit={handleConnexion} className="space-y-3">
          <div>
            <label className="text-xs text-[#8A7F63] block mb-1">Adresse email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton.email@exemple.com" className="w-full text-sm border border-[#E3D9BF] rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-[#8A7F63] block mb-1">Code d'activation</label>
            <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Reçu après achat" className="w-full text-sm border border-[#E3D9BF] rounded px-3 py-2 font-mono-num" />
          </div>
          {erreur && <p className="text-xs text-[#A33]">{erreur}</p>}
          <button type="submit" className="w-full bg-[#1F3A2E] text-white rounded px-3 py-2.5 text-sm font-medium hover:bg-[#16291F] flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> Activer l'application
          </button>
        </form>
        <p className="text-xs text-[#8A7F63] text-center mt-4">Pas encore de code ? Contacte le vendeur pour te procurer ton accès.</p>
      </div>
    </div>
  );
}

function AdminPanel({ onRetour }) {
  const [registre, setRegistre] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [emailSaisi, setEmailSaisi] = useState("");
  const [codeGenere, setCodeGenere] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(REGISTRE_CLIENTS_KEY);
        if (res && res.value) setRegistre(JSON.parse(res.value));
      } catch (e) {}
      setChargement(false);
    })();
  }, []);

  function genererEtEnregistrer(e) {
    e.preventDefault();
    if (!emailSaisi.trim()) return;
    const code = genererCodeLicence(emailSaisi);
    setCodeGenere(code);
    const nouveauRegistre = [...registre, { email: emailSaisi.trim(), code, date: new Date().toISOString().slice(0, 10) }];
    setRegistre(nouveauRegistre);
    window.storage.set(REGISTRE_CLIENTS_KEY, JSON.stringify(nouveauRegistre));
  }

  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F6F1E4] text-[#8A7F63]">Chargement…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F6F1E4] font-sans text-[#2B2118] px-5 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-[#1F3A2E]" /><h1 className="font-display text-xl font-semibold text-[#1F3A2E]">Générateur de codes clients</h1></div>
          <button onClick={onRetour} className="text-sm text-[#8A7F63] hover:underline">← Retour</button>
        </div>
        <div className="bg-white rounded-lg border border-[#E3D9BF] p-4 mb-4">
          <p className="text-sm text-[#8A7F63] mb-3">
            Après réception du paiement d'un client, saisis son email ci-dessous : le code s'affiche instantanément, sans connexion internet. Envoie-le lui par SMS ou WhatsApp.
          </p>
          <form onSubmit={genererEtEnregistrer} className="flex flex-wrap gap-2">
            <input type="email" value={emailSaisi} onChange={(e) => setEmailSaisi(e.target.value)} placeholder="Email du client" className="flex-1 min-w-[200px] text-sm border border-[#E3D9BF] rounded px-2 py-1.5" />
            <button type="submit" className="bg-[#1F3A2E] text-white rounded px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-[#16291F]"><KeyRound className="w-4 h-4" /> Générer</button>
          </form>
          {codeGenere && (
            <div className="mt-3 bg-[#F6F1E4] border border-[#C89B3C] rounded px-3 py-2 text-sm">
              Code à transmettre : <span className="font-mono-num font-bold text-lg">{codeGenere}</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-[#E3D9BF]">
          <div className="px-4 py-3 border-b border-[#E3D9BF] font-display font-semibold text-[#1F3A2E]">Carnet de bord ({registre.length})</div>
          <ul className="divide-y divide-[#EFE9D6]">
            {registre.map((r, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span>{r.email}</span>
                <span className="font-mono-num text-[#8A7F63]">{r.code} · {r.date}</span>
              </li>
            ))}
            {registre.length === 0 && <li className="px-4 py-6 text-center text-[#8A7F63] text-sm">Aucun client enregistré pour l'instant.</li>}
          </ul>
        </div>
        <p className="text-xs text-[#8A7F63] mt-3">
          Ce carnet est juste une aide-mémoire locale sur ton appareil. Comme il n'y a pas de serveur, il n'est pas possible de révoquer un code à distance une fois transmis.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [valide, setValide] = useState(false);
  if (!valide) return <AccessGate onValidated={() => setValide(true)} />;
  return <ClassManagerApp />;
}

const racine = ReactDOM.createRoot(document.getElementById("root"));
racine.render(<App />);
