const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  const url = req.url || "/";

  if (url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const htmlPath = path.join(__dirname, "index.html");
  const cssPath = path.join(__dirname, "styles.css");

  try {
    let html = fs.readFileSync(htmlPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    html = html.replace(
      '<link rel="stylesheet" href="styles.css" />',
      `<style>${css}</style>`
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message }));
  }
};
