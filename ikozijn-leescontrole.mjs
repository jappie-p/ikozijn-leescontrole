#!/usr/bin/env node

// src/cli.mjs
import { readFileSync as readFileSync2, writeFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import path2 from "node:path";

// ../inmeet/lib/inmeetTemplate.js
var TEMPLATE_VERSION = 2;
var HEADER_FIELDS = Object.freeze([
  { label: "Naam", path: "document.klant", kind: "text", region: "header" },
  { label: "Werkadres / Postcode + huisnr.", path: "document.werkadres", kind: "text", region: "header" },
  { label: "Datum", path: "document.datum", kind: "text", region: "header" },
  { label: "Inmeter", path: "document.inmeter", kind: "text", region: "header" },
  { label: "Paginanr. __ van __", path: "document.paginas", kind: "text", region: "header" }
].map((d) => Object.freeze(d)));
var DIVERSEN_LINES = Object.freeze({ A: 4, B: 7 });
var POSITIONS_PER_SHEET = 4;
function blockKindFor(index) {
  return index % POSITIONS_PER_SHEET === 0 ? "A" : "B";
}
function sparingRegion() {
  return [
    { label: "Positie", path: "positie", kind: "text", region: "sparing" },
    { label: "Ruimte / BG-VERD", path: "ruimte", kind: "text", region: "sparing" },
    { label: "Gevel", path: "locatie.gevel", kind: "options", options: ["voor", "achter", "zijgevel"], region: "sparing" },
    { label: "Zijde", path: "locatie.zijde", kind: "options", options: ["li", "re", "mid"], region: "sparing" },
    { label: "Neg", path: "referentiematen.neg", kind: "measure", region: "sparing" },
    { label: "Kozijn", path: "referentiematen.kozijn", kind: "measure", region: "sparing" },
    { label: "Dag", path: "referentiematen.dag", kind: "measure", region: "sparing" },
    // v2: printed directly under Dag in the right-hand reference column.
    { label: "Lagenm.", path: "referentiematen.lagenmaat", kind: "measure", v2: true, region: "sparing" }
  ];
}
function modelRegion() {
  return [
    { label: "Model", path: "model", kind: "options", options: ["AD.82", "NL.Royaal", "NL.Retro", "HST", "Alu"], region: "model" },
    { label: "SL/HVL", path: "verbinding", kind: "options", options: ["SL", "HVL"], region: "model" }
  ];
}
function breedteRegion() {
  return [
    { label: "Uitw.", path: "maten_breedte.uitwendig", kind: "measure", region: "breedte" },
    { label: "Inw.", path: "maten_breedte.inwendig", kind: "measure", region: "breedte" },
    { label: "Vers.L", path: "maten_breedte.verschil_links", kind: "measure", region: "breedte" },
    { label: "Vers.R", path: "maten_breedte.verschil_rechts", kind: "measure", region: "breedte" },
    // v2: samengesteld-kolommen. Gevuld bij gekoppelde of gestapelde kozijnen.
    { label: "Sam.L", path: "maten_breedte.sam_links", kind: "measure", v2: true, region: "breedte" },
    { label: "Sam.R", path: "maten_breedte.sam_rechts", kind: "measure", v2: true, region: "breedte" },
    { label: "Pm. Br.=", path: "maten_breedte.pm_breedte", kind: "measure", red: true, region: "breedte" }
  ];
}
function hoogteRegion() {
  return [
    { label: "Uitw.", path: "maten_hoogte.uitwendig", kind: "measure", region: "hoogte" },
    { label: "Inw.", path: "maten_hoogte.inwendig", kind: "measure", region: "hoogte" },
    { label: "Vers.Bov", path: "maten_hoogte.verschil_boven", kind: "measure", region: "hoogte" },
    { label: "Vers.Ond", path: "maten_hoogte.verschil_onder", kind: "measure", region: "hoogte" },
    // v2: samengesteld-rijen. Waar deze gevuld zijn geldt de simpele hoogtesom niet.
    { label: "Sam.Inw", path: "maten_hoogte.sam_inwendig", kind: "measure", v2: true, region: "hoogte" },
    { label: "Sam.Uit", path: "maten_hoogte.sam_uitwendig", kind: "measure", v2: true, region: "hoogte" },
    { label: "Pm. H.=", path: "maten_hoogte.pm_hoogte", kind: "measure", red: true, region: "hoogte" }
  ];
}
function maatketenRegion() {
  return [
    { label: "Maatketens", path: "maatketens", kind: "maatketen", region: "maatketen" }
  ];
}
function diversenRegion(kind) {
  return [
    { label: "Diversen", path: "diversen_notities", kind: "lines", lines: DIVERSEN_LINES[kind], region: "diversen" },
    // v2: het losse "D:______" hokje onderaan het diversen-blok.
    { label: "D:", path: "diversen_code", kind: "text", v2: true, region: "diversen" }
  ];
}
function optiesRegion() {
  return [
    { label: "SKG 2 pakket", path: "opties.skg2_pakket", kind: "janee", options: ["ja", "nee"], region: "opties" },
    { label: "Meerkiepstand", path: "opties.meerkiepstand", kind: "janee", options: ["ja", "nee"], region: "opties" },
    { label: "PADK", path: "opties.padk", kind: "janee", options: ["ja", "nee"], region: "opties" },
    { label: "Container", path: "opties.container", kind: "janee", options: ["ja", "nee"], region: "opties" },
    { label: "Steiger", path: "opties.steiger", kind: "janee", options: ["ja", "nee"], region: "opties" },
    { label: "Kraan (Lengte:)", path: "opties.kraan", kind: "janee", options: ["ja", "nee"], region: "opties" },
    // v2: de lengte die naast Kraan ja/nee op het formulier staat.
    { label: "Kraan lengte", path: "opties.kraan_lengte", kind: "measure", v2: true, region: "opties" }
  ];
}
function tekeningRegion() {
  return [
    { label: "Tekening", path: "tekening", kind: "tekening", v2: true, region: "tekening" }
  ];
}
function montageRegion() {
  return [
    { label: "Binnenafwerking", path: "montagespecificaties.binnenafwerking", kind: "options", options: ["Creme", "Wit", "nee"], region: "montage" },
    // v2: was static furniture, is een echt invulveld op het formulier.
    { label: "Stand/dagkant koplat:", path: "montagespecificaties.koplat_stand", kind: "text", v2: true, region: "montage" },
    { label: "Vensterbank", path: "montagespecificaties.vensterbank", kind: "options", options: ["Stone", "Creme", "Wit", "nee"], region: "montage" },
    { label: "br. (20/25/30/35/40)", path: "montagespecificaties.vensterbank_breedte", kind: "options", options: ["20", "25", "30", "35", "40"], region: "montage" },
    { label: "lengte:", path: "montagespecificaties.vensterbank_lengte", kind: "measure", region: "montage" },
    { label: "Draagconstructie (beton/staal)", path: "montagespecificaties.draagconstructie", kind: "options", options: ["beton", "staal", "nee"], region: "montage" },
    { label: "Alu lekdorpel RAL: (40/60/80/100 lengte:)", path: "montagespecificaties.alu_lekdorpel_ral", kind: "ral", region: "montage" },
    // v2: de maat en de lengte naast de Alu lekdorpel RAL.
    { label: "Alu lekdorpel maat (40/60/80/100)", path: "montagespecificaties.alu_lekdorpel_maat", kind: "options", options: ["40", "60", "80", "100"], v2: true, region: "montage" },
    { label: "Alu lekdorpel lengte", path: "montagespecificaties.alu_lekdorpel_lengte", kind: "measure", v2: true, region: "montage" },
    { label: "Raamdorpelstenen (160/105 lengte:)", path: "montagespecificaties.raamdorpelstenen", kind: "janee", options: ["ja", "nee"], region: "montage" },
    // v2: de maat en de lengte naast Raamdorpelstenen.
    { label: "Raamdorpelstenen maat (160/105)", path: "montagespecificaties.raamdorpelstenen_maat", kind: "options", options: ["160", "105"], v2: true, region: "montage" },
    { label: "Raamdorpelstenen lengte", path: "montagespecificaties.raamdorpelstenen_lengte", kind: "measure", v2: true, region: "montage" },
    // v2: was static furniture, is een ja/nee regel op het formulier.
    { label: "Stenen opmetselen", path: "montagespecificaties.stenen_opmetselen", kind: "janee", options: ["ja", "nee"], v2: true, region: "montage" },
    { label: "Lood/L.Vervanger: br.", path: "montagespecificaties.lood_ubiflex", kind: "text", region: "montage" },
    // v2: de breedte die achter "br." hoort.
    { label: "Lood/L.Vervanger breedte", path: "montagespecificaties.lood_ubiflex_breedte", kind: "measure", v2: true, region: "montage" }
  ];
}
function kozijnRegion() {
  return [
    { label: "Kozijn bui Ral", path: "kozijnspecificaties.kozijn_bu_ral", kind: "ral", region: "kozijn" },
    { label: "(glad/nerf)", path: "kozijnspecificaties.kozijn_bu_structuur", kind: "options", options: ["glad", "nerf"], region: "kozijn" },
    { label: "Kozijn bin Ral", path: "kozijnspecificaties.kozijn_bi_ral", kind: "ral", region: "kozijn" },
    { label: "(glad/nerf)", path: "kozijnspecificaties.kozijn_bi_structuur", kind: "options", options: ["glad", "nerf"], region: "kozijn" },
    { label: "Vleugel bui Ral", path: "kozijnspecificaties.vleugel_bu_ral", kind: "ral", region: "kozijn" },
    // v2: de vleugel-structuren waren static furniture terwijl de kozijn-structuren dat niet waren.
    { label: "(glad/nerf)", path: "kozijnspecificaties.vleugel_bu_structuur", kind: "options", options: ["glad", "nerf"], v2: true, region: "kozijn" },
    { label: "Vleugel bin Ral", path: "kozijnspecificaties.vleugel_bi_ral", kind: "ral", region: "kozijn" },
    { label: "(glad/nerf)", path: "kozijnspecificaties.vleugel_bi_structuur", kind: "options", options: ["glad", "nerf"], v2: true, region: "kozijn" },
    { label: "Glas (HR++/HR+++/VSG bi/bu)", path: "kozijnspecificaties.glas", kind: "text", region: "kozijn" },
    // v2: was static furniture.
    { label: "Matglas / InBlindz / roedes / TGI", path: "kozijnspecificaties.glasopties", kind: "text", v2: true, region: "kozijn" },
    { label: "Paneel", path: "kozijnspecificaties.paneel", kind: "janee", options: ["ja", "nee"], region: "kozijn" },
    // v2: was static furniture. Hoort bij Paneel.
    { label: "Schroten / horizont. / vertic. / glad", path: "kozijnspecificaties.paneel_uitvoering", kind: "text", v2: true, region: "kozijn" },
    { label: "Dorpel", path: "kozijnspecificaties.dorpel", kind: "options", options: ["Isostone", "Alu 20mm", "30mm"], region: "kozijn" },
    { label: "Rooster (op glas/op kalf)", path: "kozijnspecificaties.rooster", kind: "janee", options: ["ja", "nee"], region: "kozijn" },
    // v2: "op glas" versus "op kalf" ging verloren in de ja/nee.
    { label: "Rooster positie (op glas/op kalf)", path: "kozijnspecificaties.rooster_positie", kind: "options", options: ["op glas", "op kalf"], v2: true, region: "kozijn" },
    { label: "Inzet hor / Plisse hor", path: "kozijnspecificaties.hor", kind: "options", options: ["inzet", "plisse", "nee"], region: "kozijn" }
  ];
}
function opdrachtOnlyRegion() {
  return [
    { label: "Draairichting", path: "draairichting", kind: "text", region: "opdracht_only" },
    { label: "Aantal", path: "aantal", kind: "text", region: "opdracht_only" }
  ];
}
function blockDescriptors(kind) {
  if (kind !== "A" && kind !== "B") {
    throw new Error(`blockDescriptors: unknown block kind "${kind}" (expected 'A' or 'B')`);
  }
  const descriptors = [
    ...sparingRegion(),
    ...modelRegion(),
    ...breedteRegion(),
    ...hoogteRegion(),
    ...maatketenRegion(),
    ...diversenRegion(kind),
    ...kind === "A" ? optiesRegion() : tekeningRegion(),
    ...montageRegion(),
    ...kozijnRegion(),
    ...opdrachtOnlyRegion()
  ];
  return descriptors.map((d) => ({ ...d, block: kind }));
}
var ALL_POSITION_PATHS = Object.freeze(
  [...new Set(
    [...blockDescriptors("A"), ...blockDescriptors("B")].map((d) => d.path).filter((p) => p != null)
  )]
);
var ALL_TEMPLATE_PATHS = Object.freeze(
  [.../* @__PURE__ */ new Set([
    ...HEADER_FIELDS.map((d) => d.path).filter((p) => p != null),
    ...ALL_POSITION_PATHS
  ])]
);
var PAPER_POSITION_PATHS = Object.freeze(
  [...new Set(
    [...blockDescriptors("A"), ...blockDescriptors("B")].filter((d) => d.region !== "opdracht_only").map((d) => d.path).filter((p) => p != null)
  )]
);
var V2_ADDED_PATHS = Object.freeze(
  [...new Set(
    [...blockDescriptors("A"), ...blockDescriptors("B")].filter((d) => d.v2 === true).map((d) => d.path).filter((p) => p != null)
  )]
);

// ../inmeet/lib/consistentie.js
var MIN_POSITIES = 3;
function waarde(cel) {
  if (cel && typeof cel === "object" && !Array.isArray(cel)) {
    return "v" in cel ? cel.v : null;
  }
  return cel;
}
function provenance(cel) {
  return cel && typeof cel === "object" && "prov" in cel ? cel.prov : "gelezen";
}
function leesPad(obj, pad) {
  let node = obj;
  for (const deel of pad.split(".")) {
    if (node === null || node === void 0 || typeof node !== "object") return void 0;
    node = node[deel];
  }
  return node;
}
function afstand(a, b) {
  if (a === b) return 0;
  const rij2 = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let vorig = rij2[0];
    rij2[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tijdelijk = rij2[j];
      rij2[j] = Math.min(
        rij2[j] + 1,
        rij2[j - 1] + 1,
        vorig + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      vorig = tijdelijk;
    }
  }
  return rij2[b.length];
}
function lijktOpVerschrijving(uitschieter, heersend, { codeVeld = false } = {}) {
  const a = String(uitschieter);
  const b = String(heersend);
  if (a === b) return null;
  if (a.length < 2 || b.length < 2) return null;
  if (b.startsWith(a) && b.length - a.length <= 2) {
    return { vorm: "afkapping", toelichting: `"${a}" is het begin van "${b}"; er lijkt een teken weggevallen` };
  }
  if (a.startsWith(b) && a.length - b.length <= 2) {
    return { vorm: "afkapping", toelichting: `"${b}" is het begin van "${a}"; er lijkt een teken bij gekomen` };
  }
  if (codeVeld && a.length === b.length && a.length >= 4 && a.slice(0, 2) === b.slice(0, 2)) {
    const d = afstand(a, b);
    if (d > 0 && d <= 2) {
      return { vorm: "verschrijving", toelichting: `"${a}" en "${b}" zitten in dezelfde codegroep en schelen maar ${d} teken(s)` };
    }
  }
  return null;
}
var CODE_VELDEN = /(_ral|profiel|code)$/;
var NIET_VERGELIJKEN = /* @__PURE__ */ new Set([
  "positie",
  "ruimte",
  "diversen_notities",
  "diversen_code",
  "maatketens",
  "tekening",
  "locatie.gevel",
  "locatie.zijde"
]);
function vergelijkbarePaden() {
  const paden = /* @__PURE__ */ new Set();
  for (const kind of ["A", "B"]) {
    for (const d of blockDescriptors(kind)) {
      if (!d.path || d.region === "opdracht_only") continue;
      if (NIET_VERGELIJKEN.has(d.path)) continue;
      if (d.path.startsWith("maten_")) continue;
      paden.add(d.path);
    }
  }
  return [...paden];
}
function consistentieChecks(doc) {
  const posities = Array.isArray(doc?.posities) ? doc.posities : [];
  if (posities.length < MIN_POSITIES) return [];
  const alGemeld = /* @__PURE__ */ new Set();
  for (const p of posities) {
    const lijst2 = [
      ...Array.isArray(p?.onzekere_velden) ? p.onzekere_velden : [],
      ...Array.isArray(p?.leesbaarheid?.onzekere_velden) ? p.leesbaarheid.onzekere_velden : []
    ];
    for (const item of lijst2) {
      const pad = typeof item === "string" ? item : item?.path;
      if (pad) alGemeld.add(`${p.positie}|${pad}`);
    }
  }
  const meldingen = [];
  for (const pad of vergelijkbarePaden()) {
    const gevonden2 = [];
    for (const p of posities) {
      const cel = leesPad(p, pad);
      const v = waarde(cel);
      if (v === null || v === void 0 || v === "") continue;
      if (provenance(cel) !== "gelezen") continue;
      gevonden2.push({ positie: p.positie, ruimte: p.ruimte ?? null, v: String(v) });
    }
    if (gevonden2.length < MIN_POSITIES) continue;
    const telling = /* @__PURE__ */ new Map();
    for (const g of gevonden2) telling.set(g.v, (telling.get(g.v) || 0) + 1);
    const eenmalig = [...telling].filter(([, n]) => n === 1).map(([v]) => v);
    if (eenmalig.length !== 1) continue;
    const [heersend, aantal] = [...telling].sort((a, b) => b[1] - a[1])[0];
    if (aantal < 2 || heersend === eenmalig[0]) continue;
    const gelijkenis = lijktOpVerschrijving(eenmalig[0], heersend, { codeVeld: CODE_VELDEN.test(pad) });
    if (!gelijkenis) continue;
    const bron = gevonden2.find((g) => g.v === eenmalig[0]);
    if (alGemeld.has(`${bron.positie}|${pad}`)) continue;
    meldingen.push({
      positie: bron.positie,
      ruimte: bron.ruimte,
      veld: pad,
      type: "afwijkend_in_formulier",
      vorm: gelijkenis.vorm,
      gelezen: eenmalig[0],
      elders: heersend,
      elders_aantal: aantal,
      reden: `${gelijkenis.toelichting}, en ${aantal} andere positie(s) op dit formulier zeggen "${heersend}". Dit hoeft niet fout te zijn, maar het heeft de vorm van een leesfout in plaats van een keuze.`,
      actie: "leg deze cel naast de andere posities en bevestig wat er staat"
    });
  }
  return meldingen;
}

// ../inmeet/lib/inmeetCheck.js
var AXES = {
  breedte: ["uitwendig", "inwendig", "verschil_links", "verschil_rechts"],
  hoogte: ["uitwendig", "inwendig", "verschil_boven", "verschil_onder"]
};
var SAM_CELLS = {
  breedte: ["sam_links", "sam_rechts"],
  hoogte: ["sam_inwendig", "sam_uitwendig"]
};
function cell(x) {
  if (x && typeof x === "object" && "prov" in x) {
    return { v: typeof x.v === "number" && Number.isFinite(x.v) ? x.v : null, prov: x.prov, sug: typeof x.sug === "number" ? x.sug : null };
  }
  if (typeof x === "number" && Number.isFinite(x)) return { v: x, prov: "gelezen", sug: null };
  return { v: null, prov: "geflagd", sug: null };
}
function getCell(maten, key) {
  return cell(maten ? maten[key] : void 0);
}
function onzekereVelden(pos) {
  const ruw = [
    ...Array.isArray(pos?.onzekere_velden) ? pos.onzekere_velden : [],
    ...Array.isArray(pos?.leesbaarheid?.onzekere_velden) ? pos.leesbaarheid.onzekere_velden : []
  ];
  const perPad = /* @__PURE__ */ new Map();
  for (const item of ruw) {
    const path3 = typeof item === "string" ? item : item?.path;
    if (!path3) continue;
    const reason = typeof item === "string" ? null : item.reason ?? null;
    const bestaand = perPad.get(path3);
    if (!bestaand) perPad.set(path3, { path: path3, reason });
    else if (!bestaand.reason && reason) bestaand.reason = reason;
  }
  return [...perPad.values()];
}
function positieConfidence(pos) {
  return pos?.confidence ?? pos?.leesbaarheid?.confidence ?? null;
}
function axisCheck(maten, axis, positieType) {
  const keys = AXES[axis];
  const cells = keys.map((k) => getCell(maten, k));
  const provs = cells.map((c) => c.prov);
  const sam = SAM_CELLS[axis].filter((k) => getCell(maten, k).v !== null);
  const isSamengesteld = positieType === "samengesteld" || sam.length > 0;
  const samReden = sam.length > 0 ? `${sam.join(" en ")} ingevuld` : "uitlezing markeert de positie als samengesteld";
  const alleGelezen = cells.every((c) => c.prov === "gelezen" && c.v !== null);
  if (!alleGelezen) {
    if (isSamengesteld) {
      return {
        axis,
        status: "samengesteld",
        toelichting: `${samReden}: niet alle cellen van de simpele som zijn ingevuld, wat bij een gekoppeld of gestapeld kozijn normaal is. De som zegt hier niets.`,
        sam_cellen: sam,
        cel_provs: provs
      };
    }
    return {
      axis,
      status: "niet_onafhankelijk",
      toelichting: "minstens 1 cel is gereconstrueerd of geflagd; de som kan niets onafhankelijk bevestigen",
      cel_provs: provs
    };
  }
  const [uitV, inwV, aV, bV] = cells.map((c) => c.v);
  const som = inwV + aV + bV;
  const afw = uitV - som;
  const berekening = `${inwV} + ${aV} + ${bV} = ${som} (uitwendig genoteerd ${uitV})`;
  if (afw !== 0 && isSamengesteld) {
    return {
      axis,
      status: "samengesteld_som_nvt",
      berekening,
      verschil_mm: afw,
      klopt: null,
      alle_cellen_gelezen: true,
      samengesteld: true,
      sam_cellen: sam,
      toelichting: `${samReden}. De simpele som geldt hier niet: uitwendig is de maat over het hele samenstel en inwendig die van een enkel element. Het verschil van ${Math.abs(afw)} mm is daarvan het gevolg, niet van een meetfout. Deze as is dus niet gecontroleerd.`
    };
  }
  return {
    axis,
    status: afw === 0 ? "klopt" : "wijkt_af",
    berekening,
    afwijking_mm: afw,
    klopt: afw === 0,
    alle_cellen_gelezen: true,
    samengesteld: isSamengesteld,
    ...isSamengesteld ? { toelichting: `${samReden}. De buitenmaten sluiten wel, maar bij een samengesteld kozijn hoeft de simpele som niet de juiste controle te zijn.` } : {}
  };
}
function geometrieAnomalie(maten, axis) {
  const uit2 = getCell(maten, "uitwendig");
  const inw = getCell(maten, "inwendig");
  if (uit2.prov === "gelezen" && inw.prov === "gelezen" && uit2.v !== null && inw.v !== null && uit2.v < inw.v) {
    return { axis, uitwendig: uit2.v, inwendig: inw.v, toelichting: `uitwendig (${uit2.v}) < inwendig (${inw.v}) is fysiek onmogelijk; beide helder gelezen, dus een echte formulier-anomalie` };
  }
  return null;
}
function checkPositie(pos) {
  const type = pos.positie_type === "samengesteld" ? "samengesteld" : "enkel";
  const breedte = axisCheck(pos.maten_breedte, "breedte", type);
  const hoogte = axisCheck(pos.maten_hoogte, "hoogte", type);
  const geo = [geometrieAnomalie(pos.maten_breedte, "breedte"), geometrieAnomalie(pos.maten_hoogte, "hoogte")].filter(Boolean);
  return { positie: pos.positie, ruimte: pos.ruimte ?? null, positie_type: type, confidence: positieConfidence(pos), breedte_check: breedte, hoogte_check: hoogte, geometrie: geo };
}
function buildCheckList(doc, positieChecks) {
  const items = [];
  const posById = new Map((doc.posities || []).map((p) => [String(p.positie), p]));
  for (const pc of positieChecks) {
    const pos = posById.get(String(pc.positie));
    for (const axis of ["maten_breedte", "maten_hoogte"]) {
      const maten = pos ? pos[axis] : null;
      if (!maten) continue;
      for (const key of Object.keys(maten)) {
        const c = cell(maten[key]);
        if (c.prov === "geflagd" || c.prov === "gereconstrueerd") {
          const onz = onzekereVelden(pos).find((o) => o.path === `${axis}.${key}`);
          items.push({
            positie: pc.positie,
            ruimte: pc.ruimte ?? null,
            veld: `${axis}.${key}`,
            type: c.prov,
            suggestie: c.sug ?? null,
            reden: onz ? onz.reason : c.prov === "gereconstrueerd" ? "afgeleid uit de som, niet zelfstandig gelezen" : "onleesbaar",
            actie: "controleer wat er op het formulier staat"
          });
        }
      }
    }
    for (const chk of [pc.breedte_check, pc.hoogte_check]) {
      if (chk && chk.status === "wijkt_af") {
        items.push({
          positie: pc.positie,
          ruimte: pc.ruimte ?? null,
          veld: `maten_${chk.axis} (som)`,
          type: "niet_sluitend",
          reden: `${chk.berekening}, ${Math.abs(chk.afwijking_mm)} mm afwijking terwijl alle cellen helder gelezen zijn`,
          actie: "echte inconsistentie op het formulier: laat controleren"
        });
      }
      if (chk && chk.status === "samengesteld_som_nvt") {
        items.push({
          positie: pc.positie,
          ruimte: pc.ruimte ?? null,
          veld: `maten_${chk.axis} (som)`,
          type: "niet_gecontroleerd",
          reden: chk.toelichting,
          actie: "geen actie nodig als de positie inderdaad samengesteld is; controleer anders of de Sam.-cellen kloppen"
        });
      }
    }
    for (const g of pc.geometrie) {
      items.push({
        positie: pc.positie,
        ruimte: pc.ruimte ?? null,
        veld: `maten_${g.axis}`,
        type: "geometrie_anomalie",
        reden: g.toelichting,
        actie: "onmogelijke maat: laat controleren"
      });
    }
    const alGemeld = new Set(items.filter((i) => i.positie === pc.positie).map((i) => i.veld));
    for (const onz of onzekereVelden(pos)) {
      if (!onz?.path || alGemeld.has(onz.path)) continue;
      items.push({
        positie: pc.positie,
        ruimte: pc.ruimte ?? null,
        veld: onz.path,
        type: "onzeker_gelezen",
        reden: onz.reason ?? "door de lezer als onzeker gemarkeerd",
        actie: "controleer wat er op het formulier staat"
      });
    }
    const ruimteAlGemeld = items.some((i) => i.positie === pc.positie && i.veld === "ruimte");
    if (pos && !ruimteAlGemeld && (pos.ruimte === null || pos.ruimte === void 0)) {
      items.push({ positie: pc.positie, ruimte: null, veld: "ruimte", type: "ontbreekt", reden: "geen ruimtenaam ingevuld", actie: "vul de ruimte in indien bekend" });
    }
  }
  return items;
}
function hasPath(obj, path3) {
  let node = obj;
  for (const seg of path3.split(".")) {
    if (node === null || node === void 0 || typeof node !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(node, seg)) return false;
    node = node[seg];
  }
  return true;
}
function paperPathsForIndex(index) {
  return blockDescriptors(blockKindFor(index)).filter((d) => d.region !== "opdracht_only" && d.path != null).map((d) => d.path);
}
function coverageReport(doc) {
  const posities = Array.isArray(doc?.posities) ? doc.posities : [];
  const headerPaths = HEADER_FIELDS.map((d) => d.path).filter(Boolean);
  const headerOntbreekt = headerPaths.filter((p) => !hasPath(doc, p.replace(/^document\./, "document.")));
  const perPositie = posities.map((pos, i) => {
    const verwacht = paperPathsForIndex(i);
    const ontbreekt = verwacht.filter((p) => !hasPath(pos, p));
    return {
      positie: pos.positie ?? i + 1,
      ruimte: pos.ruimte ?? null,
      bloktype: blockKindFor(i),
      velden_op_papier: verwacht.length,
      velden_aanwezig: verwacht.length - ontbreekt.length,
      ontbrekende_velden: ontbreekt
    };
  });
  const totaalVerwacht = perPositie.reduce((n, p) => n + p.velden_op_papier, 0) + headerPaths.length;
  const totaalOntbreekt = perPositie.reduce((n, p) => n + p.ontbrekende_velden.length, 0) + headerOntbreekt.length;
  return {
    template_versie: TEMPLATE_VERSION,
    volledig: totaalOntbreekt === 0,
    velden_op_papier: totaalVerwacht,
    velden_aanwezig: totaalVerwacht - totaalOntbreekt,
    ontbrekende_header_velden: headerOntbreekt,
    per_positie: perPositie
  };
}
function checkReadout(doc) {
  if (!doc || typeof doc !== "object") throw new Error("uitlezing ontbreekt of is geen object");
  if (!Array.isArray(doc.posities)) throw new Error("uitlezing.posities ontbreekt (verwacht een array met posities)");
  const positieChecks = doc.posities.map(checkPositie);
  const checkList = buildCheckList(doc, positieChecks);
  const dekking = coverageReport(doc);
  for (const p of dekking.per_positie) {
    for (const veld of p.ontbrekende_velden) {
      const alGemeld = checkList.some((i) => String(i.positie) === String(p.positie) && i.veld === veld);
      if (alGemeld) continue;
      checkList.push({
        positie: p.positie,
        ruimte: p.ruimte,
        veld,
        type: "niet_uitgelezen",
        reden: "staat op het formulier maar komt niet voor in de uitlezing, dus er is niet naar gekeken",
        actie: "lees dit veld alsnog uit, of markeer het expliciet als leeg"
      });
    }
  }
  for (const m of consistentieChecks(doc)) {
    const alGemeld = checkList.some((i) => String(i.positie) === String(m.positie) && i.veld === m.veld);
    if (!alGemeld) checkList.push(m);
  }
  const telling = {
    posities: positieChecks.length,
    te_controleren_velden: checkList.length,
    onleesbaar_geflagd: checkList.filter((i) => i.type === "geflagd").length,
    gereconstrueerd: checkList.filter((i) => i.type === "gereconstrueerd").length,
    niet_sluitende_sommen: checkList.filter((i) => i.type === "niet_sluitend").length,
    geometrie_anomalieen: checkList.filter((i) => i.type === "geometrie_anomalie").length,
    niet_uitgelezen: checkList.filter((i) => i.type === "niet_uitgelezen").length,
    onzeker_gelezen: checkList.filter((i) => i.type === "onzeker_gelezen").length,
    niet_gecontroleerd: checkList.filter((i) => i.type === "niet_gecontroleerd").length,
    afwijkend_in_formulier: checkList.filter((i) => i.type === "afwijkend_in_formulier").length,
    samengestelde_posities: positieChecks.filter(
      (p) => p.positie_type === "samengesteld" || p.breedte_check?.status === "samengesteld" || p.hoogte_check?.status === "samengesteld" || p.breedte_check?.status === "samengesteld_som_nvt" || p.hoogte_check?.status === "samengesteld_som_nvt"
    ).length
  };
  return {
    klant: doc.document?.klant ?? null,
    telling,
    dekking,
    check_deze_velden: checkList,
    posities: positieChecks,
    _verificatie: "provenance-bewuste, niet-circulaire maat-checks tegen inmeetTemplate v2 (server-side, bridge)"
  };
}

// ../inmeet/lib/leescontroleKaders.js
var BLANCO = Object.freeze({
  breedte_pt: 595.32,
  hoogte_pt: 841.92
});
var BLOK_OORSPRONG = Object.freeze({
  voorkant: Object.freeze([120.4, 476.6]),
  achterkant: Object.freeze([105.8, 462.1])
});
var IJKLIJNEN = Object.freeze({
  voorkant: Object.freeze({ rijen: [133.9, 490.3, 823.7], kolommen: [36, 111.6, 325.4, 354.2, 543.6] }),
  achterkant: Object.freeze({ rijen: [119.5, 475.9, 809.3], kolommen: [36, 111.6, 325.4, 354.2, 543.6] })
});
var STANDAARD_VERSCHUIVING = Object.freeze({ dx: -7.2, dy: -7.2 });
var KOP_KADERS = Object.freeze({
  "document.klant": { x: 58, y: 64, w: 250, h: 22 },
  "document.werkadres": { x: 90, y: 84, w: 240, h: 30 },
  "document.datum": { x: 400, y: 48, w: 115, h: 22 },
  "document.inmeter": { x: 405, y: 70, w: 112, h: 20 },
  "document.paginas": { x: 420, y: 90, w: 100, h: 20 }
});
var TEKENVAK = { x: 38, y: 66, w: 288, h: 112 };
var CEL_KADERS = Object.freeze({
  positie: { x: 64, y: 12, w: 50, h: 17 },
  ruimte: { x: 155, y: 12, w: 171, h: 166 },
  "locatie.gevel": { x: 176, y: 12, w: 138, h: 17 },
  "locatie.zijde": { x: 176, y: 12, w: 138, h: 17 },
  "referentiematen.neg": { x: 326, y: 12, w: 78, h: 15 },
  "referentiematen.kozijn": { x: 326, y: 25, w: 78, h: 15 },
  "referentiematen.dag": { x: 326, y: 39, w: 78, h: 15 },
  "referentiematen.lagenmaat": { x: 326, y: 53, w: 66, h: 15 },
  model: { x: 36, y: 41, w: 78, h: 26 },
  verbinding: { x: 36, y: 25, w: 78, h: 16 },
  // De breedtecellen zijn smal en een inmeter schrijft er graag overheen ("2565"
  // begint links van zijn kolom), dus elke cel krijgt 6 pt extra aan beide kanten.
  "maten_breedte.uitwendig": { x: 108, y: 26, w: 45, h: 32 },
  "maten_breedte.inwendig": { x: 141, y: 26, w: 41, h: 32 },
  "maten_breedte.verschil_links": { x: 170, y: 26, w: 48, h: 32 },
  "maten_breedte.verschil_rechts": { x: 206, y: 26, w: 50, h: 32 },
  "maten_breedte.sam_links": { x: 244, y: 26, w: 48, h: 32 },
  "maten_breedte.sam_rechts": { x: 280, y: 26, w: 48, h: 32 },
  "maten_breedte.pm_breedte": { x: 284, y: 175, w: 120, h: 18 },
  "maten_hoogte.uitwendig": { x: 326, y: 66, w: 66, h: 15 },
  "maten_hoogte.inwendig": { x: 326, y: 80, w: 66, h: 15 },
  "maten_hoogte.verschil_boven": { x: 326, y: 94, w: 66, h: 15 },
  "maten_hoogte.verschil_onder": { x: 326, y: 108, w: 66, h: 15 },
  "maten_hoogte.sam_inwendig": { x: 326, y: 121, w: 66, h: 15 },
  "maten_hoogte.sam_uitwendig": { x: 326, y: 135, w: 66, h: 15 },
  "maten_hoogte.pm_hoogte": { x: 36, y: 148, w: 80, h: 18 },
  maatketens: TEKENVAK,
  tekening: { x: 36, y: 193, w: 158, h: 155, alleen: "B" },
  diversen_notities: { x: 195, y: 193, w: 195, h: 100, B: { h: 138 } },
  diversen_code: { x: 195, y: 330, w: 70, h: 17, alleen: "B" },
  "opties.skg2_pakket": { x: 36, y: 193, w: 154, h: 15, alleen: "A" },
  "opties.meerkiepstand": { x: 36, y: 207, w: 154, h: 15, alleen: "A" },
  "opties.padk": { x: 36, y: 220, w: 154, h: 15, alleen: "A" },
  "opties.container": { x: 195, y: 301, w: 135, h: 15, alleen: "A" },
  "opties.steiger": { x: 195, y: 315, w: 135, h: 15, alleen: "A" },
  "opties.kraan": { x: 195, y: 330, w: 135, h: 15, alleen: "A" },
  "opties.kraan_lengte": { x: 272, y: 330, w: 118, h: 15, alleen: "A" },
  "montagespecificaties.binnenafwerking": { x: 404, y: 13, w: 140, h: 15 },
  "montagespecificaties.koplat_stand": { x: 404, y: 27, w: 140, h: 14 },
  "montagespecificaties.vensterbank": { x: 404, y: 40, w: 140, h: 15 },
  "montagespecificaties.vensterbank_breedte": { x: 404, y: 53, w: 66, h: 16 },
  "montagespecificaties.vensterbank_lengte": { x: 470, y: 53, w: 74, h: 16 },
  "montagespecificaties.draagconstructie": { x: 404, y: 67, w: 140, h: 27 },
  "montagespecificaties.alu_lekdorpel_ral": { x: 404, y: 94, w: 140, h: 15 },
  "montagespecificaties.alu_lekdorpel_maat": { x: 404, y: 108, w: 66, h: 14 },
  "montagespecificaties.alu_lekdorpel_lengte": { x: 470, y: 108, w: 74, h: 14 },
  "montagespecificaties.raamdorpelstenen": { x: 404, y: 121, w: 140, h: 14 },
  "montagespecificaties.raamdorpelstenen_maat": { x: 404, y: 134, w: 62, h: 15 },
  "montagespecificaties.raamdorpelstenen_lengte": { x: 466, y: 134, w: 78, h: 15 },
  "montagespecificaties.stenen_opmetselen": { x: 404, y: 148, w: 140, h: 15 },
  "montagespecificaties.lood_ubiflex": { x: 404, y: 173, w: 140, h: 15 },
  "montagespecificaties.lood_ubiflex_breedte": { x: 478, y: 173, w: 42, h: 15 },
  "kozijnspecificaties.kozijn_bu_ral": { x: 404, y: 198, w: 106, h: 15 },
  "kozijnspecificaties.kozijn_bu_structuur": { x: 505, y: 198, w: 39, h: 15 },
  "kozijnspecificaties.kozijn_bi_ral": { x: 404, y: 212, w: 106, h: 15 },
  "kozijnspecificaties.kozijn_bi_structuur": { x: 505, y: 212, w: 39, h: 15 },
  "kozijnspecificaties.vleugel_bu_ral": { x: 404, y: 225, w: 106, h: 15 },
  "kozijnspecificaties.vleugel_bu_structuur": { x: 505, y: 225, w: 39, h: 15 },
  "kozijnspecificaties.vleugel_bi_ral": { x: 404, y: 239, w: 106, h: 15 },
  "kozijnspecificaties.vleugel_bi_structuur": { x: 505, y: 239, w: 39, h: 15 },
  "kozijnspecificaties.glas": { x: 404, y: 252, w: 140, h: 15 },
  "kozijnspecificaties.glasopties": { x: 404, y: 266, w: 140, h: 15 },
  "kozijnspecificaties.paneel": { x: 404, y: 280, w: 140, h: 14 },
  "kozijnspecificaties.paneel_uitvoering": { x: 404, y: 293, w: 140, h: 14 },
  "kozijnspecificaties.dorpel": { x: 404, y: 306, w: 140, h: 15 },
  "kozijnspecificaties.rooster_positie": { x: 404, y: 320, w: 96, h: 15 },
  "kozijnspecificaties.rooster": { x: 500, y: 320, w: 44, h: 15 },
  "kozijnspecificaties.hor": { x: 404, y: 334, w: 140, h: 16 }
});
var MARGE_PT = 2;
function plaatsVoorPositie(index) {
  const i = Number.isInteger(index) && index >= 0 ? index : 0;
  const opVel = i % 4;
  return {
    pagina: Math.floor(i / 2) + 1,
    zijde: opVel < 2 ? "voorkant" : "achterkant",
    blok: opVel % 2,
    kind: opVel === 0 ? "A" : "B"
  };
}
function kaderVoor(pad, plaats) {
  if (pad.startsWith("document.")) {
    if (plaats.zijde !== "voorkant") return null;
    const k = KOP_KADERS[pad];
    return k ? { ...k } : null;
  }
  const cel = CEL_KADERS[pad];
  if (!cel) return null;
  if (cel.alleen && cel.alleen !== plaats.kind) return null;
  const oorsprong = BLOK_OORSPRONG[plaats.zijde]?.[plaats.blok];
  if (oorsprong == null) return null;
  const eigen = cel[plaats.kind] || {};
  return {
    x: cel.x,
    y: oorsprong + cel.y,
    w: eigen.w ?? cel.w,
    h: eigen.h ?? cel.h
  };
}
function naarPixels(kaderPt, { dpi, verschuiving = STANDAARD_VERSCHUIVING, marge = MARGE_PT } = {}) {
  const s = dpi / 72;
  return {
    x: Math.round((kaderPt.x - marge + verschuiving.dx) * s),
    y: Math.round((kaderPt.y - marge + verschuiving.dy) * s),
    w: Math.round((kaderPt.w + 2 * marge) * s),
    h: Math.round((kaderPt.h + 2 * marge) * s)
  };
}

// ../inmeet/lib/scanBron.js
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
var MEET_DPI = 100;
var ZOEK_PX = 45;
var DONKER = 170;
var MIN_SCORE = { rijen: 0.45, kolommen: 0.3 };
function metWerkmap(fn) {
  const werk = mkdtempSync(path.join(tmpdir(), "inmeet-scan-"));
  try {
    return fn(werk);
  } finally {
    rmSync(werk, { recursive: true, force: true });
  }
}
function pdftoppm(args) {
  execFileSync("pdftoppm", args, { stdio: ["ignore", "ignore", "pipe"] });
}
function gevonden(werk, stam, ext) {
  const f = readdirSync(werk).find((n) => n.startsWith(`${stam}-`) && n.endsWith(`.${ext}`));
  if (!f) throw new Error(`pdftoppm leverde geen ${ext} op voor ${stam}`);
  return path.join(werk, f);
}
function aantalPaginas(pdfPad) {
  const uit2 = execFileSync("pdfinfo", [pdfPad], { encoding: "utf8" });
  const m = /^Pages:\s+(\d+)/m.exec(uit2);
  return m ? Number(m[1]) : 0;
}
function jpegMaat(buf) {
  if (buf[0] !== 255 || buf[1] !== 216) throw new Error("geen JPEG");
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 255) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 216 || marker >= 208 && marker <= 215 || marker === 1) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);
    if (isSof) return { hoogte: buf.readUInt16BE(i + 5), breedte: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("JPEG zonder SOF-marker");
}
function renderPagina(pdfPad, nr, { dpi = 200, kwaliteit = 82 } = {}) {
  return metWerkmap((werk) => {
    pdftoppm([
      "-r",
      String(dpi),
      "-f",
      String(nr),
      "-l",
      String(nr),
      "-jpeg",
      "-jpegopt",
      `quality=${kwaliteit}`,
      pdfPad,
      path.join(werk, "p")
    ]);
    const buf = readFileSync(gevonden(werk, "p", "jpg"));
    return { buffer: buf, dpi, ...jpegMaat(buf) };
  });
}
function leesPgm(buf) {
  const kop = buf.subarray(0, 40).toString("latin1");
  const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(kop);
  if (!m) throw new Error("geen PGM");
  const start = m[0].length;
  return { breedte: Number(m[1]), hoogte: Number(m[2]), px: buf.subarray(start) };
}
function profielen({ breedte: w, hoogte: h, px }) {
  const x0 = Math.floor(w * 0.08);
  const x1 = Math.floor(w * 0.92);
  const rijen = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let d = 0;
    const basis = y * w;
    for (let x = x0; x < x1; x++) if (px[basis + x] < DONKER) d++;
    rijen[y] = d / (x1 - x0);
  }
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.floor(h * 0.7);
  const kolommen = new Float32Array(w);
  for (let y = y0; y < y1; y++) {
    const basis = y * w;
    for (let x = 0; x < w; x++) if (px[basis + x] < DONKER) kolommen[x]++;
  }
  for (let x = 0; x < w; x++) kolommen[x] /= y1 - y0;
  return { rijen, kolommen };
}
function besteVerschuiving(profiel, verwachtPx) {
  let beste = { d: 0, score: -1 };
  for (let d = -ZOEK_PX; d <= ZOEK_PX; d++) {
    let som = 0;
    for (const p of verwachtPx) {
      const c = Math.round(p) + d;
      let m = 0;
      for (let k = -1; k <= 1; k++) {
        const v = profiel[c + k];
        if (v != null && v > m) m = v;
      }
      som += m;
    }
    const score = som / verwachtPx.length;
    if (score > beste.score) beste = { d, score };
  }
  return beste;
}
function registreer(pdfPad, nr, zijde) {
  const lijnen = IJKLIJNEN[zijde];
  if (!lijnen) throw new Error(`onbekende zijde "${zijde}"`);
  const pgm = metWerkmap((werk) => {
    pdftoppm(["-r", String(MEET_DPI), "-f", String(nr), "-l", String(nr), "-gray", pdfPad, path.join(werk, "g")]);
    return leesPgm(readFileSync(gevonden(werk, "g", "pgm")));
  });
  const { rijen, kolommen } = profielen(pgm);
  const s = MEET_DPI / 72;
  const ry = besteVerschuiving(rijen, lijnen.rijen.map((pt) => pt * s));
  const cx = besteVerschuiving(kolommen, lijnen.kolommen.map((pt) => pt * s));
  const ok = ry.score >= MIN_SCORE.rijen && cx.score >= MIN_SCORE.kolommen;
  return {
    uitgelijnd: ok,
    verschuiving: ok ? { dx: cx.d / s, dy: ry.d / s } : { ...STANDAARD_VERSCHUIVING },
    score: { rijen: Number(ry.score.toFixed(2)), kolommen: Number(cx.score.toFixed(2)) },
    gemeten_px: { dx: cx.d, dy: ry.d }
  };
}
function laadScan(pdfPad, paginas, { dpi = 200, kwaliteit = 82 } = {}) {
  const totaal = aantalPaginas(pdfPad);
  const uit2 = /* @__PURE__ */ new Map();
  for (const { nr, zijde } of paginas) {
    if (nr < 1 || nr > totaal) {
      uit2.set(nr, { ontbreekt: true, totaal });
      continue;
    }
    const beeld = renderPagina(pdfPad, nr, { dpi, kwaliteit });
    const reg = registreer(pdfPad, nr, zijde);
    uit2.set(nr, {
      dataUri: `data:image/jpeg;base64,${beeld.buffer.toString("base64")}`,
      breedte: beeld.breedte,
      hoogte: beeld.hoogte,
      dpi,
      zijde,
      ...reg
    });
  }
  return { paginas: uit2, totaal };
}

