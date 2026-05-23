const STORAGE_KEY = "comfyui-web-lite";
const SERVER_STORAGE_KEY = "comfyui-web-lite-server";
const DEFAULT_SERVER = "127.0.0.1:8188";
const GENERATE_TIMEOUT_MS = 5 * 60 * 1000;

let jsonData = null;
let objectInfo = null;
let clientId = null;

function getServerAddress() {
  const stored = localStorage.getItem(SERVER_STORAGE_KEY);
  return (stored || DEFAULT_SERVER).trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function setServerAddress(address) {
  const normalized = address.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  localStorage.setItem(SERVER_STORAGE_KEY, normalized);
  return normalized;
}

function getHttpBase() {
  return `http://${getServerAddress()}`;
}

function getWsBase() {
  return `ws://${getServerAddress()}`;
}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

function showToast(message, type = "error") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm z-50 max-w-md ${
    type === "error" ? "bg-red-600 text-white" : type === "success" ? "bg-green-600 text-white" : "bg-gray-800 text-white"
  }`;
  toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add("hidden"), 5000);
}

function isInputHidden(groupData, inputKey) {
  const hidden = groupData._meta?.hide_inputs;
  return Array.isArray(hidden) && hidden.includes(inputKey);
}

async function fetchObjectInfo() {
  try {
    const response = await fetch(`${getHttpBase()}/object_info`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    objectInfo = await response.json();
    return objectInfo;
  } catch (error) {
    console.warn("无法获取 object_info，模型下拉将不可用:", error);
    objectInfo = null;
    showToast("无法连接 ComfyUI，请确认地址与 --enable-cors-header", "error");
    return null;
  }
}

function getComboOptions(classType, inputName) {
  if (!objectInfo || !objectInfo[classType]) return null;
  const nodeInfo = objectInfo[classType];
  const spec =
    nodeInfo.input?.required?.[inputName] ?? nodeInfo.input?.optional?.[inputName];
  if (!spec || !Array.isArray(spec)) return null;
  const options = spec[0];
  if (Array.isArray(options) && options.length > 0 && typeof options[0] === "string") {
    return options;
  }
  return null;
}

function createFormGroup(groupId, groupData) {
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "p-3";

  let hasInputs = false;

  for (const [key, value] of Object.entries(groupData.inputs)) {
    if (Array.isArray(value)) continue;
    if (isInputHidden(groupData, key)) continue;

    const label = document.createElement("label");
    label.className = "block mb-1 text-sm text-gray-700";
    label.textContent = key;

    const inputField = createInputField(groupId, key, value, groupData.class_type);
    contentWrapper.appendChild(label);
    contentWrapper.appendChild(inputField);
    hasInputs = true;
  }

  if (!hasInputs) return null;

  const group = document.createElement("div");
  group.className = "mb-4 border rounded-lg overflow-hidden";

  const groupHeader = document.createElement("div");
  groupHeader.className = "bg-gray-100 p-2 cursor-pointer flex items-center";

  const toggleIcon = document.createElement("span");
  toggleIcon.className = "mr-2 transition-transform duration-300";
  toggleIcon.textContent = "▼";

  const groupTitle = document.createElement("h3");
  groupTitle.className = "text-sm font-semibold flex-grow";
  groupTitle.textContent = groupData._meta?.title || groupData.class_type;

  groupHeader.appendChild(toggleIcon);
  groupHeader.appendChild(groupTitle);
  group.appendChild(groupHeader);
  group.appendChild(contentWrapper);

  let isExpanded = true;
  groupHeader.addEventListener("click", () => {
    isExpanded = !isExpanded;
    contentWrapper.style.display = isExpanded ? "block" : "none";
    toggleIcon.style.transform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
  });

  return group;
}

function bindInputUpdate(element, groupId, name, inputType) {
  const handler = () => {
    let newValue = element.value;
    if (inputType === "number") {
      newValue = element.value === "" ? 0 : Number(newValue);
    }
    updateJsonValue(groupId, name, newValue);
  };
  element.addEventListener("input", handler);
  element.addEventListener("change", handler);
}

function createInputField(groupId, name, value, classType) {
  const comboOptions = getComboOptions(classType, name);
  const inputClass = "w-full p-2 mb-2 border rounded text-sm";

  if (comboOptions) {
    const select = document.createElement("select");
    select.name = name;
    select.className = inputClass;
    const current = String(value);
    let hasCurrent = false;
    for (const option of comboOptions) {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      if (option === current) {
        opt.selected = true;
        hasCurrent = true;
      }
      select.appendChild(opt);
    }
    if (!hasCurrent && current) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = `${current} (workflow)`;
      opt.selected = true;
      select.insertBefore(opt, select.firstChild);
    }
    bindInputUpdate(select, groupId, name, "text");
    return select;
  }

  if (typeof value === "boolean") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = name;
    checkbox.checked = value;
    checkbox.className = "mb-2";
    checkbox.addEventListener("change", () => {
      updateJsonValue(groupId, name, checkbox.checked);
    });
    return checkbox;
  }

  if (typeof value === "string" && (name === "text" || value.length > 60)) {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.value = value;
    textarea.rows = 3;
    textarea.className = inputClass;
    bindInputUpdate(textarea, groupId, name, "text");
    return textarea;
  }

  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  input.className = inputClass;

  if (typeof value === "number") {
    input.type = "number";
    input.step = Number.isInteger(value) ? "1" : "any";
  } else {
    input.type = "text";
  }

  bindInputUpdate(input, groupId, name, input.type);
  return input;
}

function updateJsonValue(groupId, key, newValue) {
  if (!jsonData?.[groupId]) return;
  jsonData[groupId].inputs[key] = newValue;
}

function updateSubmitButtonState() {
  const submitButton = document.getElementById("submit-button");
  const formContainer = document.getElementById("form-container");
  if (!submitButton || !formContainer) return;

  const hasForm = formContainer.children.length > 0;
  submitButton.disabled = !hasForm;
  submitButton.classList.toggle("opacity-50", !hasForm);
  submitButton.classList.toggle("cursor-not-allowed", !hasForm);
}

function generateForm(data) {
  const formContainer = document.getElementById("form-container");
  formContainer.innerHTML = "";

  for (const [groupId, groupData] of Object.entries(data)) {
    if (groupId.startsWith("_")) continue;
    if (!groupData?.inputs) continue;
    const formGroup = createFormGroup(groupId, groupData);
    if (formGroup) formContainer.appendChild(formGroup);
  }

  updateSubmitButtonState();
}

function getStoredImages() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"images":[]}');
    return Array.isArray(stored.images) ? stored.images : [];
  } catch {
    return [];
  }
}

function saveStoredImages(images) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ images }));
}

function loadImagesFromLocalStorage() {
  const imageContainer = document.getElementById("image-container");
  if (!imageContainer) return;
  imageContainer.innerHTML = "";
  getStoredImages().forEach((imageUrl) => addImageCard(imageUrl, false));
}

function buildImageViewUrl(filename, subfolder, type = "output") {
  const params = new URLSearchParams({
    filename,
    type,
    subfolder: subfolder || "",
  });
  return `${getHttpBase()}/view?${params.toString()}`;
}

function addImageCard(imageUrl, prepend = true) {
  const imageContainer = document.getElementById("image-container");
  if (!imageContainer) return;

  const card = document.createElement("div");
  card.className =
    "bg-white rounded-lg shadow-md overflow-hidden mb-4 relative shrink-0 w-[200px] h-[200px]";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "Generated Image";
  img.className = "w-full h-full object-cover cursor-pointer";
  img.addEventListener("click", () => showFullscreenImage(imageUrl));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className =
    "delete-image absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition duration-300 text-xs";
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteImage(imageUrl);
    card.remove();
  });

  card.appendChild(img);
  card.appendChild(deleteBtn);

  if (prepend) {
    imageContainer.insertBefore(card, imageContainer.firstChild);
  } else {
    imageContainer.appendChild(card);
  }
}

function showFullscreenImage(imageUrl) {
  const fullscreenImage = document.getElementById("fullscreen-image");
  fullscreenImage.src = imageUrl;
  document.getElementById("fullscreen-container").classList.remove("hidden");
}

function deleteImage(imageUrl) {
  saveStoredImages(getStoredImages().filter((url) => url !== imageUrl));
}

function addImageToLocalStorage(imageUrl) {
  const images = getStoredImages();
  if (!images.includes(imageUrl)) {
    images.unshift(imageUrl);
    saveStoredImages(images);
  }
}

function setProgressText(text) {
  const el = document.getElementById("progress-text");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function buildPrompt(data) {
  const prompt = {};
  for (const [groupId, groupData] of Object.entries(data)) {
    if (groupId.startsWith("_")) continue;
    if (!groupData?.class_type || !groupData?.inputs) continue;
    prompt[groupId] = {
      class_type: groupData.class_type,
      inputs: { ...groupData.inputs },
    };
  }
  return prompt;
}

function formatPromptErrors(nodeErrors) {
  const parts = [];
  for (const [nodeId, err] of Object.entries(nodeErrors)) {
    const msg = err?.errors?.[0]?.message || err?.class_type || "节点错误";
    parts.push(`节点 ${nodeId}: ${msg}`);
  }
  return parts.join("; ") || "Workflow 校验失败";
}

function generate(prompt, onProgress) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${getWsBase()}/ws?clientId=${clientId}`);
    const imageUrls = [];
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      fn(arg);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error("生成超时，请检查 ComfyUI 是否仍在运行"));
    }, GENERATE_TIMEOUT_MS);

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "progress" && data.data) {
        const { value, max } = data.data;
        if (typeof value === "number" && typeof max === "number" && max > 0) {
          const pct = Math.round((value / max) * 100);
          onProgress?.(`生成中 ${pct}%`);
        }
        return;
      }

      if (data.type === "execution_error") {
        const msg =
          data.data?.exception_message ||
          data.data?.exception_type ||
          "ComfyUI 执行出错";
        finish(reject, new Error(msg));
        return;
      }

      if (data.type === "executed" && data.data?.output?.images) {
        for (const image of data.data.output.images) {
          const url = buildImageViewUrl(image.filename, image.subfolder, image.type);
          if (!imageUrls.includes(url)) {
            imageUrls.push(url);
            addImageToLocalStorage(url);
            addImageCard(url, true);
          }
        }
      }

      if (data.type === "executing" && data.data?.node === null && imageUrls.length > 0) {
        finish(resolve, imageUrls);
      }
    };

    socket.onerror = () => {
      finish(reject, new Error("WebSocket 连接失败，请确认 ComfyUI 地址与 CORS 设置"));
    };

    socket.onopen = () => {
      fetch(`${getHttpBase()}/prompt`, {
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, client_id: clientId }),
      })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body.error || `HTTP ${response.status}`);
          }
          if (body.error) {
            throw new Error(body.error);
          }
          if (body.node_errors && Object.keys(body.node_errors).length > 0) {
            throw new Error(formatPromptErrors(body.node_errors));
          }
        })
        .catch((error) => {
          finish(reject, error);
        });
    };
  });
}

