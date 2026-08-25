# Simple English

Site da escola **Simple English**: landing page, formulário de matrícula e área do aluno com avaliações. A aplicação usa HTML, CSS e JavaScript puro com Firebase Authentication, Cloud Firestore e App Check. Todos os arquivos servidos ao navegador ficam em `public/`; configurações, testes e `.env` permanecem fora da raiz pública.

## Páginas

| Arquivo | Descrição |
| --- | --- |
| `public/index.html` | Landing page e avaliações públicas |
| `public/cadastro.html` | Formulário de interesse em matrícula |
| `public/aluno.html` | Login, registro, perfil e avaliação |
| `public/privacidade.html` | Aviso sobre o tratamento de dados pessoais |

## Controles de segurança

- App Check com reCAPTCHA Enterprise inicializado antes de Auth/Firestore; a aplicação falha fechada se o atestado não subir.
- Regras do Firestore com esquema fechado, validação de tipos/tamanhos, timestamps do servidor, autorização por UID e bloqueio padrão de coleções desconhecidas.
- Matrículas exigem usuário autenticado com e-mail verificado. O documento usa o UID como ID, aceita uma única criação por conta e nenhum cliente pode ler, atualizar ou apagar esses dados.
- Avaliações públicas só podem ser criadas ou alteradas pelo próprio UID após confirmação do e-mail; exclusões pelo cliente são bloqueadas para impedir o reset do cooldown por delete/recreate.
- Recuperação de senha responde de forma genérica para reduzir enumeração de contas.
- Senha de cadastro com no mínimo 12 caracteres no cliente e política autoritativa equivalente no Firebase Authentication.
- Persistência de autenticação limitada à sessão da aba, logout após 30 minutos de inatividade e duração máxima local de 8 horas.
- Firebase Hosting envia CSP, proteção contra clickjacking, `nosniff`, política de referência e restrições de recursos do navegador. Estilos inline em elementos são bloqueados; `style-src-attr 'unsafe-inline'` permanece isolado porque o SDK web do Firebase App Check/reCAPTCHA cria atributos de estilo dinamicamente.
- Dependências de teste travadas em `package-lock.json`, auditoria automatizada, Dependabot e workflow de segurança com permissões mínimas.

Os identificadores do app Firebase presentes em `public/js/firebase-config.js` são públicos por design. A proteção efetiva vem das restrições da chave, App Check, Authentication e regras do Firestore. O arquivo `.env` local não é usado pelo navegador, fica fora de `public/` e permanece ignorado pelo Git.

## Desenvolvimento e testes

Pré-requisitos: Node.js 22 para reproduzir o CI, Java 21 para o emulador e Firebase CLI.

```bash
npm ci
npm test
firebase emulators:start --only hosting,firestore
```

Os testes cobrem a fronteira de 12 caracteres da senha, a CSP, isolamento de perfis, verificação de e-mail, campos extras, cooldown de avaliações, autorização e deduplicação das matrículas e default deny.

## Rate limiting

`public/js/ratelimit.js` reduz repetição acidental e robôs ingênuos no navegador com uma escada de 30 segundos a 24 horas. Como o estado fica no `localStorage`, ele é apenas contenção de interface.

O Firestore aplica cooldown autoritativo às edições de uma avaliação. Para matrículas, as regras exigem conta com e-mail verificado e permitem somente uma criação no documento do próprio UID. Isso limita abuso básico e duplicação por conta sem backend pago. Um rate limit verdadeiro por IP ainda exigiria um endpoint controlado, como Cloud Functions/Cloud Run ou um Worker; App Check permanece como a barreira contra clientes não atestados.

## Política de senha no Firebase

A política do backend não é representada pelo arquivo de providers que o Firebase CLI aceita neste projeto. Ela deve permanecer configurada em:

`Firebase Console → Authentication → Settings → Password policy → Minimum length: 12 → Require`

Mantenha `Force upgrade on sign-in` desativado para que contas antigas continuem entrando com a senha atual. Novas senhas e alterações de senha passam a exigir 12 caracteres. O teste local garante o mesmo contrato no frontend; a configuração autoritativa deve ser verificada também no Firebase após cada alteração administrativa.

## Publicação

O projeto padrão é `simpleenglish-fabf9` e está definido em `.firebaserc`.

```bash
firebase deploy --only firestore:rules,hosting
```

Antes de conectar um domínio novo, inclua-o em:

- Firebase Console → Authentication → Domínios autorizados;
- Firebase Console/Google Cloud → reCAPTCHA Enterprise → domínios da chave;
- Google Cloud Console → credencial da API → referrers autorizados.

Depois conecte o domínio ao Firebase Hosting e use exatamente os registros DNS exibidos pelo console. Não mantenha registros do provedor antigo em paralelo. Verifique HTTPS, certificado e os cabeçalhos após a propagação.

### Inventário de origens

- `simpleenglishonline.web.app`: endereço público atual.
- `simpleenglish-fabf9.firebaseapp.com`: domínio técnico usado por `authDomain`; deve permanecer autorizado.
- `simpleenglish-fabf9.web.app`: site anterior mantido temporariamente para rollback.

Os vínculos de `simpleenglish.com.br`, `www.simpleenglish.com.br` e do canal temporário de auditoria foram removidos porque não pertencem ao ambiente atual. Quando a janela de rollback terminar, desative o site anterior e só então remova `simpleenglish-fabf9.web.app` das listas de Authentication, API key e reCAPTCHA.

## Controles operacionais externos ao repositório

Devem permanecer configurados nas contas Google, GitHub, registrador e provedor DNS:

- MFA/passkeys e contas administrativas individuais;
- API key limitada aos domínios e APIs necessárias;
- App Check em `enforce` para Authentication e Cloud Firestore;
- política de senha do Firebase com mínimo de 12 caracteres e proteção contra enumeração de e-mails;
- alertas de orçamento, uso, autenticação e alterações administrativas;
- backups/exportações periódicas do Firestore, com teste de restauração;
- proteção de branch e exigência do workflow `Security checks` antes de merge.
