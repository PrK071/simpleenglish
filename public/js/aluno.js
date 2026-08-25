
import {
  auth,
  db,
  firebaseReady,
  firebaseReadyPromise,
  mensagemErroAuth,
  COLECAO_ALUNOS,
  COLECAO_AVALIACOES
} from "./firebase-config.js";
import { PASSWORD_MIN_LENGTH, senhaAtendePolitica } from "./security-policy.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  reload,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import * as limite from "./ratelimit.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Chaves do rate limit escalonado (js/ratelimit.js). Login e cadastro
// contam falhas; avaliação e redefinição de senha bloqueiam já no
// primeiro uso, com espera que cresce a cada bloqueio.
const CHAVE_LOGIN = "login";
const CHAVE_CADASTRO = "cadastro";
const CHAVE_RESET = "reset-senha";
const CHAVE_AVALIACAO = "avaliacao";
const CHAVE_INICIO_SESSAO = "se_session_started";
const TEMPO_INATIVIDADE_MS = 30 * 60 * 1000;
const TEMPO_MAXIMO_SESSAO_MS = 8 * 60 * 60 * 1000;

const RATING_LABELS = ["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let currentUser = null;
let currentProfile = null;
let selectedStars = 0;
let cadastrando = false;
let timerInatividade = null;

function el(id) {
  return document.getElementById(id);
}

function initials(nome) {
  const parts = String(nome || "Aluno").trim().split(/\s+/);
  return ((parts[0] || "A").charAt(0) + (parts[1] ? parts[1].charAt(0) : "")).toUpperCase();
}

function firstName(nome) {
  return String(nome || "Aluno").trim().split(/\s+/)[0];
}

function setError(fieldId, message) {
  const target = document.querySelector('[data-error-for="' + fieldId + '"]');
  const input = el(fieldId);
  if (target) target.textContent = message;
  if (input && input.tagName !== "FORM") input.classList.toggle("invalid", Boolean(message));
}

function setBusy(form, busy, labelBusy) {
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.disabled = true;
    btn.textContent = labelBusy || "Aguarde...";
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

// Contagens em andamento, uma por chave, para não empilhar timers.
const contagens = {};

// Mostra a espera no campo de erro indicado e devolve o botão quando libera.
function mostrarBloqueio(chave, campoErro, botao) {
  if (contagens[chave]) contagens[chave]();
  if (botao) botao.disabled = true;
  contagens[chave] = limite.contagem(
    chave,
    function (mensagem) {
      setError(campoErro, mensagem);
    },
    function () {
      if (botao) botao.disabled = false;
      contagens[chave] = null;
    }
  );
}

function formatarData(valor) {
  const data = valor && typeof valor.toDate === "function" ? valor.toDate() : new Date();
  return data.toLocaleDateString("pt-BR");
}


function hideAll() {
  el("authLoading").hidden = true;
  el("loginView").hidden = true;
  el("loginForm").hidden = true;
  el("registerForm").hidden = true;
  el("profileView").hidden = true;
}

function showLoading() {
  hideAll();
  el("authLoading").hidden = false;
}

function showLogin() {
  hideAll();
  el("loginView").hidden = false;
  el("loginForm").hidden = false;
}

function showRegister() {
  hideAll();
  el("loginView").hidden = false;
  el("registerForm").hidden = false;
}

function showProfile(profile, rating) {
  hideAll();
  el("profileView").hidden = false;

  el("profileAvatar").textContent = initials(profile.nome);
  el("profileName").textContent = profile.nome;
  el("profileEmail").textContent = profile.email;

  const cursoEl = el("profileCurso");
  if (profile.curso) {
    cursoEl.textContent = "Curso: " + profile.curso;
    cursoEl.hidden = false;
  } else {
    cursoEl.textContent = "";
    cursoEl.hidden = true;
  }

  el("ratingTitle").textContent = rating ? "Atualizar minha avaliação" : "Avaliar meu curso";
  renderMyRating(rating);
  atualizarVerificacaoEmail();
}

function atualizarVerificacaoEmail() {
  const pendente = Boolean(currentUser && !currentUser.emailVerified);
  el("emailVerificationNotice").hidden = !pendente;
  el("saveRatingBtn").disabled = pendente;
  el("ratingComentario").disabled = pendente;
  starBtns.forEach(function (botao) {
    botao.disabled = pendente;
  });
  if (pendente) {
    setError("ratingStars", "Confirme seu e-mail antes de publicar uma avaliação.");
  } else if (!limite.verificar(CHAVE_AVALIACAO).bloqueado) {
    setError("ratingStars", "");
  }
}

function limparControleSessao() {
  if (timerInatividade) clearTimeout(timerInatividade);
  timerInatividade = null;
  try {
    sessionStorage.removeItem(CHAVE_INICIO_SESSAO);
  } catch (erro) {
    // Sem sessionStorage, a persistência do Firebase continua limitada à aba.
  }
}

function encerrarSessaoExpirada(mensagem) {
  if (!auth || !auth.currentUser) return;
  signOut(auth).finally(function () {
    setError("loginForm", mensagem);
  });
}

function armarControleSessao() {
  if (!currentUser) return;

  let inicio = 0;
  try {
    inicio = Number(sessionStorage.getItem(CHAVE_INICIO_SESSAO)) || 0;
    if (!inicio) {
      inicio = Date.now();
      sessionStorage.setItem(CHAVE_INICIO_SESSAO, String(inicio));
    }
  } catch (erro) {
    inicio = Date.now();
  }

  if (Date.now() - inicio >= TEMPO_MAXIMO_SESSAO_MS) {
    encerrarSessaoExpirada("Sua sessão expirou. Entre novamente para continuar.");
    return;
  }

  if (timerInatividade) clearTimeout(timerInatividade);
  timerInatividade = setTimeout(function () {
    encerrarSessaoExpirada("Sua sessão foi encerrada após 30 minutos de inatividade.");
  }, TEMPO_INATIVIDADE_MS);
}

function renderMyRating(rating) {
  const box = el("myRating");
  if (!rating) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  el("myRatingStars").textContent = "★".repeat(rating.nota) + "☆".repeat(5 - rating.nota);
  el("myRatingText").textContent = rating.comentario || "Avaliação sem comentário.";
  el("myRatingDate").textContent = "Publicada em " + formatarData(rating.criadoEm);
}


async function carregarPerfil(user) {
  let snap = await getDoc(doc(db, COLECAO_ALUNOS, user.uid));

  if (!snap.exists()) {
    await new Promise(function (r) { setTimeout(r, 900); });
    snap = await getDoc(doc(db, COLECAO_ALUNOS, user.uid));
  }
  if (snap.exists()) return snap.data();

  const perfil = {
    nome: user.displayName || firstName(user.email),
    email: user.email,
    curso: "",
    criadoEm: serverTimestamp()
  };
  await setDoc(doc(db, COLECAO_ALUNOS, user.uid), perfil);
  return perfil;
}

async function carregarAvaliacao(user) {
  const snap = await getDoc(doc(db, COLECAO_AVALIACOES, user.uid));
  return snap.exists() ? snap.data() : null;
}


const starBtns = Array.prototype.slice.call(document.querySelectorAll(".star-btn"));

function paintStars(value) {
  starBtns.forEach(function (btn) {
    btn.classList.toggle("active", Number(btn.dataset.value) <= value);
  });
  el("ratingLabel").textContent = value ? RATING_LABELS[value] : "Selecione uma nota";
}

starBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    selectedStars = Number(btn.dataset.value);
    paintStars(selectedStars);
    setError("ratingStars", "");
  });
  btn.addEventListener("mouseenter", function () {
    paintStars(Number(btn.dataset.value));
  });
  btn.addEventListener("mouseleave", function () {
    paintStars(selectedStars);
  });
});


