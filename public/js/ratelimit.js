// Bloqueio escalonado (rate limit) do lado do cliente.
//
// Cada ação protegida tem sua própria chave ("login", "matricula", ...).
// Falhas repetidas dentro de uma janela geram bloqueio; a cada bloqueio
// novo o castigo sobe um degrau da escada. Depois de um período limpo o
// nível decai e a pessoa volta ao início.
//
// Isto é dissuasor de uso e de robô ingênuo, NÃO é segurança: o estado
// vive no localStorage e pode ser apagado. O limite que não dá para
// burlar está nas regras do Firestore (cooldown escalonado gravado no
// próprio documento), em "firestore.rules".

const PREFIXO = "se_rl_";

// Escada de castigo: 1º bloqueio 30s, depois 2min, 10min, 1h, 6h, 24h.
const ESCADA_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];

// Sem nenhuma falha por este tempo, o nível cai um degrau.
const DECAIMENTO_MS = 6 * 60 * 60 * 1000;

const PADRAO = { falhas: 3, janelaMs: 5 * 60 * 1000 };

function agora() {
  return Date.now();
}

function ler(chave) {
  let estado = null;
  try {
    estado = JSON.parse(localStorage.getItem(PREFIXO + chave) || "null");
  } catch (erro) {
    estado = null;
  }
  if (!estado || typeof estado !== "object") {
    return { tentativas: [], nivel: 0, ate: 0, ultimoEvento: 0 };
  }
  return {
    tentativas: Array.isArray(estado.tentativas) ? estado.tentativas.filter(function (t) { return typeof t === "number"; }) : [],
    nivel: Number(estado.nivel) || 0,
    ate: Number(estado.ate) || 0,
    ultimoEvento: Number(estado.ultimoEvento) || 0
  };
}

function gravar(chave, estado) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(estado));
  } catch (erro) {
    // Modo privado ou storage cheio: sem persistência, segue sem travar a página.
  }
}

// Aplica o decaimento de nível antes de qualquer decisão.
function comDecaimento(estado, momento) {
  if (estado.nivel > 0 && estado.ate <= momento && estado.ultimoEvento > 0) {
    const limpoDesde = momento - Math.max(estado.ate, estado.ultimoEvento);
    if (limpoDesde >= DECAIMENTO_MS) {
      const degraus = Math.floor(limpoDesde / DECAIMENTO_MS);
      estado.nivel = Math.max(0, estado.nivel - degraus);
      estado.ultimoEvento = momento;
      estado.tentativas = [];
    }
  }
  return estado;
}

/**
 * Situação atual da chave, sem registrar nada.
 * @returns {{bloqueado: boolean, restanteMs: number, nivel: number}}
 */
export function verificar(chave) {
  const momento = agora();
  const estado = comDecaimento(ler(chave), momento);
  gravar(chave, estado);

  // "ate" muito à frente indica relógio alterado para trás: ignora o resto.
  const restante = estado.ate - momento;
  if (restante > 0) {
    return { bloqueado: true, restanteMs: restante, nivel: estado.nivel };
  }
  return { bloqueado: false, restanteMs: 0, nivel: estado.nivel };
}

/**
 * Registra uma falha. Ao passar do limite dentro da janela, bloqueia pelo
 * tempo do degrau atual e sobe um degrau para a próxima vez.
 * @param {string} chave
 * @param {{falhas?: number, janelaMs?: number}} [opcoes]
 * @returns {{bloqueado: boolean, restanteMs: number, nivel: number, restam: number}}
 */
export function falha(chave, opcoes) {
  const limite = (opcoes && opcoes.falhas) || PADRAO.falhas;
  const janela = (opcoes && opcoes.janelaMs) || PADRAO.janelaMs;
  const momento = agora();
  const estado = comDecaimento(ler(chave), momento);

  if (estado.ate > momento) {
    gravar(chave, estado);
    return { bloqueado: true, restanteMs: estado.ate - momento, nivel: estado.nivel, restam: 0 };
  }

  estado.tentativas = estado.tentativas.filter(function (t) { return momento - t < janela; });
  estado.tentativas.push(momento);
  estado.ultimoEvento = momento;

  if (estado.tentativas.length >= limite) {
    const castigo = ESCADA_MS[Math.min(estado.nivel, ESCADA_MS.length - 1)];
    estado.ate = momento + castigo;
    estado.nivel = Math.min(estado.nivel + 1, ESCADA_MS.length);
    estado.tentativas = [];
    gravar(chave, estado);
    return { bloqueado: true, restanteMs: castigo, nivel: estado.nivel, restam: 0 };
  }

  gravar(chave, estado);
  return { bloqueado: false, restanteMs: 0, nivel: estado.nivel, restam: limite - estado.tentativas.length };
}

/**
 * Bloqueia direto, sem contar falhas. Use em ação que só pode repetir
 * com intervalo (envio de formulário, por exemplo).
 */
export function bloquear(chave) {
  const momento = agora();
  const estado = comDecaimento(ler(chave), momento);
  const castigo = ESCADA_MS[Math.min(estado.nivel, ESCADA_MS.length - 1)];
  estado.ate = momento + castigo;
  estado.nivel = Math.min(estado.nivel + 1, ESCADA_MS.length);
  estado.tentativas = [];
  estado.ultimoEvento = momento;
  gravar(chave, estado);
  return { bloqueado: true, restanteMs: castigo, nivel: estado.nivel };
}

/** Ação concluída com êxito: zera a contagem da janela, preserva o nível. */
export function sucesso(chave) {
  const momento = agora();
  const estado = comDecaimento(ler(chave), momento);
  estado.tentativas = [];
  estado.ultimoEvento = momento;
  gravar(chave, estado);
}

/** Apaga todo o estado da chave. */
export function limpar(chave) {
  try {
    localStorage.removeItem(PREFIXO + chave);
  } catch (erro) {
    // sem storage, nada a limpar
  }
}

/** "2 minutos e 30 segundos", "1 hora", "45 segundos" */
export function textoEspera(ms) {
  const total = Math.max(1, Math.ceil(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;

  const partes = [];
  if (horas > 0) partes.push(horas + (horas === 1 ? " hora" : " horas"));
  if (minutos > 0) partes.push(minutos + (minutos === 1 ? " minuto" : " minutos"));
  if (segundos > 0 && horas === 0) partes.push(segundos + (segundos === 1 ? " segundo" : " segundos"));

  if (partes.length === 0) return "1 segundo";
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1];
}

/**
 * Mostra a espera e vai atualizando o texto a cada segundo até liberar.
 * @param {string} chave
 * @param {(mensagem: string) => void} escrever recebe o texto a exibir
 * @param {() => void} [aoLiberar] chamado quando o bloqueio termina
 * @returns {() => void} cancela a contagem
 */
export function contagem(chave, escrever, aoLiberar) {
  let timer = null;

  function passo() {
    const situacao = verificar(chave);
    if (!situacao.bloqueado) {
      if (timer) clearInterval(timer);
      timer = null;
      escrever("");
      if (aoLiberar) aoLiberar();
      return;
    }
    escrever(
      "Muitas tentativas. Aguarde " + textoEspera(situacao.restanteMs) + " para tentar de novo." +
        (situacao.nivel > 1 ? " O tempo de espera cresce a cada bloqueio." : "")
    );
  }

  passo();
  if (verificar(chave).bloqueado) timer = setInterval(passo, 1000);

  return function cancelar() {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
