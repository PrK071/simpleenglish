import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("CSP bloqueia style elements inline e limita a exceção a atributos", async function () {
  const config = JSON.parse(await readFile("firebase.json", "utf8"));
  const csp = config.hosting.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy").value;

  const styleSrc = csp.match(/(?:^|; )style-src ([^;]+)/)?.[1] || "";
  const styleSrcElement = csp.match(/(?:^|; )style-src-elem ([^;]+)/)?.[1] || "";
  const styleSrcAttribute = csp.match(/(?:^|; )style-src-attr ([^;]+)/)?.[1] || "";

  assert.doesNotMatch(styleSrc, /'unsafe-inline'/);
  assert.doesNotMatch(styleSrcElement, /'unsafe-inline'/);
  assert.match(styleSrcAttribute, /^'unsafe-inline'$/);
});

test("código próprio não cria estilos inline", async function () {
  const files = [
    "public/index.html",
    "public/cadastro.html",
    "public/aluno.html",
    "public/privacidade.html",
    "public/js/intro.js",
    "public/js/main.js",
    "public/js/aluno.js",
    "public/js/firebase-config.js"
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\sstyle\s*=/i, file);
    assert.doesNotMatch(source, /\.style\b/, file);
    assert.doesNotMatch(source, /<style\b/i, file);
  }
});
