\
const ENGINE_URL = "./assets/engines/butterscotch/butterscotch.mjs";

const elements = {
  status: document.getElementById("engineStatus"),
  launch: document.getElementById("launchButton"),
  picker: document.getElementById("gamePicker"),
  selected: document.getElementById("selectedGameName"),
  log: document.getElementById("logOutput"),
  clearLog: document.getElementById("clearLogButton"),
  theme: document.getElementById("themeToggle"),
  dropZone: document.getElementById("dropZone"),
  overlay: document.getElementById("canvasOverlay"),
  canvas: document.getElementById("gameCanvas"),
};

const state = {
  engine: null,
  enginePromise: null,
  selectedFile: null,
  theme: localStorage.getItem("ember-theme") || "dark",
};

function setStatus(text, kind = "idle") {
  elements.status.textContent = text;
  elements.status.classList.remove("status-idle", "status-loading", "status-ready", "status-error");
  const className = `status-${kind}`;
  elements.status.classList.add(className);
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[match]);
}

function addLog(message, kind = "info") {
  const line = document.createElement("div");
  line.className = `log-line ${kind}`;
  line.innerHTML = message;
  elements.log.prepend(line);
}

function setOverlayVisible(visible, title, description) {
  elements.overlay.classList.toggle("hidden", !visible);
  if (title) {
    const strong = elements.overlay.querySelector("strong");
    const paragraph = elements.overlay.querySelector("p");
    strong.textContent = title;
    paragraph.textContent = description || "";
  }
}

function updateSelectedFile(file) {
  state.selectedFile = file || null;
  elements.selected.textContent = file ? file.name : "Nenhum selecionado";
  if (file) {
    addLog(`Arquivo selecionado: <strong>${escapeText(file.name)}</strong>`, "good");
    setStatus("Arquivo pronto", "ready");
  } else {
    setStatus("Aguardando jogo", "idle");
  }
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = state.theme;
  localStorage.setItem("ember-theme", state.theme);
  elements.theme.textContent = state.theme === "light" ? "Escuro" : "Claro";
}

async function loadEngine() {
  if (state.enginePromise) {
    return state.enginePromise;
  }

  state.enginePromise = (async () => {
    setStatus("Carregando Butterscotch...", "loading");
    setOverlayVisible(true, "Iniciando runtime", "O canvas ficará ativo assim que o motor terminar de subir.");
    addLog("Importando runtime do Butterscotch Web...", "info");

    const { default: createEngine } = await import(ENGINE_URL);

    const engine = await createEngine({
      canvas: elements.canvas,
      noInitialRun: false,
      locateFile(path, prefix) {
        return new URL(path, prefix).href;
      },
      print(text) {
        if (text !== undefined && text !== null && String(text).trim()) {
          addLog(escapeText(text), "info");
        }
      },
      printErr(text) {
        if (text !== undefined && text !== null && String(text).trim()) {
          addLog(escapeText(text), "error");
        }
      },
      onRuntimeInitialized() {
        setStatus("Motor pronto", "ready");
        setOverlayVisible(false);
        addLog("Runtime inicializado com sucesso.", "good");
      },
      onAbort(reason) {
        setStatus("Falha no runtime", "error");
        setOverlayVisible(true, "Runtime abortado", String(reason || "Erro desconhecido."));
        addLog(`Aborted: ${escapeText(reason || "erro desconhecido")}`, "error");
      },
    });

    state.engine = engine;
    return engine;
  })();

  return state.enginePromise;
}

function acceptDroppedFiles(files) {
  if (!files || !files.length) {
    return;
  }

  const file = files[0];
  updateSelectedFile(file);
  addLog(`Solto em tela: <strong>${escapeText(file.name)}</strong>`, "good");

  if (/\.zip$/i.test(file.name)) {
    addLog("ZIP pronto para integração com o loader.", "info");
  }
}

function wireUi() {
  applyTheme(state.theme);

  elements.launch.addEventListener("click", async () => {
    try {
      await loadEngine();
    } catch (error) {
      console.error(error);
      setStatus("Erro ao abrir", "error");
      setOverlayVisible(true, "Não foi possível iniciar", "Veja os logs para mais detalhes.");
      addLog(`Erro: <strong>${escapeText(error?.message || error)}</strong>`, "error");
    }
  });

  elements.picker.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    updateSelectedFile(file || null);
  });

  elements.clearLog.addEventListener("click", () => {
    elements.log.innerHTML = "";
    addLog("Logs limpos.", "info");
  });

  elements.theme.addEventListener("click", () => {
    applyTheme(state.theme === "light" ? "dark" : "light");
  });

  const prevent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((name) => {
    elements.dropZone.addEventListener(name, prevent);
    document.body.addEventListener(name, prevent);
  });

  ["dragenter", "dragover"].forEach((name) => {
    elements.dropZone.addEventListener(name, () => elements.dropZone.classList.add("dragover"));
  });

  ["dragleave", "drop"].forEach((name) => {
    elements.dropZone.addEventListener(name, () => elements.dropZone.classList.remove("dragover"));
  });

  elements.dropZone.addEventListener("drop", (event) => {
    acceptDroppedFiles(event.dataTransfer?.files);
  });

  setOverlayVisible(true, "Pronto para iniciar", "Arraste um arquivo aqui ou clique em “Iniciar motor”.");
  addLog("Ember carregado. Pronto para iniciar o runtime.", "good");
}

wireUi();
