let jsonData; // 定义 jsonData 变量

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

  let uploadJson;
  // 处理文件上传并读取 JSON 文件的内容
  $("#upload-flow-json").on("change", function (event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async function (event) {
      jsonData = JSON.parse(event.target.result); // 初始化 jsonData
      uploadJson = event.target.result;
      console.log("upload json:", uploadJson);
      try {
        // 根据 JSON 结构生成表单
        generateForm(jsonData);
      } catch (error) {
        console.error("Error loading form:", error);
      }
    };

    reader.onerror = function (error) {
      console.error("Error reading JSON file:", error);
    };

    if (file) {
      reader.readAsText(file);
    }
  });

  // 根据 JSON 结构生成表单
  function generateForm(jsonData) {
    const formContainer = $("#form-container");
    formContainer.empty(); // 清空之前的表单内容

    for (const [groupId, groupData] of Object.entries(jsonData)) {
      const formGroup = createFormGroup(groupId, groupData);
      formContainer.append(formGroup);
    }
  }

  function createFormGroup(groupId, groupData) {
    const group = $('<div class="form-group"></div>');
    const groupTitle = $("<h3></h3>").text(groupData.class_type);
    group.append(groupTitle);

    for (const [key, value] of Object.entries(groupData.inputs)) {
      if (!Array.isArray(value)) {
        const label = $("<label></label>").text(key);
        const inputField = createInputField(groupId, key, value);
        group.append(label);
        group.append(inputField);
        group.append("<br>");
      }
    }

    return group;
  }

  // 创建表单项
  function createInputField(groupId, name, value) {
    const input = $("<input>").attr("name", name).val(value);

    if (typeof value === "string") {
      input.attr("type", "text");
    } else if (typeof value === "number") {
      input.attr("type", "number");
    }

    input.on("input", function (event) {
      let newValue = event.target.value;
      if (input.attr("type") === "number") {
        newValue = Number(newValue);
      }
      updateJsonValue(groupId, name, newValue);
    });

    return input;
  }

  function updateJsonValue(groupId, key, newValue) {
    jsonData[groupId].inputs[key] = newValue;
  }

  // 处理表单提交
  $("#submit-button").on("click", async function () {
    console.log("jsonData:", jsonData);
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
