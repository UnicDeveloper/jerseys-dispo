(function () {
  const STORAGE_SESSION = "rk-admin";
  const STORAGE_GITHUB = "rk-github";
  const STORAGE_DRAFT = "rk-draft";

  const config = window.APP_CONFIG || {};
  const state = {
    data: {
      updatedAt: null,
      numbers: {},
      unnumbered: [],
    },
    filter: "all",
    query: "",
    admin: sessionStorage.getItem(STORAGE_SESSION) === "1",
  };

  const els = {
    grid: document.getElementById("grid"),
    stats: document.getElementById("stats"),
    search: document.getElementById("search"),
    updated: document.getElementById("updated-label"),
    adminBtn: document.getElementById("btn-admin"),
    publishBtn: document.getElementById("btn-publish"),
    unnumbered: document.getElementById("unnumbered-list"),
    addUnnumbered: document.getElementById("btn-add-unnumbered"),
    emptyNumbers: document.getElementById("empty-numbers"),
    modal: document.getElementById("modal"),
    modalCard: document.querySelector(".modal-card"),
    modalBody: document.getElementById("modal-body"),
    modalClose: document.getElementById("modal-close"),
    toast: document.getElementById("toast"),
    kitBtn: document.getElementById("btn-kit"),
  };

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 2800);
  }

  function isTaken(num) {
    const item = state.data.numbers[String(num)];
    return Boolean(item && item.name && item.name.trim());
  }

  function holder(num) {
    return (state.data.numbers[String(num)] || {}).name || "";
  }

  function formatWhen(iso) {
    if (!iso) return "Todavía no hay cambios publicados";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return "Actualizado " + date.toLocaleString("es-CL");
  }

  function matchesQuery(num) {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    const name = holder(num).toLowerCase();
    return String(num).includes(q) || name.includes(q);
  }

  function visibleNumbers() {
    const list = [];
    for (let n = 0; n <= 99; n += 1) {
      const taken = isTaken(n);
      if (state.filter === "free" && taken) continue;
      if (state.filter === "taken" && !taken) continue;
      if (!matchesQuery(n)) continue;
      list.push(n);
    }
    return list;
  }

  function renderStats() {
    let taken = 0;
    for (let n = 0; n <= 99; n += 1) if (isTaken(n)) taken += 1;
    const unnumberedTaken = (state.data.unnumbered || []).filter((item) => item.holder).length;
    const unnumberedFree = (state.data.unnumbered || []).length - unnumberedTaken;
    els.stats.innerHTML = `
      <div class="stat"><b>${100 - taken}</b><span>números libres</span></div>
      <div class="stat"><b>${taken}</b><span>números ocupados</span></div>
      <div class="stat"><b>${unnumberedFree}</b><span>camisetas sin número libres</span></div>
    `;
    els.updated.textContent = formatWhen(state.data.updatedAt);
  }

  function renderGrid() {
    const nums = visibleNumbers();
    els.emptyNumbers.classList.toggle("hidden", nums.length > 0);
    els.grid.innerHTML = nums
      .map((n) => {
        const taken = isTaken(n);
        const who = holder(n);
        return `
          <button type="button" class="jersey ${taken ? "taken" : "free"}" data-num="${n}">
            <span class="jersey-num">${n}</span>
            <span class="jersey-who">${taken ? escapeHtml(who) : "Reservar"}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderUnnumbered() {
    const items = state.data.unnumbered || [];
    if (!items.length) {
      els.unnumbered.innerHTML = `<p class="empty">No hay camisetas sin número cargadas todavía.</p>`;
      return;
    }
    const q = state.query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        (item.holder || "").toLowerCase().includes(q)
      );
    });
    els.unnumbered.innerHTML = filtered
      .map(
        (item) => `
        <button type="button" class="kit-card ${item.holder ? "taken" : "free"}" data-uid="${item.id}">
          <span class="tag">${item.holder ? "Ocupada" : "Disponible"}</span>
          <h3>${escapeHtml(item.label)}</h3>
          <p>${item.holder ? escapeHtml(item.holder) : "Sin asignar"}</p>
        </button>
      `
      )
      .join("");
  }

  function renderChrome() {
    els.adminBtn.textContent = state.admin ? "Salir de admin" : "Entrar como admin";
    els.addUnnumbered.classList.toggle("hidden", !state.admin);
    els.publishBtn.classList.toggle("hidden", !state.admin);
  }

  function render() {
    renderChrome();
    renderStats();
    renderGrid();
    renderUnnumbered();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openModal(html, wide) {
    els.modalBody.innerHTML = html;
    els.modalCard.classList.toggle("wide", Boolean(wide));
    els.modal.classList.remove("hidden");
    const first = els.modal.querySelector("input, button:not(.icon-close)");
    if (first) first.focus();
  }

  function closeModal() {
    els.modal.classList.add("hidden");
    els.modalCard.classList.remove("wide");
    els.modalBody.innerHTML = "";
  }

  function githubSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_GITHUB) || "{}");
    } catch {
      return {};
    }
  }

  function guessRepo() {
    const host = location.hostname;
    if (host.endsWith("github.io")) {
      const owner = host.split(".")[0];
      const parts = location.pathname.split("/").filter(Boolean);
      const repo = parts[0] || `${owner}.github.io`;
      return { owner, repo };
    }
    return { owner: "", repo: "jerseys-dispo" };
  }

  async function loadData() {
    try {
      const res = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo leer data.json");
      const json = await res.json();
      state.data = {
        updatedAt: json.updatedAt || null,
        numbers: json.numbers || {},
        unnumbered: Array.isArray(json.unnumbered) ? json.unnumbered : [],
      };
    } catch {
      const draft = localStorage.getItem(STORAGE_DRAFT);
      if (draft) state.data = JSON.parse(draft);
    }
    render();
  }

  function persistDraft() {
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(state.data));
  }

  function toBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  async function publish() {
    const settings = githubSettings();
    state.data.updatedAt = new Date().toISOString();
    persistDraft();

    if (!settings.token || !settings.owner || !settings.repo) {
      downloadData();
      toast("Se descargó data.json. Súbelo al repo para que lo vean todos.");
      return;
    }

    const path = "data.json";
    const api = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    try {
      const current = await fetch(api, { headers });
      const currentJson = await current.json();
      const sha = current.ok ? currentJson.sha : undefined;
      const body = {
        message: "Actualizar números Red Knights",
        content: toBase64(JSON.stringify(state.data, null, 2) + "\n"),
        sha,
      };
      const saved = await fetch(api, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!saved.ok) {
        const err = await saved.json().catch(() => ({}));
        throw new Error(err.message || "GitHub rechazó la publicación");
      }
      toast("Publicado. En un minuto lo ven todos en la web.");
    } catch (error) {
      downloadData();
      toast(error.message + " · Se descargó data.json para que lo subas a mano.");
    }
  }

  function downloadData() {
    const blob = new Blob([JSON.stringify(state.data, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function loginForm() {
    openModal(`
      <h2 id="modal-title">Admin</h2>
      <p>Entra con la contraseña de <code>config.js</code>. Después puedes marcar números y publicar.</p>
      <label class="field">
        <span>Contraseña</span>
        <input id="password" type="password" autocomplete="current-password" />
      </label>
      <button type="button" class="btn gold full" id="do-login">Entrar</button>
    `);
  }

  function settingsForm() {
    const guessed = guessRepo();
    const current = { ...guessed, ...githubSettings() };
    openModal(`
      <h2 id="modal-title">Publicar cambios</h2>
      <p>Para que los jugadores lo vean en GitHub Pages, pega un token con permiso de Contents. Si no, se descarga <code>data.json</code> para que lo subas tú.</p>
      <label class="field"><span>Usuario de GitHub</span><input id="gh-owner" value="${escapeHtml(current.owner || "")}" /></label>
      <label class="field"><span>Repositorio</span><input id="gh-repo" value="${escapeHtml(current.repo || "")}" /></label>
      <label class="field"><span>Token</span><input id="gh-token" type="password" value="${escapeHtml(current.token || "")}" placeholder="ghp_…" /></label>
      <div class="actions">
        <button type="button" class="btn gold" id="save-gh">Guardar y publicar</button>
        <button type="button" class="btn ghost" id="only-download">Solo descargar</button>
      </div>
    `);
  }

  function whatsappNumber() {
    return String(config.whatsapp || "56923686783").replace(/\D/g, "");
  }

  function openWhatsAppOrder(num, playerName) {
    const name = playerName.trim();
    if (!name) {
      toast("Escribe el nombre que va en la camiseta.");
      return;
    }
    const text = [
      "Hola, quiero reservar un número de Red Knights.",
      "Quiero mandar a confeccionar la camiseta con este pedido:",
      "Nombre: " + name,
      "Número: " + num,
    ].join("\n");
    const url = "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
  }

  function numberForm(num) {
    const taken = isTaken(num);
    const name = holder(num);
    if (state.admin) {
      openModal(`
        <h2 id="modal-title">Dorsal ${num}</h2>
        <p>Escribe quién lo usa. Déjalo vacío y guarda para liberarlo.</p>
        <label class="field">
          <span>Jugador o staff</span>
          <input id="player-name" value="${escapeHtml(name)}" placeholder="Ej. Juan Pérez" />
        </label>
        <div class="actions">
          <button type="button" class="btn gold" id="save-number">Guardar</button>
          <button type="button" class="btn danger" id="free-number">Liberar</button>
          <button type="button" class="btn ghost" id="open-publish">Publicar</button>
        </div>
      `);
      return;
    }
    if (taken) {
      openModal(`
        <h2 id="modal-title">Dorsal ${num}</h2>
        <p>Este número ya está ocupado por <strong>${escapeHtml(name)}</strong>. Elige uno verde para reservar.</p>
      `);
      return;
    }
    openModal(`
      <h2 id="modal-title">Reserva el ${num}</h2>
      <p>Escribe el nombre que quieres estampado. Te abrimos WhatsApp para pedir la confección de la camiseta.</p>
      <label class="field">
        <span>Nombre en la camiseta</span>
        <input id="reserve-name" maxlength="40" placeholder="Ej. R. Sotomayor" autocomplete="name" />
      </label>
      <button type="button" class="btn whatsapp full" id="send-whatsapp" data-num="${num}">Pedir por WhatsApp</button>
    `);
  }

  function unnumberedForm(id) {
    const creating = id === "new";
    const item = creating
      ? { id: "u-" + Date.now(), label: "", holder: "" }
      : (state.data.unnumbered || []).find((x) => x.id === id);
    if (!item) return;
    if (!state.admin) {
      openModal(`
        <h2 id="modal-title">${escapeHtml(item.label)}</h2>
        <p>${item.holder ? "Ocupada por <strong>" + escapeHtml(item.holder) + "</strong>." : "Esta camiseta sin número está libre."}</p>
      `);
      return;
    }
    openModal(`
      <h2 id="modal-title">${creating ? "Nueva camiseta" : "Camiseta sin número"}</h2>
      <label class="field"><span>Qué pieza es</span><input id="kit-label" value="${escapeHtml(item.label)}" placeholder="Ej. Camiseta staff" /></label>
      <label class="field"><span>Quién la tiene (vacío = libre)</span><input id="kit-holder" value="${escapeHtml(item.holder || "")}" /></label>
      <div class="actions">
        <button type="button" class="btn gold" id="save-kit" data-id="${item.id}" data-new="${creating ? "1" : "0"}">Guardar</button>
        ${creating ? "" : '<button type="button" class="btn danger" id="delete-kit" data-id="' + item.id + '">Borrar</button>'}
        <button type="button" class="btn ghost" id="open-publish">Publicar</button>
      </div>
    `);
  }

  function assignNumber(num, name) {
    const key = String(num);
    if (!name.trim()) delete state.data.numbers[key];
    else state.data.numbers[key] = { name: name.trim() };
    persistDraft();
    render();
    toast("Número " + num + (name.trim() ? " ocupado" : " liberado") + ". Publica para que lo vean todos.");
  }

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    render();
  });

  document.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.classList.toggle("active", c === chip));
      render();
    });
  });

  els.adminBtn.addEventListener("click", () => {
    if (state.admin) {
      state.admin = false;
      sessionStorage.removeItem(STORAGE_SESSION);
      render();
      toast("Saliste del modo admin.");
      return;
    }
    loginForm();
  });

  els.addUnnumbered.addEventListener("click", () => unnumberedForm("new"));
  els.publishBtn.addEventListener("click", settingsForm);
  els.kitBtn.addEventListener("click", () => {
    openModal(
      `
      <h2 id="modal-title">Uniforme reversible</h2>
      <img class="kit-full" src="./img/equipacion.jpg" alt="Camiseta blanca, camiseta negra y short Red Knights" />
      <p>Cara blanca de local y cara negra de visita. El short combina con ambos lados. Toca un número abajo para ver si está libre.</p>
    `,
      true
    );
  });
  els.modalClose.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeModal();
  });

  els.grid.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-num]");
    if (btn) numberForm(Number(btn.dataset.num));
  });

  els.unnumbered.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-uid]");
    if (btn) unnumberedForm(btn.dataset.uid);
  });

  els.modal.addEventListener("click", async (event) => {
    const t = event.target;
    if (t.id === "do-login") {
      const password = document.getElementById("password").value;
      if (password === (config.adminPassword || "RedKnights")) {
        state.admin = true;
        sessionStorage.setItem(STORAGE_SESSION, "1");
        closeModal();
        render();
        toast("Modo admin activo. Marca números y publica.");
      } else {
        toast("Contraseña incorrecta.");
      }
    }
    if (t.id === "send-whatsapp") {
      openWhatsAppOrder(t.dataset.num, document.getElementById("reserve-name").value);
    }
    if (t.id === "save-number") {
      const num = Number(document.querySelector("#modal-title").textContent.replace("Dorsal ", ""));
      assignNumber(num, document.getElementById("player-name").value);
      closeModal();
    }
    if (t.id === "free-number") {
      const num = Number(document.querySelector("#modal-title").textContent.replace("Dorsal ", ""));
      assignNumber(num, "");
      closeModal();
    }
    if (t.id === "save-kit") {
      const id = t.dataset.id;
      const isNew = t.dataset.new === "1";
      const label = document.getElementById("kit-label").value.trim();
      const holderName = document.getElementById("kit-holder").value.trim();
      if (!label) return toast("Ponle un nombre a la camiseta.");
      if (isNew) state.data.unnumbered.push({ id, label, holder: holderName });
      else {
        const item = state.data.unnumbered.find((x) => x.id === id);
        if (item) {
          item.label = label;
          item.holder = holderName;
        }
      }
      persistDraft();
      render();
      closeModal();
      toast("Camiseta sin número actualizada.");
    }
    if (t.id === "delete-kit") {
      state.data.unnumbered = state.data.unnumbered.filter((x) => x.id !== t.dataset.id);
      persistDraft();
      render();
      closeModal();
      toast("Camiseta eliminada.");
    }
    if (t.id === "open-publish") settingsForm();
    if (t.id === "only-download") {
      state.data.updatedAt = new Date().toISOString();
      persistDraft();
      downloadData();
      toast("data.json descargado. Reemplázalo en el repo.");
    }
    if (t.id === "save-gh") {
      const next = {
        owner: document.getElementById("gh-owner").value.trim(),
        repo: document.getElementById("gh-repo").value.trim(),
        token: document.getElementById("gh-token").value.trim(),
      };
      localStorage.setItem(STORAGE_GITHUB, JSON.stringify(next));
      closeModal();
      await publish();
    }
  });

  els.modal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "password") {
      document.getElementById("do-login").click();
    }
    if (event.key === "Enter" && event.target.id === "reserve-name") {
      event.preventDefault();
      document.getElementById("send-whatsapp").click();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  loadData();
})();
