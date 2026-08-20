import { db, firebaseReady, COLECAO_AVALIACOES, COLECAO_MATRICULAS } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");

  const siteHeader = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  if (siteHeader && hero) {
    const updateHeader = function () {
      const threshold = Math.max(0, hero.offsetHeight - siteHeader.offsetHeight);
      siteHeader.classList.toggle("scrolled", window.scrollY > threshold);
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader, { passive: true });
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.classList.toggle("active", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function initials(nome) {
    const parts = nome.trim().split(/\s+/);
    return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : "")).toUpperCase();
  }

  const ratingsSection = document.getElementById("avaliacoes");
  const ratingsGrid = document.getElementById("ratingsGrid");
  if (ratingsSection && ratingsGrid) {
    renderRatings(ratingsSection, ratingsGrid);
  }

  async function renderRatings(section, grid) {
    if (!firebaseReady) {
      section.hidden = true;
      return;
    }

    let ratings = [];
    try {
      const snap = await getDocs(
        query(collection(db, COLECAO_AVALIACOES), orderBy("criadoEm", "desc"), limit(12))
      );
      snap.forEach(function (docSnap) {
        ratings.push(docSnap.data());
      });
    } catch (e) {
      console.error("[Simple English] Erro ao carregar avaliações:", e);
      section.hidden = true;
      return;
    }

    if (ratings.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = ratings.map(function (r) {
      const nota = Math.max(1, Math.min(5, Number(r.nota) || 0));
      const stars = "★".repeat(nota) + "☆".repeat(5 - nota);
      const curso = r.curso ? "Aluno — " + escapeHtml(r.curso) : "Aluno";
      return (
        '<figure class="testimonial">' +
        '<blockquote>"' + escapeHtml(r.comentario || "Avaliou o curso com " + nota + " estrelas.") + '"</blockquote>' +
        '<figcaption>' +
        '<span class="avatar">' + escapeHtml(initials(r.nome || "Aluno")) + "</span>" +
        "<div><strong>" + escapeHtml(r.nome || "Aluno") + "</strong><small>" + curso + "</small></div>" +
        '<span class="stars">' + stars + "</span>" +
        "</figcaption>" +
        "</figure>"
      );
    }).join("");
  }

  const form = document.getElementById("signupForm");
  if (!form) return;

  const phoneInput = document.getElementById("telefone");
  phoneInput.addEventListener("input", function () {
    let value = phoneInput.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (value.length > 0) {
      value = value.replace(/^(\d{0,2})$/, "($1");
    }
    phoneInput.value = value;
    phoneInput.classList.remove("invalid");
    setError(phoneInput, "");
  });

  const emailInput = document.getElementById("email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, message) {
    const errorEl = document.querySelector('[data-error-for="' + input.id + '"]');
    if (errorEl) errorEl.textContent = message;
    input.classList.toggle("invalid", Boolean(message));
  }

  function validateField(input) {
    if (input.type === "checkbox") {
      return input.checked;
    }
    return input.value.trim() !== "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    let valid = true;

    ["nome", "email", "telefone", "curso", "modalidade"].forEach(function (id) {
      const input = document.getElementById(id);
      if (!validateField(input)) {
        setError(input, "Este campo é obrigatório.");
        valid = false;
      } else if (id === "email" && !emailRegex.test(input.value.trim())) {
        setError(input, "Informe um e-mail válido.");
        valid = false;
      } else if (id === "telefone" && input.value.replace(/\D/g, "").length < 10) {
        setError(input, "Informe um telefone válido com DDD.");
        valid = false;
      } else {
        setError(input, "");
      }
    });

    const termos = document.getElementById("termos");
    if (!termos.checked) {
      setError(termos, "Você precisa aceitar os termos para continuar.");
      valid = false;
    } else {
      setError(termos, "");
    }

    if (!valid) {
      const firstInvalid = form.querySelector(".invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const btn = document.getElementById("submitBtn");
    const nivelSelecionado = form.querySelector('input[name="nivel"]:checked');
    const cursoSelect = document.getElementById("curso");
    const modalidadeSelect = document.getElementById("modalidade");

    const matricula = {
      nome: document.getElementById("nome").value.trim(),
      email: emailInput.value.trim(),
      telefone: phoneInput.value.trim(),
      curso: cursoSelect.options[cursoSelect.selectedIndex].text,
      cursoId: cursoSelect.value,
      modalidade: modalidadeSelect.options[modalidadeSelect.selectedIndex].text,
      nivel: nivelSelecionado ? nivelSelecionado.value : "",
      mensagem: document.getElementById("mensagem").value.trim(),
      status: "novo",
      criadoEm: serverTimestamp()
    };

    function mostrarSucesso() {
      document.getElementById("successName").textContent = matricula.nome.split(" ")[0];
      document.getElementById("successCourse").textContent = matricula.curso;
      form.hidden = true;
      document.getElementById("successPanel").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (!firebaseReady) {
      setError(termos, "Envio indisponível: o Firebase ainda não foi configurado em js/firebase-config.js.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Enviando...";

    addDoc(collection(db, COLECAO_MATRICULAS), matricula)
      .then(mostrarSucesso)
      .catch(function (error) {
        console.error("[Simple English] Erro ao enviar matrícula:", error);
        setError(
          termos,
          error && error.code === "permission-denied"
            ? "O banco de dados recusou o envio. Publique as regras do Firestore (firestore.rules) no console do Firebase."
            : "Não foi possível enviar sua matrícula. Verifique sua conexão e tente novamente."
        );
        btn.disabled = false;
        btn.textContent = "Enviar matrícula";
      });
  });

  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("blur", function () {
      if (input.type === "checkbox") return;
      if (input.value.trim() !== "") setError(input, "");
    });
    input.addEventListener("input", function () {
      if (input.classList.contains("invalid")) setError(input, "");
    });
  });
});
