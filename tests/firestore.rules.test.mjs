import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

const PROJECT_ID = "simpleenglish-security-tests";
let testEnv;

before(async function () {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile("firestore.rules", "utf8")
    }
  });
});

beforeEach(async function () {
  await testEnv.clearFirestore();
});

after(async function () {
  await testEnv.cleanup();
});

function firestoreAnonimo() {
  return testEnv.unauthenticatedContext().firestore();
}

function firestoreAluno(uid, email, verificado = false) {
  return testEnv.authenticatedContext(uid, {
    email,
    email_verified: verificado
  }).firestore();
}

function perfilValido(email, extras = {}) {
  return {
    nome: "Maria Silva",
    email,
    curso: "Curso Regular",
    criadoEm: serverTimestamp(),
    ...extras
  };
}

function avaliacaoValida(uid, extras = {}) {
  return {
    uid,
    nome: "Maria",
    curso: "Curso Regular",
    nota: 5,
    comentario: "Ótimas aulas.",
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    edicoes: 1,
    ...extras
  };
}

function matriculaValida(uid = "uid-maria", extras = {}) {
  return {
    uid,
    nome: "Maria Silva",
    email: "maria@example.com",
    telefone: "(85) 99999-9999",
    curso: "Curso Regular",
    cursoId: "regular",
    modalidade: "Online",
    modalidadeId: "online",
    nivel: "basico",
    mensagem: "Quero conhecer a turma.",
    status: "novo",
    criadoEm: serverTimestamp(),
    ...extras
  };
}

test("perfil fica restrito ao próprio UID e a um esquema fechado", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const outro = firestoreAluno("uid-outro", "outro@example.com", true);
  const extra = firestoreAluno("uid-extra", "extra@example.com", true);
  const referencia = doc(maria, "alunos/uid-maria");

  await assertSucceeds(setDoc(referencia, perfilValido("maria@example.com")));
  await assertSucceeds(getDoc(referencia));
  await assertFails(getDoc(doc(outro, "alunos/uid-maria")));
  await assertFails(setDoc(doc(outro, "alunos/uid-maria"), perfilValido("outro@example.com")));
  await assertFails(setDoc(doc(maria, "alunos/outro-uid"), perfilValido("maria@example.com")));
  await assertFails(setDoc(doc(extra, "alunos/uid-extra"), perfilValido("extra@example.com", { admin: true })));
});

test("atualização do perfil preserva o instante de criação", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "alunos/uid-maria");

  await assertSucceeds(setDoc(referencia, perfilValido("maria@example.com")));
  await assertSucceeds(updateDoc(referencia, { nome: "Maria Souza" }));
  await assertFails(updateDoc(referencia, { criadoEm: serverTimestamp() }));
});

test("avaliação exige autor autenticado e e-mail verificado", async function () {
  const naoVerificado = firestoreAluno("uid-maria", "maria@example.com", false);
  const verificado = firestoreAluno("uid-maria", "maria@example.com", true);
  const invasor = firestoreAluno("uid-outro", "outro@example.com", true);

  await assertFails(setDoc(doc(naoVerificado, "avaliacoes/uid-maria"), avaliacaoValida("uid-maria")));
  await assertFails(setDoc(doc(invasor, "avaliacoes/uid-maria"), avaliacaoValida("uid-maria")));
  await assertSucceeds(setDoc(doc(verificado, "avaliacoes/uid-maria"), avaliacaoValida("uid-maria")));
  await assertSucceeds(getDocs(collection(firestoreAnonimo(), "avaliacoes")));
});

test("avaliação rejeita campos extras e edição imediata", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "avaliacoes/uid-maria");

  await assertFails(setDoc(referencia, avaliacaoValida("uid-maria", { email: "maria@example.com" })));
  await assertSucceeds(setDoc(referencia, avaliacaoValida("uid-maria")));
  await assertFails(updateDoc(referencia, {
    nota: 4,
    atualizadoEm: serverTimestamp(),
    edicoes: 2
  }));
});

test("avaliação não pode apagar e recriar para zerar o cooldown", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "avaliacoes/uid-maria");

  await assertSucceeds(setDoc(referencia, avaliacaoValida("uid-maria")));
  await assertFails(deleteDoc(referencia));
});

test("matrícula rejeita usuário anônimo e conta sem e-mail verificado", async function () {
  const referenciaAnonima = doc(firestoreAnonimo(), "matriculas/uid-maria");
  const naoVerificado = firestoreAluno("uid-maria", "maria@example.com", false);

  await assertFails(setDoc(referenciaAnonima, matriculaValida()));
  await assertFails(setDoc(doc(naoVerificado, "matriculas/uid-maria"), matriculaValida()));
});

test("matrícula aceita criação legítima do próprio UID verificado", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  await assertSucceeds(setDoc(doc(maria, "matriculas/uid-maria"), matriculaValida()));
});

test("matrícula rejeita UID, documento ou e-mail de outra pessoa", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);

  await assertFails(setDoc(doc(maria, "matriculas/uid-outro"), matriculaValida("uid-outro", {
    email: "outro@example.com"
  })));
  await assertFails(setDoc(doc(maria, "matriculas/uid-maria"), matriculaValida("uid-outro")));
  await assertFails(setDoc(doc(maria, "matriculas/uid-maria"), matriculaValida("uid-maria", {
    email: "outro@example.com"
  })));
});

test("matrícula rejeita campos extras, ausentes e tipos incorretos", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "matriculas/uid-maria");
  const semTelefone = matriculaValida();
  delete semTelefone.telefone;

  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { admin: true })));
  await assertFails(setDoc(referencia, semTelefone));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { mensagem: 123 })));
  await assertFails(setDoc(referencia, { uid: "uid-maria", nome: "Maria" }));
});

test("matrícula rejeita valores adulterados e payload excessivo", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "matriculas/uid-maria");

  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { telefone: "123" })));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { cursoId: "admin" })));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { modalidade: "Presencial" })));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { status: "aprovado" })));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { mensagem: "x".repeat(1001) })));
});

test("matrícula é deduplicada e permanece ilegível e imutável", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  const referencia = doc(maria, "matriculas/uid-maria");

  await assertSucceeds(setDoc(referencia, matriculaValida()));
  await assertFails(setDoc(referencia, matriculaValida("uid-maria", { mensagem: "duplicada" })));
  await assertFails(getDoc(referencia));
  await assertFails(getDoc(doc(firestoreAnonimo(), "matriculas/uid-maria")));
  await assertFails(updateDoc(referencia, { mensagem: "conteúdo alterado" }));
  await assertFails(deleteDoc(referencia));
});

test("coleções não declaradas permanecem fechadas", async function () {
  const maria = firestoreAluno("uid-maria", "maria@example.com", true);
  await assertFails(getDoc(doc(maria, "administradores/root")));
  await assertFails(setDoc(doc(maria, "administradores/root"), { admin: true }));
});
