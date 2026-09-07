/**
 * Envio de e-mail.
 *
 * Dois transportes, escolhidos por `MAIL_TRANSPORT`:
 *
 * - `log` — grava a mensagem no log em vez de enviar. É o padrão, e é o que
 *   homologação usa: quem opera lê o link em `npm run logs` e percorre o fluxo
 *   inteiro sem depender de provedor contratado.
 * - `smtp` — entrega de verdade, por um servidor SMTP qualquer (a proposta
 *   07/2026 exclui o provedor do escopo na seção 14, então nada aqui amarra a
 *   um fornecedor: são host, porta e credencial em variável de ambiente).
 *
 * Um valor desconhecido não silencia o envio: cai no `default` e avisa alto.
 */

import { createTransport, type Transporter } from "nodemailer";

import { NERD_EMAIL_HEADER_BASE64 } from "./brand-logo.ts";

export interface Mail {
  to: string;
  subject: string;
  /** Versão em texto puro. Sempre presente: cliente que recusa HTML lê esta. */
  body: string;
  /** Versão em HTML, opcional. Quando existe, vai junto como alternativa. */
  html?: string;
  /** Cópia oculta. Os destinatários não veem uns aos outros. */
  bcc?: string | string[];
}

export type MailResult =
  | { sent: true }
  | { sent: false; reason: "no_transport" | "send_failed" };

/**
 * O transporte é caro de montar (resolve DNS, abre TLS, autentica) e o
 * nodemailer reaproveita conexão por trás. Criar um por e-mail jogaria isso
 * fora a cada pedido de recuperação.
 */
let cached: Transporter | null = null;

