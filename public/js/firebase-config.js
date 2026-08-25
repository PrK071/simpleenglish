// Identificadores do app web. Públicos por design: o navegador precisa
// deles para falar com o projeto. A proteção real vem de três camadas —
// restrição de referrer na API key, App Check em modo enforce e as regras
// em "firestore.rules". A inicialização é assíncrona (App Check obrigatório):
// espere "firebaseReadyPromise" antes de usar auth/db.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js";

// Nomes das coleções usadas no Firestore.
export const COLECAO_ALUNOS = "alunos";
export const COLECAO_AVALIACOES = "avaliacoes";
export const COLECAO_MATRICULAS = "matriculas";

const firebaseConfig = {
  apiKey: "AIzaSyAwXVoZKkZlRN2DmpPclxdX3a4lUbUfonc",
  authDomain: "simpleenglish-fabf9.firebaseapp.com",
  projectId: "simpleenglish-fabf9",
  storageBucket: "simpleenglish-fabf9.firebasestorage.app",
  messagingSenderId: "35725399587",
  appId: "1:35725399587:web:9431c2af7f4d2c48334396",
  measurementId: "G-PX8ZD3JJTP"
};

// Chave de site do reCAPTCHA Enterprise ("simple-english-site"). Só vale nos
// domínios liberados na chave: localhost, 127.0.0.1, simpleenglish-fabf9.web.app,
// simpleenglish-fabf9.firebaseapp.com e simpleenglishonline.web.app.
const RECAPTCHA_SITE_KEY = "6LeU3IktAAAAAEfQAsUa46ft6jiYeVfZynkyraim";

export let app = null;
export let auth = null;
export let db = null;
export let appCheck = null;
export let firebaseReady = false;

export const firebaseReadyPromise = (async function () {
  try {
    app = initializeApp(firebaseConfig);

    // App Check é obrigatório: sem atestado, nada de auth/db. Se a
    // inicialização falhar, a app fica indisponível em vez de seguir sem
    // proteção (fail-closed). O Firestore e o Authentication estão com
    // enforcement ligado e recusam requisição sem token de App Check.
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });

    auth = getAuth(app);
    // Evita manter a conta conectada indefinidamente em computadores
    // compartilhados: a sessão termina ao fechar a aba/janela do navegador.
    await setPersistence(auth, browserSessionPersistence);
    db = getFirestore(app);
    firebaseReady = true;
  } catch (erro) {
    app = null;
    auth = null;
    db = null;
    appCheck = null;
    firebaseReady = false;
    console.warn(
      "[Simple English] Firebase indisponível: falha ao inicializar o App Check " +
        "ou domínio fora da lista do reCAPTCHA / da API key:",
      erro
    );
  }
})();

// Traduz os códigos de erro do Firebase Auth para mensagens em português.
export function mensagemErroAuth(error) {
  const codigo = (error && error.code) || "";
  const mapa = {
    "auth/email-already-in-use": "Não foi possível criar uma conta com esses dados. Tente entrar ou redefinir sua senha.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/weak-password": "Use uma senha com pelo menos 12 caracteres.",
    "auth/password-does-not-meet-requirements": "Use uma senha com pelo menos 12 caracteres.",
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
