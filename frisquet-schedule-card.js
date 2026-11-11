/**
 * Frisquet Schedule Card — frise hebdomadaire type "Schedule Helper Card".
 *
 * Affiche les 7 jours avec les plages Confort (rouge) / Réduit (bleu)
 * à partir de l'attribut `programmation` de l'entité climate :
 *   [{ "jour": 0..6, "plages": [0/1, ...] }]
 *
 * Installation :
 *   1. Copier ce fichier dans config/www/frisquet-schedule-card.js
 *   2. Paramètres -> Tableaux de bord -> Ressources -> ajouter :
 *      /local/frisquet-schedule-card.js (type JavaScript)
 *   3. Vider le cache du navigateur.
 *
 * Utilisation :
 *   type: custom:frisquet-schedule-card
 *   entity: climate.mazone
 *   title: Programmation de chauffe      # optionnel
 *   confort_color: "#ff5252"             # optionnel
 *   reduit_color: "#42a5f5"              # optionnel
 */

class FrisquetScheduleCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("Vous devez définir une entité");
    this.config = config;
    this._hass = null;
    this.renderRoot = this.attachShadow({ mode: "open" });
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return { entity: "" };
  }

  _render() {
    try {
      this._renderInner();
    } catch (e) {
      this.renderRoot.innerHTML =
        `<ha-card><div class="warn">Erreur carte : ${e.message}</div></ha-card>`;
      console.error("frisquet-schedule-card :", e);
    }
  }

  _renderInner() {
    if (!this.config || !this._hass) return;
    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.renderRoot.innerHTML =
        `<ha-card><div class="warn">Entité introuvable : ${this.config.entity}</div></ha-card>`;
      return;
    }
    const prog = stateObj.attributes.programmation;
    if (!prog || !prog.length) {
      this.renderRoot.innerHTML =
        `<ha-card><div class="warn">Attribut "programmation" absent de ${this.config.entity}</div></ha-card>`;
      return;
    }

    const confortColor = this.config.confort_color || "#ff5252";
    const reduitColor = this.config.reduit_color || "#42a5f5";
    // Numérotation Frisquet : 0 = dimanche, 1..6 = lundi..samedi
    const joursFrisquet = { 0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" };
    // Ordre d'affichage : lundi -> dimanche
    const ordreAffichage = [1, 2, 3, 4, 5, 6, 0];

    const byDay = {};
    let total = 0;
    for (const j of prog) {
      const d = ((j.jour % 7) + 7) % 7;
      byDay[d] = j.plages || [];
      if (byDay[d].length > total) total = byDay[d].length;
    }
    if (!total) total = 288;
    const stepMin = total >= 288 ? 5 : 30;

    // Date.getDay() : 0 = dimanche, comme la numérotation Frisquet
    const nowDay = new Date().getDay();

    const fmtTime = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    let rows = "";
    for (const d of ordreAffichage) {
      const plages = byDay[d] && byDay[d].length ? byDay[d] : new Array(total).fill(0);
      const jourNom = joursFrisquet[d];
      let blocks = "";
      let chg = "";
      let lastPct = -100;
      let i = 0;
      while (i < plages.length) {
        const v = plages[i];
        let j = i;
        while (j < plages.length && plages[j] === v) j++;
        const left = (i / total) * 100;
        const width = ((j - i) / total) * 100;
        const label = `${fmtTime(i * stepMin)} – ${j >= total ? "24:00" : fmtTime(j * stepMin)}`;
        const etat = v === 1 ? "Confort" : "Réduit";
        // Bloc (visible pour Confort, zone de survol pour Réduit)
        blocks +=
          `<div class="blk ${v === 1 ? "confort" : "reduit"}" data-tip="${jourNom} : ${etat} ${label}"
                style="left:${left}%;width:${width}%;${v === 1 ? `background:${confortColor}` : ""}"></div>`;
        // Marqueur de changement d'état (début de plage, hors 00:00)
        if (i > 0) {
          const pct = left;
          if (pct - lastPct > 5) {   // évite les libellés qui se chevauchent
            chg += `<div class="chg" style="left:${pct}%"><span>${fmtTime(i * stepMin)}</span></div>`;
            lastPct = pct;
          }
        }
        i = j;
      }
      const isToday = d === nowDay;
      rows += `
        <div class="row">
          <div class="day ${isToday ? "today" : ""}">${jourNom}</div>
          <div class="track">
            <div class="track-bg"></div>
            ${blocks}
            ${chg}
          </div>
        </div>`;
    }

    // Échelle horaire toutes les 3 h
    let scale = "";
    for (let h = 0; h <= 24; h += 3) {
      scale += `<div class="tick" style="left:${(h / 24) * 100}%">${String(h).padStart(2, "0")}</div>`;
    }

    this.renderRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .title { font-size: 1.1em; font-weight: 600; margin-bottom: 12px; }
        .warn { color: var(--error-color, red); padding: 12px; }
        .row { display: flex; align-items: center; margin-bottom: 6px; }
        .day { width: 82px; flex: none; font-size: 0.85em; color: var(--primary-text-color); }
        .day.today { font-weight: 700; color: var(--accent-color, orange); }
        .track { position: relative; flex: 1; height: 22px; margin-top: 12px; }
        .track-bg { position: absolute; inset: 0; border-radius: 6px;
                    background: ${reduitColor}; opacity: 0.35; }
        .blk { position: absolute; top: 0; height: 100%; border-radius: 4px;
               cursor: default; }
        .blk.confort { z-index: 1; }
        .blk.reduit { z-index: 1; }
        .chg { position: absolute; top: -12px; width: 0; z-index: 2; }
        .chg::before { content: ""; position: absolute; left: -1px; top: 2px;
                       width: 2px; height: 20px;
                       background: var(--primary-text-color, #333); opacity: 0.55;
                       border-radius: 1px; }
        .chg span { position: absolute; top: -11px; left: 0;
                    transform: translateX(-50%); white-space: nowrap;
                    font-size: 0.62em; color: var(--secondary-text-color); }
        .tooltip { position: fixed; z-index: 999; pointer-events: none;
                   background: var(--card-background-color, #fff);
                   color: var(--primary-text-color, #111);
                   border: 1px solid var(--divider-color, #ccc);
                   border-radius: 6px; padding: 4px 8px; font-size: 0.8em;
                   box-shadow: 0 2px 8px rgba(0,0,0,0.25); display: none; }
        .scale { position: relative; height: 18px; margin-left: 82px; }
        .tick { position: absolute; transform: translateX(-50%);
                font-size: 0.7em; color: var(--secondary-text-color); }
        .legend { display: flex; gap: 16px; margin-top: 10px;
                  font-size: 0.85em; color: var(--primary-text-color); }
        .dot { display: inline-block; width: 10px; height: 10px;
               border-radius: 50%; margin-right: 5px; vertical-align: middle; }
        .rows { position: relative; }
      </style>
      <ha-card>
        ${this.config.title ? `<div class="title">${this.config.title}</div>` : ""}
        <div class="rows">
          ${rows}
        </div>
        <div class="scale">${scale}</div>
        <div class="legend">
          <span><span class="dot" style="background:${confortColor}"></span>Confort</span>
          <span><span class="dot" style="background:${reduitColor}"></span>Réduit</span>
        </div>
        <div class="tooltip"></div>
      </ha-card>`;

    // Infobulle au survol des blocs
    const tip = this.renderRoot.querySelector(".tooltip");
    this.renderRoot.querySelectorAll(".blk").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        tip.textContent = el.dataset.tip;
        tip.style.display = "block";
      });
      el.addEventListener("mousemove", (e) => {
        tip.style.left = `${e.clientX + 12}px`;
        tip.style.top = `${e.clientY + 12}px`;
      });
      el.addEventListener("mouseleave", () => {
        tip.style.display = "none";
      });
    });
  }
}

if (!customElements.get("frisquet-schedule-card")) {
  customElements.define("frisquet-schedule-card", FrisquetScheduleCard);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "frisquet-schedule-card",
  name: "Frisquet Schedule Card",
  description: "Frise hebdomadaire de la programmation Frisquet (Confort / Réduit)",
});	
