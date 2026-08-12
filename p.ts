import Bun from "bun";

// webview-demo.ts
const win = new Bun.WebView({
  title: "Hello Bun!",
  width: 800,
  height: 600,
});

// Inject HTML
win.setHTML(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { 
          font-family: system-ui; 
          background: #1a1a1a; 
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        button {
          padding: 12px 24px;
          font-size: 16px;
          background: #00d4aa;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div style="text-align: center">
        <h1>🚀 Digester WebView</h1>
        <button onclick="scanProject()">Scan Project</button>
        <pre id="result"></pre>
      </div>
      
      <script>
        async function scanProject() {
          // Call Bun backend dari JS!
          const result = await Bun.backend.scan();
          document.getElementById('result').textContent = JSON.stringify(result, null, 2);
        }
      </script>
    </body>
  </html>
`);

// Expose Bun functions ke frontend
win.bind("__bun__", {
  scan: async () => {
    // Ini jalan di Bun backend!
    const files = await Bun.Glob("**/*.ts").scan(".").toArray();
    return { files: files.length, ts: new Date().toISOString() };
  },
});