showLoading();

firebaseReadyPromise.then(function () {
  if (!firebaseReady) {
    showLogin();
    setError(
      "loginForm",
      "Cadastro e login indisponíveis neste momento. Recarregue a página; se persistir, o acesso a partir deste endereço não está autorizado."
    );
    el("loginForm").querySelectorAll("input, button").forEach(function (campo) {
      campo.disabled = true;
    });
    el("showRegister").addEventListener("click", function (e) {
      e.preventDefault();
    });
  } else {
    iniciar();
  }
});

function iniciar() {
  showLoading();

  ["pointerdown", "keydown", "touchstart"].forEach(function (evento) {
    document.addEventListener(evento, armarControleSessao, { passive: true });
  });

  el("showRegister").addEventListener("click", function (e) {
    e.preventDefault();
    showRegister();
  });

  el("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    showLogin();
  });

  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      limparControleSessao();
      currentUser = null;
      currentProfile = null;
      selectedStars = 0;
      paintStars(0);
      showLogin();
      return;
    }

    if (cadastrando) return;

    currentUser = user;
    armarControleSessao();
    try {
      const [perfil, avaliacao] = await Promise.all([carregarPerfil(user), carregarAvaliacao(user)]);
      currentProfile = perfil;
      showProfile(perfil, avaliacao);
    } catch (error) {
      console.error("[Simple English] Erro ao carregar perfil:", error);
      showLogin();
      setError("loginForm", "Não foi possível carregar seus dados. Tente novamente.");
    }
  });

  el("resendVerificationBtn").addEventListener("click", async function () {
    if (!currentUser || currentUser.emailVerified) return;
    const botao = el("resendVerificationBtn");
    botao.disabled = true;
    try {
      await sendEmailVerification(currentUser);
      el("verificationStatus").textContent = "E-mail de confirmação reenviado. Verifique também a caixa de spam.";
    } catch (error) {
      console.error("[Simple English] Erro ao reenviar confirmação:", error);
      el("verificationStatus").textContent = mensagemErroAuth(error);
    } finally {
      botao.disabled = false;
    }
  });

  el("checkVerificationBtn").addEventListener("click", async function () {
    if (!currentUser) return;
    const botao = el("checkVerificationBtn");
    botao.disabled = true;
    try {
      await reload(currentUser);
      await currentUser.getIdToken(true);
      if (currentUser.emailVerified) {
        el("verificationStatus").textContent = "E-mail confirmado.";
        atualizarVerificacaoEmail();
      } else {
        el("verificationStatus").textContent = "A confirmação ainda não foi identificada.";
      }
    } catch (error) {
      console.error("[Simple English] Erro ao confirmar estado do e-mail:", error);
      el("verificationStatus").textContent = "Não foi possível verificar agora. Tente novamente.";
    } finally {
      botao.disabled = false;
    }
  });

  el("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.currentTarget;

    const nome = el("regNome").value.trim();
    const email = el("regEmail").value.trim().toLowerCase();
    const senha = el("regSenha").value;
    const senha2 = el("regSenha2").value;
    const curso = el("regCurso").value;

    let valid = true;
    if (!nome) { setError("regNome", "Informe seu nome."); valid = false; } else { setError("regNome", ""); }
    if (!EMAIL_REGEX.test(email)) { setError("regEmail", "Informe um e-mail válido."); valid = false; } else { setError("regEmail", ""); }
    if (!senhaAtendePolitica(senha)) { setError("regSenha", "Use pelo menos " + PASSWORD_MIN_LENGTH + " caracteres."); valid = false; } else { setError("regSenha", ""); }
    if (senha2 !== senha) { setError("regSenha2", "As senhas não conferem."); valid = false; } else { setError("regSenha2", ""); }
    setError("registerForm", "");
    if (!valid) return;

    const bloqueio = limite.verificar(CHAVE_CADASTRO);
    if (bloqueio.bloqueado) {
      mostrarBloqueio(CHAVE_CADASTRO, "registerForm", form.querySelector('button[type="submit"]'));
      return;
    }

    setBusy(form, true, "Criando conta...");
    cadastrando = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });

      const perfil = { nome: nome, email: email, curso: curso };
      await setDoc(doc(db, COLECAO_ALUNOS, cred.user.uid), Object.assign({}, perfil, {
        criadoEm: serverTimestamp()
      }));

      try {
        await sendEmailVerification(cred.user);
      } catch (verificationError) {
        console.error("[Simple English] Não foi possível enviar a confirmação inicial:", verificationError);
      }

      limite.sucesso(CHAVE_CADASTRO);
      currentUser = cred.user;
      currentProfile = perfil;
      form.reset();
      showProfile(perfil, null);
    } catch (error) {
      console.error("[Simple English] Erro no cadastro:", error);
      const estado = limite.falha(CHAVE_CADASTRO, { falhas: 4, janelaMs: 10 * 60 * 1000 });
      if (estado.bloqueado) {
        mostrarBloqueio(CHAVE_CADASTRO, "registerForm", form.querySelector('button[type="submit"]'));
      } else {
        setError("registerForm", mensagemErroAuth(error));
      }
      if (auth.currentUser) {
        try {
          const perfil = await carregarPerfil(auth.currentUser);
          currentUser = auth.currentUser;
          currentProfile = perfil;
          showProfile(perfil, await carregarAvaliacao(auth.currentUser));
        } catch (e2) {
          console.error("[Simple English] Falha ao recuperar perfil:", e2);
        }
      }
    } finally {
      cadastrando = false;
      setBusy(form, false);
    }
  });

  el("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.currentTarget;

    const email = el("loginEmail").value.trim().toLowerCase();
    const senha = el("loginSenha").value;

    let valid = true;
    if (!EMAIL_REGEX.test(email)) { setError("loginEmail", "Informe um e-mail válido."); valid = false; } else { setError("loginEmail", ""); }
    if (!senha) { setError("loginSenha", "Informe sua senha."); valid = false; } else { setError("loginSenha", ""); }
    setError("loginForm", "");
    if (!valid) return;

    const bloqueio = limite.verificar(CHAVE_LOGIN);
    if (bloqueio.bloqueado) {
      mostrarBloqueio(CHAVE_LOGIN, "loginForm", form.querySelector('button[type="submit"]'));
      return;
    }

    setBusy(form, true, "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      limite.sucesso(CHAVE_LOGIN);
      form.reset();
    } catch (error) {
      console.error("[Simple English] Erro no login:", error);
      const estado = limite.falha(CHAVE_LOGIN, { falhas: 5, janelaMs: 10 * 60 * 1000 });
      if (estado.bloqueado) {
        mostrarBloqueio(CHAVE_LOGIN, "loginForm", form.querySelector('button[type="submit"]'));
      } else {
        setError(
          "loginForm",
          mensagemErroAuth(error) +
            (estado.restam <= 2 ? " Restam " + estado.restam + " tentativas antes do bloqueio temporário." : "")
        );
      }
    } finally {
      setBusy(form, false);
    }
  });

  el("forgotPassword").addEventListener("click", async function (e) {
    e.preventDefault();
    const email = el("loginEmail").value.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      setError("loginEmail", "Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    setError("loginEmail", "");

    const bloqueio = limite.verificar(CHAVE_RESET);
    if (bloqueio.bloqueado) {
      mostrarBloqueio(CHAVE_RESET, "loginForm", null);
      return;
    }

    const mensagemGenerica = "Se existir uma conta para esse e-mail, enviaremos um link de redefinição.";
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("[Simple English] Erro ao redefinir senha:", error);
      if (error && (error.code === "auth/network-request-failed" || error.code === "auth/too-many-requests")) {
        setError("loginForm", mensagemErroAuth(error));
        return;
      }
    }
    // A resposta é igual para e-mails existentes e inexistentes, evitando
    // enumeração de contas pela recuperação de senha.
    limite.bloquear(CHAVE_RESET);
    setError("loginForm", mensagemGenerica);
  });

  el("saveRatingBtn").addEventListener("click", async function () {
    if (!currentUser || !currentProfile) return;
    if (!currentUser.emailVerified) {
      setError("ratingStars", "Confirme seu e-mail antes de publicar uma avaliação.");
      return;
    }
    if (selectedStars === 0) {
      setError("ratingStars", "Selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    setError("ratingStars", "");

    const btn = el("saveRatingBtn");

    const bloqueio = limite.verificar(CHAVE_AVALIACAO);
    if (bloqueio.bloqueado) {
      mostrarBloqueio(CHAVE_AVALIACAO, "ratingStars", btn);
      return;
    }

    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Publicando...";

    const avaliacao = {
      uid: currentUser.uid,
      nome: firstName(currentProfile.nome),
      curso: currentProfile.curso || "",
      nota: selectedStars,
      comentario: el("ratingComentario").value.trim()
    };

    try {
      await gravarAvaliacao(currentUser.uid, avaliacao);
      // A espera para a próxima edição cresce a cada publicação; as regras
      // do Firestore aplicam a mesma escada no servidor.
      limite.bloquear(CHAVE_AVALIACAO);
      renderMyRating(Object.assign({}, avaliacao, { criadoEm: new Date() }));
      el("ratingTitle").textContent = "Atualizar minha avaliação";
      el("ratingComentario").value = "";
      selectedStars = 0;
      paintStars(0);
      btn.textContent = label;
      mostrarBloqueio(CHAVE_AVALIACAO, "ratingStars", btn);
      return;
    } catch (error) {
      console.error("[Simple English] Erro ao salvar avaliação:", error);
      if (error && error.code === "permission-denied") {
        // Servidor recusou: edição antes da espera obrigatória.
        limite.bloquear(CHAVE_AVALIACAO);
        btn.textContent = label;
        mostrarBloqueio(CHAVE_AVALIACAO, "ratingStars", btn);
        return;
      }
      setError("ratingStars", "Não foi possível publicar sua avaliação. Tente novamente.");
    } finally {
      if (!limite.verificar(CHAVE_AVALIACAO).bloqueado) {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  });

  el("logoutBtn").addEventListener("click", async function () {
    try {
      limparControleSessao();
      await signOut(auth);
    } catch (error) {
      console.error("[Simple English] Erro ao sair:", error);
    }
  });
}

// Tenta atualizar a avaliação existente; se ainda não houver, cria.
// "edicoes" é incrementado no servidor e conferido pelas regras, que
// exigem espera crescente entre edições.
async function gravarAvaliacao(uid, avaliacao) {
  const referencia = doc(db, COLECAO_AVALIACOES, uid);
  try {
    await updateDoc(
      referencia,
      Object.assign({}, avaliacao, {
        atualizadoEm: serverTimestamp(),
        edicoes: increment(1)
      })
    );
  } catch (error) {
    if (error && error.code === "not-found") {
      await setDoc(
        referencia,
        Object.assign({}, avaliacao, {
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          edicoes: 1
        })
      );
      return;
    }
    throw error;
  }
}
