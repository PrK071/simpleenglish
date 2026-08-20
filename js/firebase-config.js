// ============================================================
//  Simple English — Configuração do Firebase
// ============================================================
//  Projeto: simpleenglish-fabf9 (plano Spark, região southamerica-east1)
//  Já configurado e em funcionamento:
//    - Authentication com provedor E-mail/senha ativo
//    - Cloud Firestore edição Standard, banco (default)
//    - Regras de segurança publicadas (ver firestore.rules na raiz)
//
//  Se um dia mudar de projeto, troque o firebaseConfig abaixo pelos dados
//  em Configurações do projeto > seus apps > app da Web, e republique as
//  regras do arquivo firestore.rules em Firestore > Regras.
//
//  Obs.: estas chaves são públicas por design (o Firebase identifica o
//  projeto por elas). A proteção real dos dados vem das regras do
//  Firestore, não do sigilo da apiKey.
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

// Nomes das coleções usadas no Firestore.
export const COLECAO_ALUNOS = "alunos";
export const COLECAO_AVALIACOES = "avaliacoes";
export const COLECAO_MATRICULAS = "matriculas";

// Detecta se a configuração ainda está com os valores de exemplo,
// para o site avisar em vez de quebrar silenciosamente.
export const firebaseReady = !Object.values(firebaseConfig).some(function (value) {
  return typeof value !== "string" || value.indexOf("COLE_AQUI") === 0 || value === "";
});

// ------------------------------------------------------------
//  App Check (reCAPTCHA Enterprise)
//  Faz o navegador provar que a requisição saiu deste site antes
//  do Firestore respondê-la. A chave abaixo é a "chave de site",
//  pública por natureza; a validação acontece no lado do Google.
//
//  ATENÇÃO AO PUBLICAR: hoje a chave só autoriza o domínio
//  "localhost". Antes de colocar o site no ar, adicione o domínio
//  real em console.cloud.google.com > Segurança > reCAPTCHA >
//  chave "simple-english-site" > editar > Lista de domínios.
//  A imposição (enforcement) está DESLIGADA no console, de propósito:
//  assim, se o token falhar, o site continua funcionando. Ligue em
//  Firebase > App Check > APIs > Cloud Firestore só depois de
//  confirmar que o domínio real está autorizado.
// ------------------------------------------------------------
export const RECAPTCHA_SITE_KEY = "6LeU3IktAAAAAEfQAsUa46ft6jiYeVfZynkyraim";

let app = null;
let auth = null;
let db = null;
let appCheck = null;

if (firebaseReady) {
  app = initializeApp(firebaseConfig);

  // Inicializado antes dos demais serviços, para que as chamadas já
  // saiam com o token de atestado.
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  } catch (erro) {
    console.warn("[Simple English] App Check nao inicializou:", erro);
  }

  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn(
    "[Simple English] Firebase não configurado. Preencha js/firebase-config.js " +
      "com os dados do seu projeto para ativar cadastro, login e avaliações."
  );
}

export { app, auth, db, appCheck };

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