function smtpTransport(): Transporter {
  if (cached) return cached;

  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT ?? 587);

  cached = createTransport({
    host,
    port,
    /* 465 é TLS desde o primeiro byte; 587 abre em claro e sobe para TLS via
       STARTTLS. Marcar `secure` na porta errada trava a conexão sem erro
       legível, então a porta decide. */
    secure: port === 465,
    auth: { user: requireEnv("SMTP_USER"), pass: requireEnv("SMTP_PASSWORD") },
    /* Sem isto, um servidor que não ofereça STARTTLS receberia a senha em
       texto claro — o nodemailer apenas segue adiante. */
    requireTLS: port !== 465,
  });

  return cached;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MAIL_TRANSPORT=smtp exige ${name} definido no ambiente.`);
  }
  return value;
}

/**
 * Entrega a mensagem.
 *
 * Devolve `sent: false` em vez de lançar: o pedido de recuperação responde a
 * mesma coisa com ou sem provedor, porque revelar a diferença diria a quem
 * tenta se o e-mail existe na base.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const transport = process.env.MAIL_TRANSPORT ?? "log";

  if (transport === "smtp") {
    try {
      await smtpTransport().sendMail({
        /* O remetente precisa ser um endereço que o servidor aceite enviar;
           num SMTP autenticado costuma ser a própria conta. */
        from: process.env.SMTP_FROM ?? requireEnv("SMTP_USER"),
        to: mail.to,
        subject: mail.subject,
        text: mail.body,
        /* `html` entra como alternativa, não como substituto: quem recusa HTML
           continua recebendo o texto acima. */
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.bcc ? { bcc: mail.bcc } : {}),
      });
      return { sent: true };
    } catch (error) {
      /* O motivo fica no log do servidor, nunca na resposta: "usuário
         desconhecido" devolvido ao formulário diria quais e-mails existem. */
      console.error("Falha ao enviar e-mail por SMTP:", error);
      return { sent: false, reason: "send_failed" };
    }
  }

  if (transport === "log") {
    /* Não é `console.log` de depuração esquecido: é o transporte escolhido
       quando nenhum provedor foi contratado. O corpo aparece inteiro porque em
       HML alguém precisa clicar no link. */
    console.info(
      [
        "--- e-mail não enviado (MAIL_TRANSPORT=log) ---",
        `para: ${mail.to}`,
        ...(mail.bcc ? [`cópia oculta: ${Array.isArray(mail.bcc) ? mail.bcc.join(", ") : mail.bcc}`] : []),
        `assunto: ${mail.subject}`,
        mail.body,
        "--- fim ---",
      ].join("\n"),
    );
    return { sent: false, reason: "no_transport" };
  }

  console.error(`MAIL_TRANSPORT="${transport}" não existe; use "log" ou "smtp". E-mail descartado.`);
  return { sent: false, reason: "no_transport" };
}

/** Monta o e-mail de redefinição. O link é montado por quem chama. */
export function resetPasswordMail(to: string, fullName: string, link: string): Mail {
  return {
    to,
    subject: "Redefinir sua senha: Exemplo S.A.",
    body: [
      `Olá, ${fullName}.`,
      "",
      "Recebemos um pedido para redefinir a sua senha. Se foi você, use o link:",
      link,
      "",
      "O link vale por 1 hora e só pode ser usado uma vez.",
      "Se não foi você, ignore esta mensagem: sua senha continua a mesma.",
    ].join("\n"),
  };
}

/**
 * E-mail de conta criada.
 *
 * O cabeçalho é uma imagem, não HTML pintado: o Outlook aplica o próprio modo
 * escuro sobre a mensagem e reescreve `background-color`, o que transformava o
 * azul da marca em roxo. Pixel ele não reescreve.
 *
 * O resto usa tabela e estilo embutido porque cliente de e-mail não carrega
 * folha externa e o Outlook ignora boa parte de flexbox e grid. `bgcolor` como
 * atributo acompanha cada cor de fundo: é o que o motor antigo do Word lê.
 *
 * O texto puro vai junto para quem recebe só ele.
 */
export function accountCreatedMail(options: {
  to: string;
  fullName: string;
  password: string;
  siteUrl: string;
  bcc?: string | string[];
}): Mail {
  const { to, fullName, password, siteUrl } = options;
  const primeiroNome = fullName.split(" ")[0] ?? fullName;

  const body = [
    `Bem-vindo à plataforma de ensino da Exemplo S.A., ${primeiroNome}.`,
    "",
    "Sua conta foi criada e já está liberada.",
    "",
    `Endereço: ${siteUrl}`,
    `Usuário: ${to}`,
    `Senha: ${password}`,
    "",
    "Ambiente de homologação.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
<meta name="x-apple-disable-message-reformatting" />
<title>Bem-vindo à plataforma de ensino da Exemplo S.A.</title>
<!--[if mso]><style>body,table,td{font-family:Arial,sans-serif !important}</style><![endif]-->
<style>
  /* Modo escuro de cliente de e-mail: Outlook (data-ogsc/ogsb), Gmail e Apple
     Mail reescrevem cor de texto e de fundo por conta própria. Sem estas
     regras a senha saía roxa, porque o arroba faz o cliente tratá-la como
     endereço, e os títulos escureciam contra o card branco.
     O color-scheme em :root declara que a mensagem já é clara e não deve ser
     convertida; os seletores abaixo cobrem quem converte assim mesmo. */
  :root { color-scheme: light; supported-color-schemes: light; }
  u + .body .dark-guard { color: inherit !important; }
  [data-ogsc] .t-title, [data-ogsb] .t-title { color: #4C1D95 !important; }
  [data-ogsc] .t-body, [data-ogsb] .t-body { color: #303236 !important; }
  [data-ogsc] .t-label, [data-ogsb] .t-label { color: #494C50 !important; }
  [data-ogsc] .t-value, [data-ogsb] .t-value { color: #4C1D95 !important; }
  [data-ogsc] .t-pass, [data-ogsb] .t-pass { color: #4C1D95 !important; }
  [data-ogsc] .card, [data-ogsb] .card { background-color: #FFFFFF !important; }
  [data-ogsc] .panel, [data-ogsb] .panel { background-color: #F5F3FF !important; }
  @media (prefers-color-scheme: dark) {
    .t-title { color: #4C1D95 !important; }
    .t-body { color: #303236 !important; }
    .t-label { color: #494C50 !important; }
    .t-value { color: #4C1D95 !important; }
    .t-pass  { color: #4C1D95 !important; }
    .card { background-color: #FFFFFF !important; }
    .panel { background-color: #F5F3FF !important; }
  }
</style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#F5F3FF;" bgcolor="#F5F3FF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F3FF" style="border-collapse:collapse;background-color:#F5F3FF;">
<tr><td align="center" style="padding:32px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" class="card" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#FFFFFF;border-radius:6px;overflow:hidden;">

<!-- Cabeçalho: imagem, para o Outlook não repintar o azul da marca. -->
<tr><td style="padding:0;font-size:0;line-height:0;">
  <img src="${NERD_EMAIL_HEADER_BASE64}" width="600" alt="Exemplo S.A., bem-vindo à plataforma de ensino" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
</td></tr>

<!-- Saudação -->
<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:36px 44px 0;">
  <p class="t-title" style="margin:0 0 10px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#4C1D95;">Olá, ${primeiroNome}</p>
  <p class="t-body" style="margin:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#303236;">Sua conta foi criada e já está liberada. Use os dados abaixo para entrar.</p>
</td></tr>

<!-- Credenciais -->
<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:26px 44px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F3FF" class="panel" style="border-collapse:collapse;background-color:#F5F3FF;border:1px solid #C9E0F2;border-radius:0;">
    <tr><td style="padding:24px 26px;">
      <p style="margin:0 0 6px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#494C50;letter-spacing:0.08em;" class="t-label">USUÁRIO</p>
      <p style="margin:0 0 20px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#4C1D95;word-break:break-all;" class="t-value">${to}</p>
      <p style="margin:0 0 6px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#494C50;letter-spacing:0.08em;" class="t-label">SENHA</p>
      <!-- O \`@\` da senha faz Outlook e Gmail tratarem o texto como endereço e
           repintarem de roxo. \`!important\` e o span aninhado seguram a cor. -->
      <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:23px;font-weight:700;color:#4C1D95 !important;" class="t-pass"><span class="t-pass" style="color:#4C1D95 !important;text-decoration:none !important;">${password}</span></p>
    </td></tr>
  </table>
</td></tr>

<!-- Botão: tabela com bgcolor, porque <a> com padding some no Outlook. -->
<tr><td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:30px 44px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr><td align="center" bgcolor="#6D28D9" style="background-color:#6D28D9;border-radius:10px;">
      <a href="${siteUrl}" style="display:inline-block;padding:16px 44px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;">Acessar a plataforma</a>
    </td></tr>
  </table>
</td></tr>

<!-- Outros perfis: quem recebe entra como aluno, e a plataforma tem quatro
     visões distintas. Sem isto o teste ficaria restrito a uma delas. -->
<tr><td bgcolor="#FFFFFF" class="card" style="background-color:#FFFFFF;padding:0 44px 36px;">
  <p class="t-title" style="margin:0 0 4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#4C1D95;">Conheça as outras visões</p>
  <p class="t-body" style="margin:0 0 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#303236;">Contas de demonstração, cada uma com um perfil de acesso diferente. A senha é o usuário sem o ponto.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td class="t-label" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#494C50;width:120px;">Aluno</td>
      <td class="t-value" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:Consolas,'Courier New',monospace;font-size:13px;color:#4C1D95;">user.mock · usermock</td>
    </tr>
    <tr>
      <td class="t-label" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#494C50;">Instrutor</td>
      <td class="t-value" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:Consolas,'Courier New',monospace;font-size:13px;color:#4C1D95;">instructor.mock · instructormock</td>
    </tr>
    <tr>
      <td class="t-label" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#494C50;">Gestor</td>
      <td class="t-value" style="padding:9px 0;border-bottom:1px solid #EDE9FE;font-family:Consolas,'Courier New',monospace;font-size:13px;color:#4C1D95;">manager.mock · managermock</td>
    </tr>
    <tr>
      <td class="t-label" style="padding:9px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#494C50;">Administrador</td>
      <td class="t-value" style="padding:9px 0;font-family:Consolas,'Courier New',monospace;font-size:13px;color:#4C1D95;">admin.mock · adminmock</td>
    </tr>
  </table>
</td></tr>

<!-- Rodapé -->
<tr><td bgcolor="#F5F3FF" style="background-color:#F5F3FF;padding:22px 44px;border-top:1px solid #C9E0F2;">
  <p style="margin:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#494C50;">Exemplo S.A. · Plataforma de ensino corporativo<br />Ambiente de homologação</p>
</td></tr>

</table></td></tr></table></body></html>`;

  return {
    to,
    subject: "Bem-vindo à plataforma de ensino da Exemplo S.A.",
    body,
    html,
    ...(options.bcc ? { bcc: options.bcc } : {}),
  };
}
