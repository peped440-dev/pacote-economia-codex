# Pacote de Economia de Tokens para o Codex

Faz o Codex gastar bem menos da sua cota sem perder qualidade. É o mesmo sistema que já roda no Claude Code do Pedro, adaptado para o Codex.

## Instalar (uns 10 minutos)

1. **Aceite o convite** do GitHub, que chega por e-mail.
2. **Baixe o pacote:** nesta página, clique no botão verde **Code** → **Download ZIP** e extraia a pasta em Documentos. Quem usa git pode rodar `git clone` no lugar.
3. **Abra o Codex nessa pasta.**
   - Codex app: abra a pasta como projeto.
   - Codex no terminal: entre na pasta e digite `codex`.
4. **Escreva no Codex:** `Instale o pacote de economia seguindo o AGENTS.md`

O próprio Codex conduz o resto: confere o que falta, instala o OpenCode e o rtk, ajuda a pegar a chave grátis da NVIDIA (opcional), roda o instalador, faz um teste e explica cada passo. Você só aprova os pedidos de permissão e responde às perguntas.

> **Nunca cole senha ou chave no chat do Codex.** Quando precisar da chave da NVIDIA, ele vai pedir para você digitá-la num terminal seu.

## O que ele instala

| Peça | O que faz | Economia |
|---|---|---|
| **Delegação ao OpenCode** | O Codex passa o trabalho braçal (ler muitos arquivos, resumir, buscar no código, rascunhos) para modelos grátis e recebe só o resumo. | Grande em tarefas de leitura |
| **rtk** | Encolhe a saída dos comandos antes de ela entrar na conversa. | 60–90% nos comandos |
| **Regras de trabalho** (`~/.codex/AGENTS.md`) | Código mínimo, sem subagentes desnecessários, respostas curtas, verificar antes de dizer "pronto". | Constante, em toda conversa |
| **Ajustes do Codex** (`config.toml`) | Esforço de raciocínio médio, sem resumos de raciocínio. Não mexe no que você já configurou. | Moderada |
| **Medidor de consumo** | Mostra para onde foram seus tokens e quanto da cota foi usado. | Ajuda a decidir |
| **Manutenção semanal** (opcional) | Testa os modelos grátis, descobre novos e reordena a lista. | Mantém a delegação funcionando |

## No dia a dia
Nada muda: use o Codex normalmente. Ele delega sozinho quando faz sentido. Para pedir direto:
- "delega pro opencode: resumir todos os PDFs da pasta contratos"
- "quanto o opencode já economizou?"
- "mostre meu consumo da semana"
- "faça a manutenção do opencode"

Dica que mais economiza: **comece uma conversa nova a cada assunto diferente**. Conversa longa relê todo o histórico a cada mensagem.

## Atualizar ou remover
- **Atualizar:** baixe de novo (ou `git pull`) e peça ao Codex "atualize o pacote de economia".
- **Remover:** peça ao Codex "remova o pacote de economia" ou rode `node instalar.mjs --remover`. Na primeira instalação ficam cópias de segurança `config.toml.bak-economia` e `AGENTS.md.bak-economia`.

## Instalação manual (sem o Codex guiar)
Precisa de Node 20+, OpenCode (`npm i -g @opencode/cli`) e, de preferência, rtk. Depois:
- Windows: dois cliques em `instalar.cmd`
- Mac/Linux: `sh instalar.sh`
