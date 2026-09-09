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
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 4200);
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
    if (state.admin) {
      els.publishBtn.textContent = repoInfo().token ? "Conexión" : "Conectar celular";
    }
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
    return { owner: config.githubOwner || "UnicDeveloper", repo: config.githubRepo || "jerseys-dispo" };
  }

  function repoInfo() {
    const saved = githubSettings();
    const guessed = guessRepo();
    return {
      owner: saved.owner || config.githubOwner || guessed.owner || "UnicDeveloper",
      repo: saved.repo || config.githubRepo || guessed.repo || "jerseys-dispo",
      token: saved.token || "",
    };
  }

  function applyData(json) {
    state.data = {
      updatedAt: json.updatedAt || null,
      numbers: json.numbers || {},
      unnumbered: Array.isArray(json.unnumbered) ? json.unnumbered : [],
    };
  }

  async function loadFromApi() {
    const { owner, repo } = repoInfo();
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data.json?t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (!res.ok) throw new Error("api");
    const payload = await res.json();
    if (!payload.content) throw new Error("api");
    const text = decodeURIComponent(escape(atob(String(payload.content).replace(/\n/g, ""))));
    return JSON.parse(text);
  }

  async function loadData() {
    try {
      applyData(await loadFromApi());
    } catch {
      try {
        const res = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo leer data.json");
        applyData(await res.json());
      } catch {
        const draft = localStorage.getItem(STORAGE_DRAFT);
        if (draft) applyData(JSON.parse(draft));
      }
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
    const settings = repoInfo();
    state.data.updatedAt = new Date().toISOString();
    persistDraft();

    if (!settings.token || !settings.owner || !settings.repo) return false;

    const api = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/data.json`;
    const headers = {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    try {
      const current = await fetch(api, { headers });
      const currentJson = await current.json();
      const sha = current.ok ? currentJson.sha : undefined;
      const saved = await fetch(api, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Actualizar números Red Knights",
          content: toBase64(JSON.stringify(state.data, null, 2) + "\n"),
          sha,
        }),
      });
      if (!saved.ok) {
        const err = await saved.json().catch(() => ({}));
        throw new Error(err.message || "GitHub rechazó el guardado");
      }
      return true;
    } catch (error) {
      toast(error.message || "No se pudo guardar en la web.");
      return false;
    }
  }

  async function saveToCloud(okMessage) {
    persistDraft();
    render();
    if (!repoInfo().token) {
      toast(okMessage + " Conecta este celular una vez para que se vea en la web.");
      settingsForm();
      return;
    }
    const ok = await publish();
    if (ok) toast(okMessage + " Ya se ve en la web.");
  }

  function loginForm() {
    openModal(`
      <h2 id="modal-title">Admin</h2>
      <p>Entra con tu contraseña. Desde el celular puedes marcar números y se guardan solos en la web.</p>
      <label class="field">
        <span>Contraseña</span>
        <input id="password" type="password" autocomplete="current-password" />
      </label>
      <button type="button" class="btn gold full" id="do-login">Entrar</button>
    `);
  }

  function settingsForm() {
    const current = repoInfo();
    openModal(`
      <h2 id="modal-title">Conectar este celular</h2>
      <p>Hazlo una sola vez en el teléfono. Después, cada número que marques se actualiza en la página, sin push.</p>
      <ol class="steps">
        <li>Abre <a href="https://github.com/settings/tokens/new?scopes=repo&description=RedKnights" target="_blank" rel="noopener">crear token de GitHub</a></li>
        <li>Deja marcado el permiso <strong>repo</strong> y genera el token</li>
        <li>Cópialo y pégalo acá. Queda guardado solo en este celular.</li>
      </ol>
      <label class="field"><span>Usuario de GitHub</span><input id="gh-owner" value="${escapeHtml(current.owner || "")}" /></label>
      <label class="field"><span>Repositorio</span><input id="gh-repo" value="${escapeHtml(current.repo || "")}" /></label>
      <label class="field"><span>Token</span><input id="gh-token" type="password" value="${escapeHtml(current.token || "")}" placeholder="ghp_…" autocomplete="off" /></label>
      <button type="button" class="btn gold full" id="save-gh">Guardar conexión</button>
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
        <h2 id="modal-title">Número ${num}</h2>
        <p>Escribe quién lo usa. Déjalo vacío y guarda para liberarlo. Se actualiza en la web al toque.</p>
        <label class="field">
          <span>Jugador o staff</span>
          <input id="player-name" value="${escapeHtml(name)}" placeholder="Ej. Juan Pérez" />
        </label>
        <div class="actions">
          <button type="button" class="btn gold" id="save-number" data-num="${num}">Guardar</button>
          <button type="button" class="btn danger" id="free-number" data-num="${num}">Liberar</button>
        </div>
      `);
      return;
    }
    if (taken) {
      openModal(`
        <h2 id="modal-title">Número ${num}</h2>
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
      </div>
    `);
  }

  async function assignNumber(num, name) {
    const key = String(num);
    if (!name.trim()) delete state.data.numbers[key];
    else state.data.numbers[key] = { name: name.trim() };
    await saveToCloud("Número " + num + (name.trim() ? " ocupado." : " liberado."));
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
        if (!repoInfo().token) {
          toast("Conecta este celular una vez para guardar sin push.");
          settingsForm();
        } else {
          toast("Modo admin. Los cambios se guardan solos en la web.");
        }
      } else {
        toast("Contraseña incorrecta.");
      }
    }
    if (t.id === "send-whatsapp") {
      openWhatsAppOrder(t.dataset.num, document.getElementById("reserve-name").value);
    }
    if (t.id === "save-number") {
      await assignNumber(Number(t.dataset.num), document.getElementById("player-name").value);
      closeModal();
    }
    if (t.id === "free-number") {
      await assignNumber(Number(t.dataset.num), "");
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
      await saveToCloud("Camiseta sin número actualizada.");
    }
    if (t.id === "delete-kit") {
      state.data.unnumbered = state.data.unnumbered.filter((x) => x.id !== t.dataset.id);
      persistDraft();
      render();
      closeModal();
      await saveToCloud("Camiseta eliminada.");
    }
    if (t.id === "open-publish") settingsForm();
    if (t.id === "save-gh") {
      const next = {
        owner: document.getElementById("gh-owner").value.trim(),
        repo: document.getElementById("gh-repo").value.trim(),
        token: document.getElementById("gh-token").value.trim(),
      };
      if (!next.token) {
        toast("Pega el token para conectar este celular.");
        return;
      }
      localStorage.setItem(STORAGE_GITHUB, JSON.stringify(next));
      closeModal();
      render();
      const ok = await publish();
      toast(ok ? "Celular conectado. Ya puedes marcar números desde acá." : "Revisa el token y vuelve a intentar.");
    }
  });

  els.modal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "password") {
      document.getElementById("do-login").click();
    }
    if (event.key === "Enter" && event.target.id === "player-name") {
      event.preventDefault();
      document.getElementById("save-number").click();
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
