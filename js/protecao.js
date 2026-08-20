// Dissuasor de inspeção — isto NÃO é segurança; a segurança real está
// nas regras do Firestore. Para desligar neste navegador, abra qualquer
// página com ?dev=SIMPLEENGLISH2026 na URL (religue com ?dev=off).

(function () {
  var CHAVE = "se_modo_dev";
  var SENHA = "SIMPLEENGLISH2026";

  var params = new URLSearchParams(window.location.search);
  var dev = params.get("dev");
  if (dev === SENHA) {
    localStorage.setItem(CHAVE, "1");
    console.info("[Simple English] Modo dev ativado neste navegador.");
  } else if (dev === "off") {
    localStorage.removeItem(CHAVE);
    console.info("[Simple English] Modo dev desativado.");
  }
  if (localStorage.getItem(CHAVE) === "1") return;

  document.addEventListener(
    "keydown",
    function (e) {
      var k = (e.key || "").toLowerCase();
      var inspecao =
        k === "f12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
        ((e.ctrlKey || e.metaKey) && k === "u");
      if (inspecao) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    true
  );

  document.addEventListener(
    "contextmenu",
    function (e) {
      e.preventDefault();
      return false;
    },
    true
  );

  var avisando = false;

  function mostrarAviso() {
    if (avisando || document.getElementById("seAvisoInspecao")) return;
    avisando = true;

    var caixa = document.createElement("div");
    caixa.id = "seAvisoInspecao";
    caixa.setAttribute("role", "status");
    caixa.style.cssText =
      "position:fixed;z-index:99999;left:50%;bottom:24px;transform:translateX(-50%);" +
      "max-width:min(520px,92vw);background:#0b3a5d;color:#fff;padding:16px 20px;" +
      "border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.28);font:500 0.95rem/1.5 " +
      "Inter,system-ui,sans-serif;display:flex;gap:14px;align-items:flex-start";

    var texto = document.createElement("p");
    texto.style.cssText = "margin:0";
    texto.textContent =
      "Este site é da Simple English. O conteúdo e o código são de uso exclusivo da escola. " +
      "Os dados dos alunos ficam protegidos no servidor.";

    var fechar = document.createElement("button");
    fechar.type = "button";
    fechar.setAttribute("aria-label", "Fechar aviso");
    fechar.textContent = "✕";
    fechar.style.cssText =
      "background:none;border:0;color:#fff;font-size:1rem;cursor:pointer;padding:0 2px;line-height:1.5";
    fechar.addEventListener("click", function () {
      caixa.remove();
    });

    caixa.appendChild(texto);
    caixa.appendChild(fechar);
    document.body.appendChild(caixa);
  }

  function verificar() {
    var larguraSuspeita = window.outerWidth - window.innerWidth > 220;
    var alturaSuspeita = window.outerHeight - window.innerHeight > 220;
    if (larguraSuspeita || alturaSuspeita) mostrarAviso();
  }

  window.addEventListener("resize", verificar, { passive: true });
  setInterval(verificar, 2000);
  verificar();
})();
