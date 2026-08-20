# Simple English

Site da escola **Simple English**: landing page institucional, cadastro de alunos e área do aluno com avaliações. Feito com HTML, CSS e JavaScript puro, usando **Firebase** (Authentication, Cloud Firestore e App Check) no plano Spark.

## Páginas

| Arquivo       | Descrição                                                        |
| ------------- | ---------------------------------------------------------------- |
| `index.html`  | Landing page com intro animada, método, cursos e CTA de cadastro |
| `cadastro.html` | Formulário de matrícula do aluno                                |
| `aluno.html`  | Área do aluno: login/registro, perfil e avaliação da escola      |

## Estrutura

```
simpleenglish/
├── index.html
├── cadastro.html
├── aluno.html
├── firestore.rules          # regras de segurança do Firestore
├── assets/                  # imagens e logo
├── css/
│   └── style.css
└── js/
    ├── firebase-config.js   # inicialização do Firebase (chaves públicas)
    ├── intro.js             # animação de entrada (canvas)
    ├── main.js              # lógica da landing page
    └── aluno.js             # login, perfil e avaliações (estrelas)
```

## Funcionalidades

- Landing page responsiva com animação de intro em canvas
- Cadastro e login por e-mail/senha (Firebase Auth)
- Perfil do aluno com foto/avatar e dados da matrícula
- Avaliação da escola por estrelas (1–5), salva no Firestore
- App Check com reCAPTCHA Enterprise para atestado das requisições
- Regras de segurança do Firestore em `firestore.rules`
## Rodando localmente

O site usa módulos ES, então abrir direto por `file://` pode ser bloqueado pelo navegador. Use um servidor local:

```bash
python -m http.server 8000
```

E acesse `http://localhost:8000`.

## Firebase

A configuração fica direto em `js/firebase-config.js`, no projeto `simpleenglish-fabf9`. Serviços usados:

- **Authentication** com provedor e-mail/senha
- **Firestore** com as coleções `alunos`, `avaliacoes` e `matriculas`
- **App Check** com reCAPTCHA Enterprise — a chave atual autoriza apenas `localhost`

> `apiKey`, `appId` e a chave de site do reCAPTCHA são **públicas por design**: todo app web Firebase as entrega ao navegador, logo não há como escondê-las de quem abre o site. Elas identificam o projeto, não autorizam acesso.

Não existe `.env` neste projeto, de propósito: qualquer arquivo servido ao navegador é legível por qualquer visitante (`https://seu-dominio/.env`), então guardar credencial ali dá falsa sensação de sigilo. **Segredo de verdade** — chave de API paga, credencial de service account, senha SMTP — só pode viver em backend ou Cloud Functions, nunca neste repositório.

### O que realmente protege os dados

1. `firestore.rules` — cada coleção com lista fechada de campos (`hasOnly`), limites de tamanho e `criadoEm == request.time`. É a única barreira efetiva; republique após qualquer alteração em Firestore → Regras.
2. Firebase Console → Authentication → Domínios autorizados: apenas domínios seus.
3. Google Cloud Console → APIs e Serviços → Credenciais → restringir a API key por referrer HTTP e por API (Identity Toolkit, Firestore).
4. Firebase Console → App Check → APIs → Cloud Firestore em modo **enforce** (só depois de autorizar o domínio real na chave reCAPTCHA), para conter envio automatizado em massa no formulário público de matrícula.

Para publicar em outro domínio, adicione o domínio em:
- Firebase Console → Authentication → Domínios autorizados
- Google Cloud Console → Segurança → reCAPTCHA Enterprise → chave `simple-english-site` → Lista de domínios

E republique as regras de `firestore.rules` em Firestore → Regras.
