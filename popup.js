document.addEventListener("DOMContentLoaded", function () {
  const sendButton = document.getElementById("sendButton");
  const receiveButton = document.getElementById("receiveButton");
  const generateIdButton = document.getElementById("generateIdButton");
  const saveUrlButton = document.getElementById("saveUrlButton");
  const messageDiv = document.getElementById("message");
  const errorMessageDiv = document.getElementById("errorMessage");
  const cookieIdInput = document.getElementById("cookieId");
  const customUrlInput = document.getElementById("customUrl");
  const passwordInput = document.getElementById("password");

  sendButton.addEventListener("click", handleSendCookies);
  receiveButton.addEventListener("click", handleReceiveCookies);
  saveUrlButton.addEventListener("click", handleSaveUrl);

  // Load the saved URL from storage
  chrome.storage.sync.get(["customUrl", "password"], (result) => {
    if (result.customUrl) {
      customUrlInput.value = result.customUrl;
    }
    if (result.password) {
      passwordInput.value = result.password;
    }
  });
  handleGenerateId();

  const deleteAllButton = document.getElementById('deleteAllButton');
  deleteAllButton.addEventListener('click', deleteAllData);

  function isValidId(id) {
    return id != ""
  }

  function showMessage(message) {
    messageDiv.textContent = message;
    errorMessageDiv.textContent = ""; // 清除任何错误消息
    messageDiv.style.display = "block";
  }

  function showError(message) {
    errorMessageDiv.textContent = message;
    messageDiv.textContent = ""; // 清除任何成功消息
    errorMessageDiv.style.display = "block";
  }

  function handleSendCookies() {
    const cookieId = cookieIdInput.value.trim();
    const customUrl = customUrlInput.value.trim();
    if (!cookieId) {
      showError("请输入一个 cookie ID");
      return;
    }
    if (!isValidId(cookieId)) {
      showError("无效的 ID。只允许字母和数字。");
      return;
    }
    if (!customUrl) {
      showError("请输入一个自定义 URL");
      return;
    }
    sendCookies(cookieId, customUrl);
  }

  function handleReceiveCookies() {
    const cookieId = cookieIdInput.value.trim();
    const customUrl = customUrlInput.value.trim();
    if (!cookieId) {
      showError("请输入一个 cookie ID");
      return;
    }
    if (!isValidId(cookieId)) {
      showError("无效的 ID。只允许字母和数字。");
      return;
    }
    if (!customUrl) {
      showError("请输入一个自定义 URL");
      return;
    }
    receiveCookies(cookieId, customUrl);
  }

  function handleGenerateId() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const currentDomain = new URL(currentTab.url).hostname; // 获取域名
      showMessage("当前域名: " + currentDomain);
      cookieIdInput.value = currentDomain;
    });

  }

  function handleSaveUrl() {
    const customUrl = customUrlInput.value.trim();
    const password = passwordInput.value.trim();
    console.log(customUrl);
    if (!customUrl) {
      showError("请输入一个 URL");
      return;
    }
    if (!password) {
      showError("请输入一个密码");
      return;
    }
    chrome.storage.sync.set({ customUrl: customUrl, password: password }, () => {
      showMessage("自定义 URL 已保存！");
    });

  }

  function sendCookies(cookieId, customUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      const password = passwordInput.value.trim();
      if (!password) {
        showError("请输入一个密码");
        return;
      }
      const hashedPassword = password;

      chrome.cookies.getAll({ url: url.origin }, function (cookies) {
        const cookieData = cookies.map(function (cookie) {
          return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          };
        });

        fetch(`${customUrl}/send-cookies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Password": `${hashedPassword}`,
          },
          body: JSON.stringify({
            id: cookieId,
            url: currentTab.url,
            cookies: cookieData,
          }),
        })
          .then((response) => {
            if (response.status !== 200) {
              console.log(response);
              return response.text().then((body) => { // 获取返回的文本
                throw new Error(body);
              });
            }
            return response.json();
          })
          .then((data) => {
            if (data.success) {
              showMessage("Cookies 发送成功！"); // 修改为中文提示
            } else {
              showError(data.message || "发送 cookies 时出错");
            }
          })
          .catch((error) => {
            showError("发送 cookies 时出错: " + error.message);
          });
      });
    });
  }

  function receiveCookies(cookieId, customUrl) {
    const password = passwordInput.value.trim();
    if (!password) {
      showError("请输入一个密码");
      return;
    }
    const hashedPassword = password;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);

      fetch(`${customUrl}/receive-cookies/${cookieId}`, {
        headers: {
          "X-Admin-Password": `${hashedPassword}`,
        },
      })
        .then((response) => {
          if (response.status !== 200) {
            console.log(response);
            return response.text().then((body) => { // 获取返回的文本
              throw new Error(body);
            });
          }
          return response.json();
        })
        .then((data) => {
          if (data.success && data.cookies) {
            const promises = data.cookies.map((cookie) => {
              return new Promise((resolve) => {
                chrome.cookies.set(
                  {
                    url: url.origin,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || url.hostname,
                    path: cookie.path || "/",
                    secure: cookie.secure || false,
                    httpOnly: cookie.httpOnly || false,
                    sameSite: cookie.sameSite || "lax",
                    expirationDate:
                      cookie.expirationDate ||
                      Math.floor(Date.now() / 1000) + 3600,
                  },
                  (result) => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error setting cookie:",
                        chrome.runtime.lastError
                      );
                    }
                    resolve();
                  }
                );
              });
            });

            Promise.all(promises).then(() => {
              showMessage("Cookies 接收并成功设置！"); // 修改为中文提示
              chrome.tabs.reload(currentTab.id);
            });
          } else {
            showError(data.message || "接收 cookies 时出错");
          }
        })
        .catch((error) => {
          showError("接收 cookies 时出错: " + error.message);
        });
    });
  }

  function deleteAllData() {
    const customUrl = document.getElementById('customUrl').value;
    const password = document.getElementById('password').value;

    if (!customUrl || !password) {
      showError('请输入API端点和密码');
      return;
    }
    const hashedPassword = password;

    // 显示确认对话框
    if (confirm('您确定要删除所有数据吗？此操作不可撤销。')) {
      fetch(`${customUrl}/admin/delete-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': `${hashedPassword}`,
        },
      })
      .then(response => {
        if (response.status !== 200) {
          return response.text().then(body => {
            throw new Error(body);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          showMessage('所有数据已成功删除');
        } else {
          showError('删除数据失败：' + data.message);
        }
      })
      .catch(error => {
          showError('删除数据时发生错误：' + error.message);
        });
    } else {
      showMessage('删除操作已取消');
    }
  }
});