// ../inmeet/lib/leescontroleBouw.js
var GROEPEN = Object.freeze([
  ["sparing", "Sparing"],
  ["model", "Model"],
  ["breedte", "Breedte"],
  ["hoogte", "Hoogte"],
  ["maatketen", "Tekenvak"],
  ["diversen", "Diversen"],
  ["opties", "Opties"],
  ["tekening", "Tekenvak"],
  ["montage", "Montage"],
  ["kozijn", "Kozijn"]
]);
function haal(obj, pad) {
  return pad.split(".").reduce((o, k) => o == null ? void 0 : o[k], obj);
}
function toonWaarde(x) {
  if (x === null || x === void 0 || x === "") return { tekst: "leeg", prov: "leeg" };
  if (Array.isArray(x)) {
    const delen = x.map((d) => toonWaarde(d).tekst).filter((t) => t !== "leeg");
    return delen.length ? { tekst: delen.join(" | "), prov: "gelezen" } : { tekst: "leeg", prov: "leeg" };
  }
  if (typeof x === "boolean") return { tekst: x ? "ja" : "nee", prov: "gelezen" };
  if (typeof x === "object" && "prov" in x) {
    const v = x.v;
    switch (x.prov) {
      case "gereconstrueerd":
        return { tekst: "niet gelezen", prov: "gereconstrueerd", suggestie: x.sug ?? null };
      case "geflagd":
        return { tekst: v == null ? "niet overgenomen" : `${v} (niet overgenomen)`, prov: "geflagd" };
      case "leeg":
        return { tekst: "leeg", prov: "leeg" };
      default:
        return v == null || v === "" ? { tekst: "leeg", prov: "leeg" } : { tekst: String(v), prov: "gelezen" };
    }
  }
  if (typeof x === "object") {
    const delen = Object.entries(x).map(([k, v]) => `${k}: ${toonWaarde(v).tekst}`);
    return { tekst: delen.join(", "), prov: "gelezen" };
  }
  return { tekst: String(x), prov: "gelezen" };
}
function sleutel(positie, veld) {
  return `${String(positie)}|${veld}`;
}
function twijfelIndex(controle2) {
  const perCel = /* @__PURE__ */ new Map();
  const notities = /* @__PURE__ */ new Map();
  for (const item of controle2?.check_deze_velden ?? []) {
    const veld = String(item.veld || "");
    const item2 = { type: item.type, reden: item.reden, suggestie: item.suggestie ?? null };
    if (/\s|\(/.test(veld) || veld === "") {
      const lijst2 = notities.get(String(item.positie)) || [];
      lijst2.push({ veld, ...item2 });
      notities.set(String(item.positie), lijst2);
    } else {
      const k = sleutel(item.positie, veld);
      const al = perCel.get(k);
      perCel.set(k, al ? { ...al, reden: `${al.reden} ${item2.reden}`.trim(), suggestie: al.suggestie ?? item2.suggestie } : item2);
    }
  }
  return { perCel, notities };
}
function venster(kaderPx, pagina) {
  const { breedte: PB, hoogte: PH } = pagina;
  const x = Math.max(0, kaderPx.x);
  const y = Math.max(0, kaderPx.y);
  const w = Math.min(kaderPx.w, PB - x);
  const h = Math.min(kaderPx.h, PH - y);
  if (w <= 0 || h <= 0) return null;
  const pct = (deel, geheel) => geheel <= 0 ? 0 : deel / geheel * 100;
  return {
    pagina: pagina.nr,
    size: `${PB / w * 100}% auto`,
    posX: pct(x, PB - w),
    posY: pct(y, PH - h),
    ratio: w / h
  };
}
function rij({ pad, label, region, positie, ruimte, plaats, waarde: waarde2, twijfel, pagina, verschuiving, dpi }) {
  const kader = kaderVoor(pad, plaats);
  const getoond = toonWaarde(waarde2);
  let beeld = null;
  if (kader && pagina && !pagina.ontbreekt) {
    beeld = venster(naarPixels(kader, { dpi, verschuiving }), pagina);
    if (beeld) beeld.groot = kader.h > 40;
  }
  return {
    pad,
    label,
    groep: region,
    positie,
    ruimte: ruimte ?? null,
    waarde: getoond.tekst,
    prov: getoond.prov,
    suggestie: getoond.suggestie ?? twijfel?.suggestie ?? null,
    twijfel: twijfel ? { type: twijfel.type, reden: twijfel.reden } : null,
    beeld
  };
}
function bouwLeescontrole({ uitlezing: uitlezing2, controle: controle2, scanPad: scanPad2, dpi = 200 }) {
  const posities = uitlezing2?.posities ?? [];
  const plaatsen = posities.map((_, i) => plaatsVoorPositie(i));
  const nodig = /* @__PURE__ */ new Map();
  for (const p of plaatsen) nodig.set(p.pagina, { nr: p.pagina, zijde: p.zijde });
  if (!nodig.has(1)) nodig.set(1, { nr: 1, zijde: "voorkant" });
  let paginas = /* @__PURE__ */ new Map();
  let scan2 = null;
  if (scanPad2) {
    scan2 = laadScan(scanPad2, [...nodig.values()], { dpi });
    paginas = scan2.paginas;
    for (const [nr, pg] of paginas) pg.nr = nr;
  }
  const { perCel, notities } = twijfelIndex(controle2);
  const gebruikt = /* @__PURE__ */ new Set();
  const rijen = [];
  const kopPlaats = { zijde: "voorkant", blok: 0, kind: "A", pagina: 1 };
  for (const d of HEADER_FIELDS) {
    const pg = paginas.get(1);
    rijen.push(rij({
      pad: d.path,
      label: d.label,
      region: "kop",
      positie: null,
      ruimte: null,
      plaats: kopPlaats,
      waarde: haal(uitlezing2, d.path),
      twijfel: null,
      pagina: pg,
      verschuiving: pg?.verschuiving,
      dpi
    }));
  }
  posities.forEach((pos, i) => {
    const plaats = plaatsen[i];
    const pg = paginas.get(plaats.pagina);
    const positie = pos.positie ?? i + 1;
    for (const d of blockDescriptors(plaats.kind)) {
      if (!d.path || d.region === "opdracht_only") continue;
      if (!kaderVoor(d.path, plaats)) continue;
      const waarde2 = d.path === "positie" ? positie : haal(pos, d.path);
      const k = sleutel(positie, d.path);
      if (perCel.has(k)) gebruikt.add(k);
      rijen.push(rij({
        pad: d.path,
        label: d.label,
        region: d.region,
        positie,
        ruimte: pos.ruimte,
        plaats,
        waarde: waarde2,
        twijfel: perCel.get(k) || null,
        pagina: pg,
        verschuiving: pg?.verschuiving,
        dpi
      }));
    }
  });
  for (const [k, t] of perCel) {
    const veld = k.split("|")[1];
    if (!veld.startsWith("document.")) continue;
    const kop = rijen.find((r) => r.pad === veld);
    if (!kop) continue;
    gebruikt.add(k);
    if (!kop.twijfel) kop.twijfel = { type: t.type, reden: t.reden };
  }
  const losse = [];
  for (const [k, t] of perCel) {
    if (gebruikt.has(k)) continue;
    const [pos, veld] = k.split("|");
    const lijst2 = notities.get(pos);
    const notitie = { veld, type: t.type, reden: t.reden, suggestie: t.suggestie ?? null };
    if (lijst2) lijst2.push(notitie);
    else if (posities.some((p, i) => String(p.positie ?? i + 1) === pos)) notities.set(pos, [notitie]);
    else losse.push({ positie: pos === "undefined" || pos === "null" ? null : pos, ...notitie });
  }
  const bekend = new Set(posities.map((p, i) => String(p.positie ?? i + 1)));
  for (const [pos, lijst2] of notities) {
    if (bekend.has(pos)) continue;
    for (const n of lijst2) losse.push({ positie: pos === "undefined" || pos === "null" ? null : pos, ...n });
  }
  const twijfelRijen = rijen.filter((r) => r.twijfel);
  const beelden2 = /* @__PURE__ */ new Map();
  for (const [nr, pg] of paginas) {
    if (!pg.ontbreekt) beelden2.set(nr, { dataUri: pg.dataUri, uitgelijnd: pg.uitgelijnd, score: pg.score, zijde: pg.zijde, ratio: pg.breedte / pg.hoogte });
  }
  const ontbrekend = [...paginas].filter(([, pg]) => pg.ontbreekt).map(([nr]) => nr);
  return {
    klant: toonWaarde(uitlezing2?.document?.klant).tekst,
    datum: toonWaarde(uitlezing2?.document?.datum).tekst,
    posities: posities.map((pos, i) => ({ positie: pos.positie ?? i + 1, ruimte: pos.ruimte ?? null, notities: notities.get(String(pos.positie ?? i + 1)) || [] })),
    losse,
    rijen,
    twijfel: twijfelRijen.length,
    beelden: beelden2,
    scan: scan2 ? { paginas_in_scan: scan2.totaal, ontbrekend } : null
  };
}
function twijfelLijst(inhoud2) {
  const cellen = inhoud2.rijen.filter((r) => r.twijfel).map((r) => ({
    soort: "cel",
    positie: r.positie,
    pad: r.pad,
    label: r.label,
    type: r.twijfel.type,
    reden: r.twijfel.reden,
    suggestie: r.suggestie ?? null,
    gelezen: r.waarde
  }));
  const notities = [
    ...inhoud2.posities.flatMap((p) => p.notities.map((n) => ({ ...n, positie: p.positie }))),
    ...inhoud2.losse || []
  ].map((n) => ({
    soort: "notitie",
    positie: n.positie ?? null,
    pad: n.veld,
    label: n.veld,
    type: n.type,
    reden: n.reden,
    suggestie: n.suggestie ?? null,
    gelezen: null
  }));
  return [...cellen, ...notities].map((x, i) => ({ nr: i + 1, ...x }));
}

// ../inmeet/lib/chatAntwoord.js
var LABELS = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const h of HEADER_FIELDS) m.set(h.path, h.label);
  for (const kind of ["A", "B"]) for (const d of blockDescriptors(kind)) if (d.path && !m.has(d.path)) m.set(d.path, d.label);
  return m;
})();
function veldLabel(veld) {
  if (!veld) return "";
  const som = /^(maten_\w+) \(som\)$/.exec(veld);
  if (som) return `${som[1] === "maten_breedte" ? "breedte" : "hoogte"} (som)`;
  if (veld === "maten_breedte" || veld === "maten_hoogte") return veld === "maten_breedte" ? "breedte" : "hoogte";
  return LABELS.get(veld) || veld.split(".").pop().replace(/_/g, " ");
}
function kaleWaarde(veld) {
  if (veld && typeof veld === "object" && !Array.isArray(veld)) {
    const v = veld.v ?? veld.waarde ?? null;
    return v == null ? "" : String(v).trim();
  }
  return veld == null ? "" : String(veld).trim();
}
function klantNaam(veld) {
  const kaal = kaleWaarde(veld);
  if (!kaal) return "";
  const kort = kaal.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(/[,;\n]/)[0].replace(/\s+/g, " ").trim();
  return (kort || kaal).slice(0, 40);
}