async function handleWorkflowUpload(file) {
  if (!file) {
    jsonData = null;
    document.getElementById("form-container").innerHTML = "";
    updateSubmitButtonState();
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("workflow 格式无效");
    }
    jsonData = parsed;
  } catch (error) {
    jsonData = null;
    document.getElementById("form-container").innerHTML = "";
    updateSubmitButtonState();
    showToast(`JSON 解析失败: ${error.message}`, "error");
    return;
  }

  await fetchObjectInfo();
  generateForm(jsonData);
  showToast("Workflow 已加载", "success");
}

function initFullscreen() {
  const closeFullscreen = () => {
    document.getElementById("fullscreen-container").classList.add("hidden");
  };

  document.getElementById("close-fullscreen")?.addEventListener("click", closeFullscreen);
  document.getElementById("fullscreen-container")?.addEventListener("click", (e) => {
    if (e.target.id === "fullscreen-container") closeFullscreen();
  });
  document.getElementById("fullscreen-image")?.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

function initServerSettings() {
  const input = document.getElementById("server-address");
  const saveBtn = document.getElementById("save-server");
  if (!input) return;

  input.value = getServerAddress();

  const applyServer = async () => {
    const address = setServerAddress(input.value);
    input.value = address;
    if (jsonData) {
      await fetchObjectInfo();
      generateForm(jsonData);
    }
    showToast("服务器地址已保存", "success");
  };

  saveBtn?.addEventListener("click", applyServer);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyServer();
  });
}

function initUpload() {
  document.getElementById("upload-flow-json")?.addEventListener("change", (event) => {
    handleWorkflowUpload(event.target.files[0] || null);
  });
}

function initSubmit() {
  const submitButton = document.getElementById("submit-button");
  if (!submitButton) return;

  submitButton.addEventListener("click", async () => {
    if (submitButton.disabled || !jsonData) return;

    submitButton.disabled = true;
    submitButton.textContent = "生成中…";
    setProgressText("连接 ComfyUI…");

    const prompt = buildPrompt(jsonData);

    try {
      const urls = await generate(prompt, setProgressText);
      showToast(`已生成 ${urls.length} 张图片`, "success");
    } catch (error) {
      console.error("Error generating image:", error);
      showToast(error.message || "生成失败", "error");
    } finally {
      submitButton.textContent = "Queue";
      setProgressText("");
      updateSubmitButtonState();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  clientId = uuidv4();
  initServerSettings();
  initUpload();
  initSubmit();
  initFullscreen();
  loadImagesFromLocalStorage();
  updateSubmitButtonState();
});
