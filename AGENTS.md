# Instalação guiada do Pacote de Economia (instruções para o Codex)

Você está na pasta do **Pacote de Economia de Tokens para o Codex**. Quando a pessoa pedir para instalar, atualizar ou conferir o pacote, conduza o processo abaixo do começo ao fim.

## Como conduzir
- A pessoa não é programadora. Fale em pt-BR simples, uma etapa por vez, e diga em uma frase o que cada etapa faz e por quê.
- Antes de instalar qualquer programa, diga o que vai instalar e quanto tempo leva, e espere o "sim". Para perguntas, dê opções numeradas com a recomendada em primeiro.
- Comandos que instalam programas ou escrevem fora desta pasta (em `~/.codex`) precisam da aprovação dela no Codex. Avise antes: "vai aparecer um pedido de permissão; pode aprovar".
- **Nunca peça chave, senha ou token no chat** e nunca rode um comando que receba uma chave. Quando precisar de uma, ela digita sozinha num terminal dela, fora do Codex.
- Não edite os arquivos desta pasta. Se algo falhar, mostre o erro em uma frase simples e proponha o próximo passo. Não insista mais de duas vezes no mesmo caminho.
- Confira cada etapa com o comando de verificação antes de passar para a próxima.

## Etapas

### 1. Sistema
Descubra se é Windows, macOS ou Linux. No Windows use PowerShell.

### 2. Node.js 20 ou mais novo
Verifique: `node -v`.
Se faltar ou for antigo:
- Windows: `winget install OpenJS.NodeJS.LTS`
- macOS: `brew install node`. Sem Homebrew, peça para ela baixar o instalador "LTS" em https://nodejs.org e instalar com dois cliques.
- Linux: use o gerenciador de pacotes da distribuição.
No Windows, um programa recém-instalado só aparece num terminal novo. Se `node -v` ainda falhar, peça para ela fechar e abrir o Codex e pedir "continue a instalação do pacote".

### 3. OpenCode (faz o trabalho braçal com modelos grátis)
Verifique: `opencode --version`.
Se faltar: `npm i -g @opencode/cli`. Verifique de novo.

### 4. rtk (encolhe a saída dos comandos)
Verifique: `rtk gain`. Se der "command not found" ou outro erro, ou não existe ou é outro programa de mesmo nome.
Se faltar:
- Windows: `winget install rtk-ai.rtk`
- macOS: `brew install rtk`
- Linux: `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`
Confirme com `rtk --version`. A 1.0 ou mais nova liga sozinha ao Codex. Se for mais velha, atualize com `winget upgrade rtk-ai.rtk` ou `brew upgrade rtk`.

### 5. Chave grátis da NVIDIA (opcional, recomendado)
Explique: sem chave, o OpenCode usa só os modelos grátis dele. Com a chave, ganha modelos mais fortes, também grátis (Kimi, GLM, DeepSeek). Pergunte se ela quer fazer agora.
Se sim, guie:
1. Entrar em https://build.nvidia.com, criar a conta e gerar uma API key ("Get API Key").
2. Abrir um terminal dela, fora do Codex: no Windows, menu Iniciar → "Terminal".
3. Digitar `opencode auth login`, escolher **NVIDIA** e colar a chave.
4. Avisar quando terminar. Você confere com `opencode auth list`, que mostra só o nome do provedor e nunca a chave.

### 6. Rodar o instalador
Nesta pasta: `node instalar.mjs`. Leva de 1 a 3 minutos e precisa de internet.
Leia a saída. Cada linha `!` é um aviso: explique e resolva o que der. Se for falta de programa, volte à etapa correspondente e rode o instalador de novo, o que é seguro.

### 7. Teste de verdade
`node "<pasta mostrada pelo instalador>/teste.mjs" --completo`. Leva até 2 minutos e usa um modelo grátis.
Tem que aparecer uma resposta com as seções "Resposta / Evidências / Dúvidas" e uma linha `[opencode] modelo: ...`.

### 8. Superpowers (opcional, melhora a qualidade)
É um conjunto de métodos de trabalho (planejar, testar, depurar) para o Codex. Você não consegue instalar sozinho. Explique como ela faz:
- Codex no terminal: digitar `/plugins`, buscar `superpowers` e instalar.
- Codex app: clicar em "Plugins" na barra lateral e no `+` ao lado de Superpowers.

### 9. Manutenção semanal automática (opcional)
Explique: uma vez por semana, um script testa os modelos grátis, descobre novos e reordena a lista. Roda sozinho, leva até 25 minutos e não gasta a cota do Codex. Pergunte se ela quer agendar.
Se sim, use o caminho real da pasta mostrada pelo instalador:
- Windows: `schtasks /Create /F /SC WEEKLY /D MON /ST 10:00 /TN "Economia Codex - manutencao" /TR "cmd /c cd /d \"<pasta>\" && node manutencao.mjs"`
- macOS/Linux: acrescente ao `crontab -e` a linha `0 10 * * 1 cd "<pasta>" && "$(command -v node)" manutencao.mjs >/dev/null 2>&1`, com o caminho do node já resolvido.
Os relatórios ficam em `<pasta>/relatorios/`.

### 10. Encerrar
- Peça para ela **fechar e abrir o Codex**, para ele ler a nova configuração.
- Resuma em até 6 linhas o que ficou instalado, o que ficou de fora e por quê, e como pedir as coisas no dia a dia:
  - "quanto o opencode já economizou?"
  - "mostre meu consumo da semana"
  - "faça a manutenção do opencode"

## Atualizar mais tarde
Baixe a versão nova do pacote (`git pull` nesta pasta, ou baixe o ZIP de novo) e rode `node instalar.mjs`. Nada é duplicado.

## Remover
`node instalar.mjs --remover`. Tira só o que o pacote colocou no `config.toml` e no `AGENTS.md` do Codex. Se agendou a manutenção, apague a tarefa:
- Windows: `schtasks /Delete /TN "Economia Codex - manutencao" /F`
- macOS/Linux: remova a linha do `crontab -e`.