// ../inmeet/lib/nakijkformulier.js
var esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/[^\x00-\x7F]/gu, (c) => `&#${c.codePointAt(0)};`);
var TYPE_TEKST = {
  gereconstrueerd: "niet zelf gelezen",
  onzeker_gelezen: "onzeker gelezen",
  geflagd: "niet overgenomen",
  ontbreekt: "ontbreekt",
  niet_uitgelezen: "niet uitgelezen",
  niet_sluitend: "som sluit niet",
  niet_gecontroleerd: "niet gecontroleerd",
  geometrie_anomalie: "kan fysiek niet",
  afwijkend_in_formulier: "wijkt af van de rest"
};
function venster2(rij2) {
  if (!rij2.beeld) return '<div class="venster geen">geen uitsnede</div>';
  const b = rij2.beeld;
  return `<div class="venster pg${b.pagina}${b.groot ? " groot" : ""}" role="img" aria-label="uitsnede ${esc(rij2.label)}" style="--ratio:${b.ratio.toFixed(4)};--size:${b.size};--px:${b.posX.toFixed(3)}%;--py:${b.posY.toFixed(3)}%"></div>`;
}
function waar(positie) {
  return positie != null && positie !== "" ? `Positie ${esc(positie)}` : "Kop";
}
function rijHtml(rij2, { nr = null, metPositie = false } = {}) {
  const afgeleid = rij2.prov === "gereconstrueerd" ? `<span class="chip">${rij2.suggestie != null ? `afgeleid: ${esc(rij2.suggestie)}` : "afgeleid"}</span>` : "";
  const reden = rij2.twijfel ? `<p class="reden"><b>${esc(TYPE_TEKST[rij2.twijfel.type] || rij2.twijfel.type)}.</b> ${esc(rij2.twijfel.reden)}</p>` : "";
  return `<div class="rij${rij2.twijfel ? " twijfel" : ""}">
  ${nr != null ? `<span class="nr">${nr}</span>` : ""}${venster2(rij2)}
  <div class="tekst">
    ${metPositie ? `<span class="waar">${waar(rij2.positie)}${rij2.ruimte ? ` &middot; ${esc(rij2.ruimte)}` : ""}</span>` : ""}
    <span class="label">${esc(rij2.label)}</span>
    <span class="waarde${rij2.prov === "leeg" ? " leeg" : ""}">${esc(rij2.waarde)}${afgeleid}</span>
    ${reden}
  </div>
</div>`;
}
function notitieHtml(t) {
  return `<div class="rij twijfel notitie">
  <span class="nr">${t.nr}</span><div class="venster geen">geen uitsnede</div>
  <div class="tekst">
    <span class="waar">${waar(t.positie)}</span>
    <span class="label">${esc(veldLabel(t.pad))}</span>
    <p class="reden"><b>${esc(TYPE_TEKST[t.type] || t.type)}.</b> ${esc(t.reden)}</p>
  </div>
</div>`;
}
var CSS = `
:root{--paper:#F3F3F0;--kaart:#fff;--inkt:#1C232B;--grijs:#6B7480;--lijn:#DCDFDA;--blauw:#1F4E9C;
--amber:#8A5A00;--amber-vlak:#FBF1DC;--merk:#C8102E}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#15181D;--kaart:#1C2027;--inkt:#E4E7EB;--grijs:#9AA3AE;
--lijn:#2C323B;--blauw:#7FA6E8;--amber:#E5A742;--amber-vlak:#33270F;--merk:#F0455E}}
:root[data-theme=dark]{--paper:#15181D;--kaart:#1C2027;--inkt:#E4E7EB;--grijs:#9AA3AE;--lijn:#2C323B;--blauw:#7FA6E8;
--amber:#E5A742;--amber-vlak:#33270F;--merk:#F0455E}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--inkt);-webkit-font-smoothing:antialiased;
font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px clamp(12px,3vw,32px) 64px}
.wrap{max-width:60rem;margin:0 auto}
header.top{display:grid;gap:.4rem;margin-bottom:1rem}
.eyebrow{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--merk);font-weight:700}
h1{font-size:clamp(1.5rem,3.5vw,2.1rem);line-height:1.15;margin:0;font-weight:700;text-wrap:balance}
.lead{color:var(--grijs);max-width:46rem;margin:0}
.antwoord{margin:.8rem 0 0;padding:.7rem .9rem;background:var(--kaart);border:1px solid var(--lijn);border-left:3px solid var(--merk);border-radius:5px}
.antwoord b{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
h2{font-size:1.15rem;margin:2rem 0 .6rem;font-weight:700}
h2 small{font-weight:400;color:var(--grijs);font-size:.85rem;margin-left:.5rem}
h3{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--grijs);margin:0;font-weight:700;
padding:.5rem .9rem;border-bottom:1px solid var(--lijn);background:var(--paper)}
.let-op{margin:.3rem 0;padding:.55rem .8rem;background:var(--amber-vlak);color:var(--amber);border-radius:4px;font-size:.9rem}
.groep{background:var(--kaart);border:1px solid var(--lijn);border-radius:6px;margin-bottom:.9rem;overflow:hidden}
.rij{display:grid;grid-template-columns:minmax(120px,15rem) 1fr;gap:.9rem;align-items:center;padding:.55rem .9rem;border-bottom:1px solid var(--lijn)}
.rij:last-child{border-bottom:0}
.rij.twijfel{background:var(--amber-vlak);grid-template-columns:2rem minmax(120px,15rem) 1fr}
.nr{width:2rem;height:2rem;border-radius:50%;background:var(--amber);color:var(--kaart);display:grid;place-items:center;
font-weight:700;font-variant-numeric:tabular-nums;font-size:.95rem}
.venster{height:min(5.5rem,calc(15rem / var(--ratio,3)));aspect-ratio:var(--ratio,3);max-width:100%;background-size:var(--size);
background-position:var(--px) var(--py);background-repeat:no-repeat;background-color:#fff;border:1px solid var(--lijn);border-radius:3px;justify-self:start}
.venster.groot{height:min(13rem,calc(15rem / var(--ratio,1)))}
.venster.geen{height:auto;aspect-ratio:auto;padding:.4rem .6rem;color:var(--grijs);font-size:.78rem;background:var(--paper)}
.tekst{display:grid;gap:.1rem;min-width:0}
.waar{font-size:.72rem;color:var(--grijs);text-transform:uppercase;letter-spacing:.06em}
.label{font-size:.82rem;color:var(--grijs)}
.waarde{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;color:var(--blauw);font-weight:600;
overflow-wrap:anywhere;display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.waarde.leeg{color:var(--grijs);font-weight:400}
.chip{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:.7rem;font-weight:600;padding:.15rem .45rem;
border-radius:3px;white-space:nowrap;background:var(--amber-vlak);color:var(--amber);outline:1px solid var(--amber)}
.reden{margin:.25rem 0 0;font-size:.85rem;color:var(--amber)}
details.hele{margin:.2rem 0 .8rem}
details.hele summary{cursor:pointer;font-size:.85rem;color:var(--grijs)}
details.hele .pagina{width:100%;aspect-ratio:var(--pratio,0.7);background-size:100% auto;background-repeat:no-repeat;background-color:#fff;
border:1px solid var(--lijn);border-radius:4px;margin-top:.5rem}
.voet{margin-top:2rem;border-top:1px solid var(--lijn);padding-top:1rem;color:var(--grijs);font-size:.85rem}
@media(max-width:600px){.rij,.rij.twijfel{grid-template-columns:1fr}.nr{justify-self:start}
.venster{width:100%;height:auto}.venster.groot{width:min(100%,20rem);height:auto}}
`;
function bouwNakijkformulier(inhoud2) {
  const lijst2 = twijfelLijst(inhoud2);
  const nrVoorRij = /* @__PURE__ */ new Map();
  const twijfelRijen = inhoud2.rijen.filter((r) => r.twijfel);
  twijfelRijen.forEach((r, i) => nrVoorRij.set(r, i + 1));
  const notities = lijst2.filter((t) => t.soort === "notitie");
  const n = lijst2.length;
  const voorbeeld = n > 0 ? `<b>${Math.min(n, 3)} is 745, de rest klopt</b>` : "<b>klopt</b>";
  const antwoord = `<p class="antwoord">Zeg in de chat wat er niet klopt, met het nummer erbij. Bijvoorbeeld: ${voorbeeld}. Daar leert hij van, dus de volgende keer vraagt hij minder.</p>`;
  const eerst = n > 0 ? `<h2>Eerst deze ${n}<small>hier twijfelde de assistent</small></h2>
<div class="groep">${twijfelRijen.map((r) => rijHtml(r, { nr: nrVoorRij.get(r), metPositie: true })).join("")}${notities.map(notitieHtml).join("")}</div>` : "<h2>Geen twijfel<small>de assistent las alles met overtuiging; loop de rest toch even na</small></h2>";
  const rest = inhoud2.rijen.filter((r) => !r.twijfel);
  const kop = rest.filter((r) => r.groep === "kop");
  const perPositie = inhoud2.posities.map((p) => {
    const eigen = rest.filter((r) => r.positie != null && String(r.positie) === String(p.positie));
    const groepen = GROEPEN.map(([g, titel]) => {
      const rijen = eigen.filter((r) => r.groep === g);
      return rijen.length ? `<div class="groep"><h3>${esc(titel)}</h3>${rijen.map((r) => rijHtml(r)).join("")}</div>` : "";
    }).join("");
    const pg = inhoud2.rijen.find((r) => String(r.positie) === String(p.positie) && r.beeld)?.beeld?.pagina;
    const b = pg && inhoud2.beelden.get(pg);
    const hele = b ? `<details class="hele"><summary>Hele scanpagina ${pg} bekijken</summary><div class="pagina pg${pg}" style="--pratio:${b.ratio.toFixed(4)}" role="img" aria-label="scanpagina ${pg}"></div></details>` : "";
    return `<h2>Positie ${esc(p.positie)}${p.ruimte ? `<small>${esc(p.ruimte)}</small>` : ""}</h2>${hele}${groepen}`;
  }).join("");
  const beeldCss = [...inhoud2.beelden].map(([nr, b]) => `.pg${nr}{background-image:url("${b.dataUri}")}`).join("\n");
  const nietUitgelijnd = [...inhoud2.beelden].filter(([, b]) => !b.uitgelijnd).map(([nr]) => nr);
  const letOp2 = [];
  if (!inhoud2.scan) {
    letOp2.push("Er is geen scan meegegeven, dus er staan geen uitsnedes bij. Kijk op je eigen scan mee.");
  } else {
    if (inhoud2.scan.ontbrekend?.length) letOp2.push(`Pagina ${inhoud2.scan.ontbrekend.join(" en ")} zit niet in de scan; die cellen hebben geen uitsnede.`);
    if (inhoud2.beelden.size > 0 && nietUitgelijnd.length === inhoud2.beelden.size) {
      letOp2.push("De scan past op geen enkele pagina op het inmeetformulier. Is dit wel het inmeetformulier? De uitsnedes hieronder kunnen op de verkeerde plek zitten.");
    } else if (nietUitgelijnd.length) {
      letOp2.push(`Op pagina ${nietUitgelijnd.join(" en ")} kon de scan niet worden uitgelijnd; de uitsnedes kunnen daar iets verschoven staan.`);
    }
  }
  const klant = inhoud2.klant && inhoud2.klant !== "leeg" ? inhoud2.klant : "Inmeting";
  const datum = inhoud2.datum && inhoud2.datum !== "leeg" ? ` &middot; ${esc(inhoud2.datum)}` : "";
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(klant)}: klopt dit?</title>
<style>${CSS}
${beeldCss}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <span class="eyebrow">i-Kozijn &middot; inmeetformulier${datum}</span>
    <h1>${esc(klant)}: klopt dit?</h1>
    <p class="lead">Links een stukje van je scan, rechts wat de assistent eruit las. ${n > 0 ? `Bovenaan de ${n} waar hij twijfelde, genummerd.` : "Hij twijfelde nergens over."}</p>
    ${letOp2.map((t) => `<p class="let-op">${esc(t)}</p>`).join("")}
    ${antwoord}
  </header>
  ${eerst}
  ${kop.length ? `<h2>Kop</h2><div class="groep">${kop.map((r) => rijHtml(r)).join("")}</div>` : ""}
  ${perPositie}
  <p class="voet">${inhoud2.rijen.length} cellen, ${n} met twijfel. De scan zelf is niet naar de connector gestuurd; alleen wat je in de chat zegt telt mee.</p>
