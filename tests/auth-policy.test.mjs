import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PASSWORD_MIN_LENGTH,
  senhaAtendePolitica
} from "../public/js/security-policy.js";

test("política de senha rejeita menos de 12 caracteres", function () {
  assert.equal(PASSWORD_MIN_LENGTH, 12);
  assert.equal(senhaAtendePolitica("a".repeat(11)), false);
});

test("política de senha aceita 12 ou mais caracteres", function () {
  assert.equal(senhaAtendePolitica("a".repeat(12)), true);
  assert.equal(senhaAtendePolitica("a".repeat(64)), true);
});
