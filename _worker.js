addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let actualUrlStr = url.pathname.replace("/proxy/", "");
  actualUrlStr = decodeURIComponent(actualUrlStr);  // Decode the URI component
  // 新增：检查用户是否直接访问代理地址
  if (url.pathname === '/' || url.pathname === '/proxy/') {
    return createLandingPage();
   }
  // Copy headers from the original request, but remove any CF headers
  let newHeaders = new Headers();
  for (let pair of request.headers.entries()) {
    if (!pair[0].startsWith('cf-')) {
      newHeaders.append(pair[0], pair[1]);
    }
  }

  const modifiedRequest = new Request(actualUrlStr, {
    headers: newHeaders,
    method: request.method,
    body: request.body,
    redirect: 'manual'
  });

  const response = await fetch(modifiedRequest);
  let modifiedResponse;
  let body = response.body;

  // Handle redirects
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = new URL(response.headers.get('location'));
    const modifiedLocation = "/proxy/" + encodeURIComponent(location.toString());
    modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText
    });
    modifiedResponse.headers.set('Location', modifiedLocation);
  } else {
    if (response.headers.get("Content-Type") && response.headers.get("Content-Type").includes("text/html")) {
      const originalText = await response.text();
      const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
      const modifiedText = originalText.replace(regex, `$1${url.protocol}//${url.host}/proxy/${encodeURIComponent(new URL(actualUrlStr).origin + "/")}`);
      body = modifiedText;
    }

    modifiedResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  // Add CORS headers
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');

  return modifiedResponse;
}

// 新增：创建引导页面
function createLandingPage() {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <style>
  body {
    background-color: #fbfbfb;
    font-family: Arial, sans-serif;
  }

  h1 {
    text-align: center;
    color: #444;
  }

  .container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  form {
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    padding: 2rem;
    border-radius: 8px;
  }

  input {
    display: block;
    width: 100%;
    font-size: 18px;
    padding: 15px;
    border: solid 1px #ccc;
    border-radius: 4px;
    margin: 1rem 0;
  }

  button {
    padding: 15px;
    background-color: #0288d1;
    color: white;
    font-size: 18px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
  }

  button:hover {
    background-color: #039BE5;
  }
</style>
    <meta charset="UTF-8">
    <title>代理服务器</title>
  </head>
  <body>
    <h1>输入您想访问的网址</h1>
    <form id="proxy-form">
      <input type="text" id="url" name="url" placeholder="https://example.com" required />
      <button type="submit">访问</button>
    </form>
    <script>
      const form = document.getElementById('proxy-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const input = document.getElementById('url');
        const actualUrl = input.value;
        const proxyUrl = '/proxy/' + actualUrl;
        location.href = proxyUrl;
      });
    </script>
  </body>
  </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