</div>
</body>
</html>
`;
}

// ../inmeet/lib/pakket.js
var PAKKET_NAAM = "ikozijn-leescontrole";
var PAKKET_VERSIE = "1.0.0";

// src/cli.mjs
var HULP = `${PAKKET_NAAM} ${PAKKET_VERSIE}

gebruik: ${PAKKET_NAAM} <scan.pdf> <uitlezing.json> [--uit <map of bestand>]

  scan.pdf        de gescande PDF van het inmeetformulier
  uitlezing.json  de uitlezing zoals je hem aan check_inmeetformulier gaf
                  (het object met document en posities, of {"uitlezing": ...})
  --uit           waar het formulier heen moet; standaard de huidige map`;
function stop(melding) {
  console.error(`FOUT: ${melding}`);
  process.exit(1);
}
function leesArgumenten(argv) {
  const los = [];
  let uit2 = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      console.log(HULP);
      process.exit(0);
    }
    if (a === "-v" || a === "--version" || a === "--versie") {
      console.log(PAKKET_VERSIE);
      process.exit(0);
    }
    if (a === "--uit" || a === "--out") {
      uit2 = argv[++i] ?? stop("--uit zonder map");
      continue;
    }
    los.push(a);
  }
  return { scan: los[0] ?? null, uitlezingPad: los[1] ?? null, uit: uit2 };
}
function leesUitlezing(pad) {
  if (!pad) stop(`geen uitlezing meegegeven.

