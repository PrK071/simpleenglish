// ============================================================
//  Simple English — Configuração do Firebase
// ============================================================
//  Projeto: simpleenglish-fabf9 (plano Spark, região southamerica-east1)
//
//  Estes valores são IDENTIFICADORES PÚBLICOS, não segredos: todo app
//  web Firebase os entrega ao navegador. Quem abrir o DevTools vê os
//  mesmos dados em qualquer site que use Firebase. A proteção real vem de:
//    1. regras do Firestore (firestore.rules)
//    2. domínios autorizados no Firebase Authentication
//    3. restrição da API key por referrer HTTP no Google Cloud
//    4. App Check em modo enforce
//
//  NUNCA coloque segredo de verdade aqui nem em nenhum arquivo servido ao
//  navegador (chave de API paga, credencial de service account, senha SMTP).
//  Segredo real vive só em backend/Cloud Functions.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwXVoZKkZlRN2DmpPclxdX3a4lUbUfonc",
  authDomain: "simpleenglish-fabf9.firebaseapp.com",
  projectId: "simpleenglish-fabf9",
  storageBucket: "simpleenglish-fabf9.firebasestorage.app",
  messagingSenderId: "35725399587",
  appId: "1:35725399587:web:9431c2af7f4d2c48334396",
  measurementId: "G-PX8ZD3JJTP"
};

// Chave de site do reCAPTCHA Enterprise (pública; a validação é no Google).
// Domínios autorizados: console.cloud.google.com > Segurança > reCAPTCHA >
// chave "simple-english-site" > Lista de domínios.
const RECAPTCHA_SITE_KEY = "6LeU3IktAAAAAEfQAsUa46ft6jiYeVfZynkyraim";

// Nomes das coleções usadas no Firestore.
export const COLECAO_ALUNOS = "alunos";
export const COLECAO_AVALIACOES = "avaliacoes";
export const COLECAO_MATRICULAS = "matriculas";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let appCheck = null;
try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
} catch (erro) {
  // App Check ausente não deve derrubar o site; o Firestore segue protegido
  // pelas regras. Ligue o enforcement no console só após autorizar o domínio.
  console.warn("[Simple English] App Check nao inicializou:", erro);
}

// A inicialização é síncrona. As duas exportações abaixo existem para manter
// compatibilidade com o código que aguardava carregamento assíncrono.
export const firebaseReady = true;
export const firebaseReadyPromise = Promise.resolve();

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
