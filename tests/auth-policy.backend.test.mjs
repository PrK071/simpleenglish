import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Firebase impõe no backend a política mínima de 12 caracteres", async function () {
  const configSource = await readFile("public/js/firebase-config.js", "utf8");
  const apiKey = configSource.match(/apiKey:\s*"([^"]+)"/)?.[1];
  assert.ok(apiKey, "API key pública não encontrada na configuração web");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v2/passwordPolicy?key=${encodeURIComponent(apiKey)}`,
    { headers: { Referer: "https://simpleenglishonline.web.app/" } }
  );
  assert.equal(response.status, 200);

  const policy = await response.json();
  const minimum = policy.customStrengthOptions?.minPasswordLength;
  assert.equal(policy.enforcementState, "ENFORCE");
  assert.equal(minimum, 12);
  assert.equal("a".repeat(11).length >= minimum, false);
  assert.equal("a".repeat(12).length >= minimum, true);
});