${HULP}`);
  if (!existsSync(pad)) stop(`uitlezing "${pad}" bestaat niet`);
  let data;
  try {
    data = JSON.parse(readFileSync2(pad, "utf8"));
  } catch (e) {
    stop(`uitlezing "${pad}" is geen geldige JSON: ${e.message}`);
  }
  if (data && typeof data === "object" && data.uitlezing && typeof data.uitlezing === "object") data = data.uitlezing;
  if (!data || !Array.isArray(data.posities) || data.posities.length === 0) {
    stop('de uitlezing heeft geen posities. Verwacht het object met "document" en "posities", precies zoals je het aan check_inmeetformulier gaf.');
  }
  return data;
}
function uitvoerPad(uit2, uitlezing2) {
  const naam = (klantNaam(uitlezing2?.document?.klant) || "inmeting").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") || "inmeting";
  const bestand = `Nakijken_${naam}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.html`;
  if (!uit2) return path2.resolve(bestand);
  if (/\.html?$/i.test(uit2)) {
    mkdirSync(path2.dirname(path2.resolve(uit2)), { recursive: true });
    return path2.resolve(uit2);
  }
  mkdirSync(uit2, { recursive: true });
  return path2.resolve(uit2, bestand);
}
var { scan, uitlezingPad, uit } = leesArgumenten(process.argv.slice(2));
var uitlezing = leesUitlezing(uitlezingPad);
var controle;
try {
  controle = checkReadout(structuredClone(uitlezing));
} catch (e) {
  stop(`de controle liep vast: ${e.message}`);
}
var letOp = [];
var scanPad = null;
if (!scan) letOp.push("geen scan meegegeven; het formulier heeft geen uitsnedes");
else if (!existsSync(scan) || !statSync(scan).isFile()) letOp.push(`scan "${scan}" niet gevonden; het formulier heeft geen uitsnedes`);
else if (!/\.pdf$/i.test(scan)) letOp.push(`"${path2.basename(scan)}" is geen PDF; uitsnedes gaan alleen uit een PDF`);
else scanPad = scan;
var inhoud;
try {
  inhoud = bouwLeescontrole({ uitlezing, controle, scanPad });
} catch (e) {
  letOp.push(`de scan kon niet worden opgesneden (${e.message.split("\n")[0]}); het formulier heeft geen uitsnedes`);
  inhoud = bouwLeescontrole({ uitlezing, controle, scanPad: null });
}
var html = bouwNakijkformulier(inhoud);
var doel = uitvoerPad(uit, uitlezing);
writeFileSync(doel, html, "utf8");
var lijst = twijfelLijst(inhoud);
var beelden = [...inhoud.beelden];
if (inhoud.scan?.ontbrekend?.length) letOp.push(`pagina ${inhoud.scan.ontbrekend.join(" en ")} zit niet in de scan`);
if (beelden.length && beelden.every(([, b]) => !b.uitgelijnd)) letOp.push("de scan past op geen enkele pagina op het inmeetformulier; is dit wel het inmeetformulier?");
else for (const [nr, b] of beelden) if (!b.uitgelijnd) letOp.push(`pagina ${nr} kon niet worden uitgelijnd; uitsnedes daar kunnen verschoven staan`);
var regels = [
  `Nakijkformulier: ${doel}`,
  `${inhoud.rijen.length} cellen, ${lijst.length} met twijfel, ${beelden.length ? `${beelden.length} scanpagina('s)` : "zonder scan"}, ${Math.round(html.length / 1024)} KB.`,
  ...letOp.map((t) => `LET OP: ${t}`)
];
if (lijst.length) {
  regels.push("", "Nummers op het formulier (dezelfde als in chat_antwoord):");
  for (const t of lijst) {
    const waar2 = t.positie != null && t.positie !== "" ? `Pos ${t.positie}` : "Kop";
    regels.push(`${t.nr}. ${waar2} ${veldLabel(t.pad)} [${t.pad}]${t.gelezen != null ? `: gelezen ${t.gelezen}` : ""}`);
  }
}
console.log(regels.join("\n"));
