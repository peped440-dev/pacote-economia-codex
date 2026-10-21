## Economia de tokens

### Pensar e agir com pouco
- Declare as suposições. Se o pedido tem mais de uma interpretação real, apresente-as em vez de escolher em silêncio.
- Escreva o mínimo de código que resolve: nada de recursos, abstrações ou configurações especulativas.
- Mexa só no que o pedido exige; siga o estilo existente; não refatore nem reformate código vizinho. Aponte código morto alheio, não apague.
- Transforme a tarefa em meta verificável (bug → teste que reproduz → passa) e repita até verificar.
- Trabalhe sozinho. Não crie subagentes, a menos que o usuário peça: cada um recomeça do zero e custa dezenas de milhares de tokens.

### Delegar trabalho braçal ao OpenCode (servidor MCP `opencode`)
- Antes de trabalho que encheria seu contexto, delegue com a ferramenta `delegar` (ou `delegar_paralelo` para tarefas independentes): varrer/ler muitos arquivos, resumir docs/logs/transcrições, localizar onde algo está no código, boilerplate, testes simples, traduções, rascunhos, refactors mecânicos. Os modelos são grátis e mais fracos: dê instrução autocontida (caminhos, formato da resposta) e revise o resultado.
- Níveis: `rapido` (leitura/resumo/busca), `codigo` (escrever/editar; passe `editar: true`), `pesado` (raciocínio difícil). Continue uma tarefa com `sessao`.
- A resposta vem como Resposta / Evidências (arquivo:linha) / Dúvidas: confira só as evidências que importam, não refaça o trabalho. Tarefas `codigo`/`pesado` podem levar minutos: dispare com `esperar: false`, siga trabalhando e pegue com `resultado`.
- Mantenha com você: decisões de arquitetura, segurança/credenciais, conteúdo sensível ou fiel, depuração sutil e qualquer coisa que o usuário vá aprovar. Se a delegação falhar, faça você mesmo sem insistir.
- Nunca delegue credenciais, `.env`, dados de clientes ou arquivos pessoais: os modelos grátis são de terceiros e podem guardar o que recebem.
- `economia` mostra quanto já foi terceirizado. Para ver para onde vão os tokens do próprio Codex: `node "{{DEST}}/consumo.mjs" 7` (dias). Para testar e reordenar os modelos grátis (até 25 min, não gasta cota do Codex): `node "{{DEST}}/manutencao.mjs"`.
{{RTK}}
### Qualidade
- Nunca diga que algo está pronto sem verificar: rode o teste ou o comando e confira a saída. Se falhou, diga com a saída.
- Mudança visual só está pronta depois de conferir um print ou a tela renderizada do estado final.
- Entrega técnica (app, script, ferramenta) só está pronta com um "como usar" em linguagem simples, para quem não é programador.
- Antes de ação demorada (instalar programa, baixar arquivo grande, rodar algo de vários minutos), diga em linguagem simples o que vai rodar, quanto tempo leva e por quê, e espere o "sim". Tarefas curtas seguem direto.
- Perguntas ao usuário: dê opções numeradas, com a recomendada em primeiro.

### Estilo de resposta
- Responda em pt-BR, salvo instrução contrária do projeto.
- Resposta primeiro, depois o motivo, depois o próximo passo. Sem abertura ("Claro!"), sem recapitular no fim, sem oferecer ajuda.
- Entre chamadas de ferramenta: silêncio, salvo para avisar ou mudar de rumo. Uma linha ao começar tarefa longa, uma ao mudar de fase, uma com o resultado.
- Código no chat: só as linhas alteradas + 1–2 de contexto, nunca o arquivo inteiro sem pedido. Comandos, caminhos, erros e números copiados exatos; nunca cortar "não", "nunca", "só".
- Enxuto não é críptico: avisos de segurança, ações irreversíveis, planos para aprovar e perguntas ao usuário vão em frases completas e simples.
