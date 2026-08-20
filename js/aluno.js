// ============================================================
//  Área do aluno — cadastro, login e avaliações via Firebase
//  Auth: Firebase Authentication (e-mail/senha)
//  Dados: Cloud Firestore (coleções "alunos" e "avaliacoes")
// ============================================================

import {
  auth,
  db,
  firebaseReady,
  firebaseReadyPromise,
  mensagemErroAuth,
  COLECAO_ALUNOS,
  COLECAO_AVALIACOES
} from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const RATING_LABELS = ["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let currentUser = null; // usuário do Firebase Auth
let currentProfile = null; // documento do aluno no Firestore
let selectedStars = 0;
// Evita corrida: o onAuthStateChanged dispara assim que a conta é criada,
// antes de alunos/{uid} existir. Durante o cadastro, quem monta a tela é o
// próprio formulário, que já sabe nome e curso.
let cadastrando = false;

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

function formatarData(valor) {
  const data = valor && typeof valor.toDate === "function" ? valor.toDate() : new Date();
  return data.toLocaleDateString("pt-BR");
}

// ---------- controle de telas ----------

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

// ---------- Firestore ----------

async function carregarPerfil(user) {
  let snap = await getDoc(doc(db, COLECAO_ALUNOS, user.uid));

  // O documento pode ainda estar sendo gravado (cadastro recém-feito).
  if (!snap.exists()) {
    await new Promise(function (r) { setTimeout(r, 900); });
    snap = await getDoc(doc(db, COLECAO_ALUNOS, user.uid));
  }
  if (snap.exists()) return snap.data();

  // Conta criada no Auth mas sem documento (ex.: criada pelo console).
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

// ---------- estrelas ----------

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

// ---------- Firebase ausente ----------

showLoading();

firebaseReadyPromise.then(function () {
  if (!firebaseReady) {
    showLogin();
    setError(
      "loginForm",
      "Cadastro e login indisponíveis: copie .env.example para .env e preencha os dados do Firebase."
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

  el("showRegister").addEventListener("click", function (e) {
    e.preventDefault();
    showRegister();
  });

  el("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    showLogin();
  });

  // ---------- sessão ----------
  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      currentUser = null;
      currentProfile = null;
      selectedStars = 0;
      paintStars(0);
      showLogin();
      return;
    }

    // Durante o cadastro, o formulário monta a tela com os dados digitados.
    if (cadastrando) return;

    currentUser = user;
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

  // ---------- cadastro ----------
  el("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.currentTarget;

    const nome = el("regNome").value.trim();
    const email = el("regEmail").value.trim();
    const senha = el("regSenha").value;
    const senha2 = el("regSenha2").value;
    const curso = el("regCurso").value;

    let valid = true;
    if (!nome) { setError("regNome", "Informe seu nome."); valid = false; } else { setError("regNome", ""); }
    if (!EMAIL_REGEX.test(email)) { setError("regEmail", "Informe um e-mail válido."); valid = false; } else { setError("regEmail", ""); }
    if (senha.length < 6) { setError("regSenha", "A senha deve ter pelo menos 6 caracteres."); valid = false; } else { setError("regSenha", ""); }
    if (senha2 !== senha) { setError("regSenha2", "As senhas não conferem."); valid = false; } else { setError("regSenha2", ""); }
    setError("registerForm", "");
    if (!valid) return;

    setBusy(form, true, "Criando conta...");
    cadastrando = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: nome });

      const perfil = { nome: nome, email: email, curso: curso };
      await setDoc(doc(db, COLECAO_ALUNOS, cred.user.uid), Object.assign({}, perfil, {
        criadoEm: serverTimestamp()
      }));

      currentUser = cred.user;
      currentProfile = perfil;
      form.reset();
      showProfile(perfil, null);
    } catch (error) {
      console.error("[Simple English] Erro no cadastro:", error);
      setError("registerForm", mensagemErroAuth(error));
      // Se a conta foi criada mas a gravação do perfil falhou, o usuário já
      // está logado: abre o perfil com o que houver em vez de travar no form.
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

  // ---------- login ----------
  el("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.currentTarget;

    const email = el("loginEmail").value.trim();
    const senha = el("loginSenha").value;

    let valid = true;
    if (!EMAIL_REGEX.test(email)) { setError("loginEmail", "Informe um e-mail válido."); valid = false; } else { setError("loginEmail", ""); }
    if (!senha) { setError("loginSenha", "Informe sua senha."); valid = false; } else { setError("loginSenha", ""); }
    setError("loginForm", "");
    if (!valid) return;

    setBusy(form, true, "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      form.reset();
    } catch (error) {
      console.error("[Simple English] Erro no login:", error);
      setError("loginForm", mensagemErroAuth(error));
    } finally {
      setBusy(form, false);
    }
  });

  // ---------- recuperar senha ----------
  el("forgotPassword").addEventListener("click", async function (e) {
    e.preventDefault();
    const email = el("loginEmail").value.trim();
    if (!EMAIL_REGEX.test(email)) {
      setError("loginEmail", "Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    setError("loginEmail", "");
    try {
      await sendPasswordResetEmail(auth, email);
      setError("loginForm", "Enviamos um link de redefinição de senha para " + email + ".");
    } catch (error) {
      console.error("[Simple English] Erro ao redefinir senha:", error);
      setError("loginForm", mensagemErroAuth(error));
    }
  });

  // ---------- publicar avaliação ----------
  el("saveRatingBtn").addEventListener("click", async function () {
    if (!currentUser || !currentProfile) return;
    if (selectedStars === 0) {
      setError("ratingStars", "Selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    setError("ratingStars", "");

    const btn = el("saveRatingBtn");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Publicando...";

    const avaliacao = {
      uid: currentUser.uid,
      nome: firstName(currentProfile.nome),
      curso: currentProfile.curso || "",
      nota: selectedStars,
      comentario: el("ratingComentario").value.trim(),
      criadoEm: serverTimestamp()
    };

    try {
      await setDoc(doc(db, COLECAO_AVALIACOES, currentUser.uid), avaliacao);
      renderMyRating(Object.assign({}, avaliacao, { criadoEm: new Date() }));
      el("ratingTitle").textContent = "Atualizar minha avaliação";
      el("ratingComentario").value = "";
      selectedStars = 0;
      paintStars(0);
    } catch (error) {
      console.error("[Simple English] Erro ao salvar avaliação:", error);
      setError(
        "ratingStars",
        error && error.code === "permission-denied"
          ? "O banco de dados recusou a gravação. Publique as regras do Firestore no console do Firebase."
          : "Não foi possível publicar sua avaliação. Tente novamente."
      );
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  // ---------- sair ----------
  el("logoutBtn").addEventListener("click", async function () {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("[Simple English] Erro ao sair:", error);
    }
  });
}
