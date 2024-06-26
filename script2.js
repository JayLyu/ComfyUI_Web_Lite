let jsonData;

// 异步加载 JSON
async function loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

// 创建表单组
function createFormGroup(groupId, groupData) {
  const group = document.createElement("div");
  group.className = "form-group";
  const groupTitle = document.createElement("h3");
  groupTitle.textContent = groupData.class_type;
  group.appendChild(groupTitle);

  for (const [key, value] of Object.entries(groupData.inputs)) {
    const label = document.createElement("label");
    label.textContent = key;
    const inputField = createInputField(groupId, key, value);
    if (inputField) {
      // 检查是否生成了 inputField
      group.appendChild(label);
      group.appendChild(inputField);
      group.appendChild(document.createElement("br"));
    }
  }
  return group;
}

// 创建表单项
function createInputField(groupId, name, value) {
  const input = document.createElement("input");
  input.name = name;

  // 忽略值为数组的项
  if (Array.isArray(value)) {
    return null;
  } else {
    input.value = value;
  }

  if (typeof input.value === "string") {
    input.type = "text";
  } else if (typeof input.value === "number") {
    input.type = "number";
  }

  input.addEventListener("input", (event) => {
    let newValue = event.target.value;
    if (input.type === "number") {
      newValue = Number(newValue);
    }
    updateJsonValue(groupId, name, newValue);
  });

  return input;
}

// 更新表单值
function updateJsonValue(groupId, key, newValue) {
  if (Array.isArray(jsonData[groupId].inputs[key])) {
    jsonData[groupId].inputs[key][0] = newValue;
  } else {
    jsonData[groupId].inputs[key] = newValue;
  }
}

// 根据 JSON 结构生成表单
async function generateForm(url) {
  try {
    jsonData = await loadJSON(url);
    const formContainer = document.getElementById("form-container");
    for (const [groupId, groupData] of Object.entries(jsonData)) {
      const formGroup = createFormGroup(groupId, groupData);
      formContainer.appendChild(formGroup);
    }
  } catch (error) {
    console.error("Error loading JSON:", error);
  }
}

generateForm("Workflow API.json");


$(document).ready(function () {
  const server_address = "127.0.0.1:8188"; // 更新为你的服务器地址和端口

  // 生成唯一的客户端ID
  function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  }
  const client_id = uuidv4();

  // 连接到 WebSocket，发送 prompt，并接收图像地址
  function generate(prompt, client_id) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        "ws://" + server_address + "/ws?clientId=" + client_id
      );

      // 处理接收到的消息
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);

        // 如果图像已生成，使用图像地址解析 Promise
        if (data.type === "executed" && "images" in data.data.output) {
          const image = data.data.output.images[0];
          const filename = image.filename;
          const subfolder = image.subfolder;
          const rand = Math.random();
          const imageAddress =
            "http://" +
            server_address +
            "/view?filename=" +
            filename +
            "&type=output&subfolder=" +
            subfolder +
            "&rand=" +
            rand;
          resolve(imageAddress);
          socket.close();
        }
      };

      // 处理 WebSocket 错误
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
        socket.close();
      };

      // 通过 HTTP POST 发送 prompt 数据到服务器
      fetch("http://" + server_address + "/prompt", {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt, client_id: client_id }),
      }).catch((error) => {
        console.error("Fetch error:", error);
        reject(error);
        socket.close();
      });
    });
  }

  // 处理表单提交
  $("#submit-button").on("click", async function () {
    // console.log("jsonData:", jsonData);
    const promptProcess = JSON.stringify(jsonData);
    const prompt = JSON.parse(promptProcess);
    console.log("prompt:", prompt);

    try {
      const imageAddress = await generate(prompt, client_id);
      console.log("Generated image address:", imageAddress);
      $("#image-container").html(
        `<img src="${imageAddress}" alt="Generated Image">`
      );
    } catch (error) {
      console.error("Error generating image:", error);
    }
  });
});
