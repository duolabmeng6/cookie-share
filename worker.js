addEventListener("fetch", (event) => {
    event.respondWith(
      handleRequest(event.request).catch((error) => {
        const response = new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
        setCorsHeaders(response);
        return response;
      })
    );
  });
  
  // 设置CORS头部
  function setCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Admin-Password"
    );
  }
  
  // 验证管理员密码
  function verifyAdminPassword(request) {
    const adminPassword = request.headers.get("X-Admin-Password");
    if (adminPassword !== ADMIN_PASSWORD) {
      const response = new Response("未授权", { status: 401 });
      setCorsHeaders(response);
      return response;
    }
    return null; // 如果密码正确则继续
  }
  
  // 验证ID有效性
  function isValidId(id) {
    return id !="";
  }
  
  async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
  
    // 处理CORS预检请求
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest();
    }
  
    const authResponse = verifyAdminPassword(request);
    if (authResponse) return authResponse;

    if (request.method === "POST" && path === "/send-cookies") {
      return handleSendCookies(request);
    } else if (request.method === "GET" && path.startsWith("/receive-cookies/")) {
      return handleReceiveCookies(request, path);
    } else if (request.method === "GET" && path === "/admin/list-cookies") {
      return handleListCookies();
    } else if (request.method === "POST" && path === "/admin/create") {
      return createData(request);
    } else if (request.method === "GET" && path === "/admin/read") {
      return readData(request);
    } else if (request.method === "PUT" && path === "/admin/update") {
      return updateData(request);
    } else if (request.method === "POST" && path === "/admin/delete") {
      return deleteData(request);
    } else if (request.method === "POST" && path === "/admin/delete-all") {
      return deleteAllData();
    } else if (request.method === "GET" && path === "/admin/list") {
      return listAllData();
    } else {
      const response = new Response("未找到", { status: 404 });
      setCorsHeaders(response);
      return response;
    }
  }
  
  // 处理CORS预检请求
  function handleCorsPreflightRequest() {
    const response = new Response(null, {
      status: 204,
    });
    setCorsHeaders(response);
    return response;
  }
  
  async function handleSendCookies(request) {
    const { id, url, cookies } = await request.json();
  
    if (!isValidId(id)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的ID。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    // 检查ID是否已存在
    const existing = await COOKIE_STORE.get(id);
    if (existing !== null) {
      // 删除
      await COOKIE_STORE.delete(id);
    }
  
    // 存储新的cookies
    await COOKIE_STORE.put(id, JSON.stringify({ id, url, cookies }));
  
    const response = new Response(
      JSON.stringify({
        success: true,
        message: "Cookies已成功接收和存储",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function handleReceiveCookies(request, path) {
    const id = path.split("/").pop();
  
    if (!isValidId(id)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的ID。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    const storedData = await COOKIE_STORE.get(id);
    if (storedData === null) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "未找到给定ID的cookies: " + id,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    const { cookies } = JSON.parse(storedData);
  
    const response = new Response(
      JSON.stringify({
        success: true,
        id,
        cookies: cookies,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function handleListCookies() {
    const list = await COOKIE_STORE.list();
    const cookies = [];
  
    for (const key of list.keys) {
      const value = await COOKIE_STORE.get(key.name);
      const { id, url } = JSON.parse(value);
      cookies.push({ id, url });
    }
  
    const response = new Response(
      JSON.stringify({
        success: true,
        cookies: cookies,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function createData(request) {
    const { key, value } = await request.json();
  
    if (!isValidId(key)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的key。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    await COOKIE_STORE.put(key, JSON.stringify(value));
    const response = new Response(
      JSON.stringify({ success: true, message: "数据创建成功" }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function readData(request) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
  
    if (!isValidId(key)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的key。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    const value = await COOKIE_STORE.get(key);
    if (value === null) {
      const response = new Response(
        JSON.stringify({ success: false, message: "未找到数据" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
    const response = new Response(
      JSON.stringify({ success: true, data: JSON.parse(value) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function updateData(request) {
    const { key, value } = await request.json();
  
    if (!isValidId(key)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的key。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    const existingValue = await COOKIE_STORE.get(key);
    if (existingValue === null) {
      const response = new Response(
        JSON.stringify({ success: false, message: "未找到数据" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
    await COOKIE_STORE.put(key, JSON.stringify(value));
    const response = new Response(
      JSON.stringify({ success: true, message: "数据更新成功" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function deleteData(request) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
  
    if (!isValidId(key)) {
      const response = new Response(
        JSON.stringify({
          success: false,
          message: "无效的key。仅允许字母和数字。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
      setCorsHeaders(response);
      return response;
    }
  
    await COOKIE_STORE.delete(key);
    const response = new Response(
      JSON.stringify({ success: true, message: "数据删除成功" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function deleteAllData() {
    const keys = await COOKIE_STORE.list();
    await Promise.all(keys.keys.map((key) => COOKIE_STORE.delete(key.name)));
    const response = new Response(
      JSON.stringify({ success: true, message: "所有数据已成功删除" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }
  
  async function listAllData() {
    const list = await COOKIE_STORE.list();
    const data = [];
  
    for (const key of list.keys) {
      const value = await COOKIE_STORE.get(key.name);
      data.push({ key: key.name, value: JSON.parse(value) });
    }
  
    const response = new Response(
      JSON.stringify({
        success: true,
        data: data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
    setCorsHeaders(response);
    return response;
  }