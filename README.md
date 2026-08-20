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
    ├── aluno.js             # login, perfil e avaliações (estrelas)
    └── protecao.js          # controle de acesso às páginas
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

As credenciais ficam em um arquivo `.env` na raiz do projeto, **fora do Git** (ver `.gitignore`). Para configurar:

```bash
Copy-Item .env.example .env   # Windows
cp .env.example .env          # Linux/macOS
```

E preencha o `.env` com os dados do projeto (`simpleenglish-fabf9`) em Configurações do projeto → seus apps → app da Web. O `firebase-config.js` carrega esse arquivo no navegador e inicializa os serviços de forma assíncrona (`firebaseReadyPromise`):

- **Authentication** com provedor e-mail/senha
- **Firestore** com as coleções `alunos`, `avaliacoes` e `matriculas`
- **App Check** com reCAPTCHA Enterprise — a chave atual autoriza apenas `localhost`

> A `apiKey` do Firebase é pública por design: o Firebase identifica o projeto por ela, e a proteção real vem das regras do Firestore, não do sigilo da chave.

Para publicar em outro domínio, adicione o domínio em:
- Firebase Console → Authentication → Domínios autorizados
- Google Cloud Console → Segurança → reCAPTCHA Enterprise → chave `simple-english-site` → Lista de domínios

E republique as regras de `firestore.rules` em Firestore → Regras.
