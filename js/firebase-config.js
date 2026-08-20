// ============================================================
//  Simple English — Configuração do Firebase
// ============================================================
//  As credenciais ficam no arquivo ".env" na raiz do projeto,
//  fora do Git (ver .gitignore). Copie ".env.example" para
//  ".env" e preencha com os dados do seu projeto.
//
//  O carregamento é assíncrono: espere "firebaseReadyPromise"
//  antes de usar auth/db, ou verifique "firebaseReady".
//
//  Obs.: a apiKey do Firebase é pública por design — o Firebase
//  identifica o projeto por ela. A proteção real dos dados vem
//  das regras do Firestore (firestore.rules), não do sigilo.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";

// Nomes das coleções usadas no Firestore.
export const COLECAO_ALUNOS = "alunos";
export const COLECAO_AVALIACOES = "avaliacoes";
export const COLECAO_MATRICULAS = "matriculas";

export let app = null;
export let auth = null;
export let db = null;
export let appCheck = null;
export let firebaseReady = false;

function parseEnv(texto) {
  const env = {};
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const eq = limpa.indexOf("=");
    if (eq === -1) continue;
    env[limpa.slice(0, eq).trim()] = limpa.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

export const firebaseReadyPromise = (async function () {
  try {
    const resposta = await fetch(".env", { cache: "no-store" });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const env = parseEnv(await resposta.text());

    const config = {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
      appId: env.FIREBASE_APP_ID,
      measurementId: env.FIREBASE_MEASUREMENT_ID
    };

    const incompleto = Object.values(config).some(function (value) {
      return typeof value !== "string" || value === "" || value.indexOf("COLE_AQUI") === 0;
    });
    if (incompleto) throw new Error("variaveis ausentes no .env");

    app = initializeApp(config);

    // App Check (reCAPTCHA Enterprise): a chave de site é pública;
    // a validação acontece no lado do Google.
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(env.RECAPTCHA_SITE_KEY || ""),
        isTokenAutoRefreshEnabled: true
      });
    } catch (erro) {
      console.warn("[Simple English] App Check nao inicializou:", erro);
    }

    auth = getAuth(app);
    db = getFirestore(app);
    firebaseReady = true;
  } catch (erro) {
    console.warn(
      "[Simple English] Firebase não configurado. Copie .env.example para .env " +
        "e preencha os dados do seu projeto:",
      erro
    );
  }
})();

// Traduz os códigos de erro do Firebase Auth para mensagens em português.
export function mensagemErroAuth(error) {
  const codigo = (error && error.code) || "";
  const mapa = {
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Faça login.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/missing-password": "Informe sua senha.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
    "auth/user-disabled": "Esta conta foi desativada. Fale com a secretaria.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente de novo.",
    "auth/operation-not-allowed": "Login por e-mail/senha não está ativado no Firebase.",
    "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase Authentication."
  };
  return mapa[codigo] || "Não foi possível concluir. Tente novamente em instantes.";
}
