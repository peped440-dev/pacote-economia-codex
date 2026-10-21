// Instalador do pacote de economia de tokens para o Codex CLI.
//   node instalar.mjs                    instala (pode rodar de novo: atualiza sem duplicar)
//   node instalar.mjs --remover          tira as configurações do Codex (a pasta do servidor fica)
//   node instalar.mjs --codex-home DIR   usa outra pasta no lugar de ~/.codex (para testar)
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

process.noDeprecation = true; // npm.cmd no Windows exige shell:true; o aviso do Node é só ruído aqui
const AQUI = import.meta.dirname;
const WIN = process.platform === "win32";
const args = process.argv.slice(2);
const remover = args.includes("--remover");
const iHome = args.indexOf("--codex-home");
const CODEX_HOME = resolve(iHome >= 0 ? args[iHome + 1] : process.env.CODEX_HOME || join(homedir(), ".codex"));
const DEST = join(CODEX_HOME, "mcp", "opencode-delegate");
const CONFIG = join(CODEX_HOME, "config.toml");
const AGENTS = join(CODEX_HOME, "AGENTS.md");

const avisos = [];
const ok = (m) => console.log(`  ✔ ${m}`);
const aviso = (m) => { avisos.push(m); console.log(`  ! ${m}`); };
const sh = (cmd, a, opt = {}) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: WIN && /^npm/.test(cmd), windowsHide: true, ...opt });
const tenta = (cmd, a, opt) => { try { return sh(cmd, a, opt).trim(); } catch { return null; } };
const lerOuVazio = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const backupUmaVez = (f) => { if (existsSync(f) && !existsSync(f + ".bak-economia")) copyFileSync(f, f + ".bak-economia"); };

// Bloco gerenciado: tudo entre as duas marcas é nosso e é reescrito a cada instalação.
const comentar = (tipo, s) => (tipo === "#" ? `# ${s}` : `<!-- ${s} -->`);
const marcas = (id, tipo) => [comentar(tipo, `>>> economia-codex:${id} (gerenciado pelo instalador; não edite aqui dentro)`), comentar(tipo, `<<< economia-codex:${id}`)];
function tirarBloco(texto, id, comentario) {
  const [ini, fim] = marcas(id, comentario);
  const a = texto.indexOf(ini), b = texto.indexOf(fim);
  if (a < 0 || b < a) return texto;
  return (texto.slice(0, a).trimEnd() + "\n\n" + texto.slice(b + fim.length).trimStart()).trim() + "\n";
}
// Chaves soltas do TOML precisam vir antes de qualquer [tabela], então este bloco vai no topo do arquivo.
function porBlocoNoTopo(texto, id, corpo) {
  const [ini, fim] = marcas(id, "#");
  const base = tirarBloco(texto, id, "#").trim();
  return corpo ? `${ini}\n${corpo.trim()}\n${fim}\n${base ? "\n" + base + "\n" : ""}` : base + "\n";
}
function porBloco(texto, id, comentario, corpo) {
  const [ini, fim] = marcas(id, comentario);
  const base = tirarBloco(texto, id, comentario).trim();
  return (base ? base + "\n\n" : "") + `${ini}\n${corpo.trim()}\n${fim}\n`;
}
const toml = (s) => (/['\n\r]/.test(s) ? JSON.stringify(s) : `'${s}'`);

console.log(`\nPacote de economia de tokens para o Codex — ${remover ? "REMOVER" : "INSTALAR"}\nPasta do Codex: ${CODEX_HOME}\n`);

if (remover) {
  for (const [f, id, c] of [[CONFIG, "topo", "#"], [CONFIG, "mcp", "#"], [AGENTS, "agents", "<!--"]]) {
    if (!existsSync(f)) continue;
    writeFileSync(f, tirarBloco(lerOuVazio(f), id, c));
    ok(`Bloco ${id} removido de ${f}`);
  }
  if (tenta("rtk", ["init", "-g", "--codex", "--uninstall"], { env: { ...process.env, CODEX_HOME } }) !== null) ok("Integração do rtk com o Codex removida");
  console.log(`\nPronto. A pasta ${DEST} pode ser apagada à mão se quiser (guarda só o servidor e o histórico de uso).\n`);
  process.exit(0);
}

// ---------- 1. pré-requisitos ----------
console.log("1/7 Conferindo o que já existe");
const nodeMaior = Number(process.versions.node.split(".")[0]);
if (nodeMaior < 20) { console.error(`  ✘ Node ${process.versions.node} é antigo. Instale o Node 20 ou mais novo (nodejs.org) e rode de novo.`); process.exit(1); }
ok(`Node ${process.versions.node}`);

let exe = null;
if (WIN) {
  const raiz = tenta("npm", ["root", "-g"]);
  const npmExe = raiz && join(raiz, "@opencode", "cli", "bin", "opencode.exe");
  if (npmExe && existsSync(npmExe)) exe = npmExe;
  else { const w = tenta("where", ["opencode"]); const exes = w ? w.split(/\r?\n/).filter((l) => /\.exe$/i.test(l)) : []; exe = exes[0] || null; }
} else exe = tenta("which", ["opencode"]);
const versaoOpencode = exe && tenta(exe, ["--version"]);
if (versaoOpencode) ok(`OpenCode ${versaoOpencode} (${exe})`);
else aviso("OpenCode não encontrado. Instale com `npm i -g @opencode/cli` e rode este instalador de novo — sem ele a delegação não funciona.");

const rtkOk = tenta("rtk", ["gain"]) !== null;
if (rtkOk) ok(`rtk ${tenta("rtk", ["--version"]) || ""}`.trim());
else aviso("rtk não encontrado (ou é outro programa com o mesmo nome). Sem ele a saída dos comandos não é compactada; a delegação funciona igual. Instale com `winget install rtk-ai.rtk` (Windows) ou `brew install rtk` (Mac) e rode este instalador de novo.");

// ---------- 2. servidor ----------
console.log("\n2/7 Copiando o servidor de delegação, a manutenção e o medidor de consumo");
mkdirSync(DEST, { recursive: true });
const ORIGEM = join(AQUI, "arquivos", "opencode-delegate");
for (const f of ["server.mjs", "package.json", "teste.mjs", "manutencao.mjs", "consumo.mjs"]) copyFileSync(join(ORIGEM, f), join(DEST, f));
cpSync(join(ORIGEM, "bancada"), join(DEST, "bancada"), { recursive: true });
ok(DEST);

// ---------- 3. dependências ----------
console.log("\n3/7 Instalando dependências do servidor (precisa de internet)");
try { sh("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: DEST }); ok("npm install"); }
catch (e) { console.error(`  ✘ npm install falhou: ${String(e.stderr || e.message).trim().split("\n").pop()}`); process.exit(1); }

// ---------- 4. modelos ----------
console.log("\n4/7 Escolhendo os modelos disponíveis nesta máquina");
const NIVEIS = join(DEST, "niveis.json");
if (existsSync(NIVEIS)) ok("niveis.json já existe — mantido como está");
else {
  const padrao = JSON.parse(readFileSync(join(AQUI, "arquivos", "opencode-delegate", "niveis.json"), "utf8"));
  const lista = exe && versaoOpencode ? (tenta(exe, ["models"]) || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  if (!lista.length) { writeFileSync(NIVEIS, JSON.stringify(padrao, null, 2)); aviso("Não consegui listar os modelos; usei a lista padrão. Se algum não existir aqui, o servidor pula para o próximo sozinho."); }
  else {
    const gratis = lista.filter((m) => m.startsWith("opencode/") && /free|pickle/.test(m));
    const novo = {};
    for (const [nivel, ms] of Object.entries(padrao)) {
      const vivos = ms.filter((m) => lista.includes(m));
      novo[nivel] = vivos.length ? vivos : gratis.slice(0, 3);
      if (!novo[nivel].length) novo[nivel] = ms;
    }
    writeFileSync(NIVEIS, JSON.stringify(novo, null, 2));
    const semNvidia = !lista.some((m) => m.startsWith("nvidia/"));
    ok(`${gratis.length} modelos grátis do OpenCode disponíveis`);
    if (semNvidia) aviso("Nenhum modelo NVIDIA disponível (falta a chave). Funciona só com os do OpenCode; para somar os da NVIDIA rode `opencode auth login` e apague niveis.json para regerar.");
  }
}

// ---------- 5. config.toml ----------
console.log("\n5/7 Ajustando o Codex (config.toml)");
mkdirSync(CODEX_HOME, { recursive: true });
backupUmaVez(CONFIG);
// Espelha o Claude Code: esforço médio e sem resumos de raciocínio. Chave que você já definiu não é tocada.
const TOPO = { model_reasoning_effort: '"medium"', model_reasoning_summary: '"none"', hide_agent_reasoning: "true" };
const semTopo = tirarBloco(lerOuVazio(CONFIG), "topo", "#");
const novas = Object.keys(TOPO).filter((k) => !new RegExp(`^\\s*${k}\\s*=`, "m").test(semTopo));
writeFileSync(CONFIG, porBlocoNoTopo(semTopo, "topo", novas.map((k) => `${k} = ${TOPO[k]}`).join("\n")));
for (const k of Object.keys(TOPO)) ok(novas.includes(k) ? `${k} = ${TOPO[k]}` : `${k}: mantido o seu valor`);
const semNosso = tirarBloco(lerOuVazio(CONFIG), "mcp", "#");
if (/^\s*\[mcp_servers\.opencode[\].]/m.test(semNosso)) aviso(`Já existe um [mcp_servers.opencode] seu em ${CONFIG}. Não mexi nele; remova-o à mão para o instalador assumir.`);
else {
  const corpo = [
    "[mcp_servers.opencode]", "command = 'node'", `args = [${toml(join(DEST, "server.mjs").replace(/\\/g, "/"))}]`,
    "startup_timeout_sec = 60", "tool_timeout_sec = 900", // padrão do Codex é 60s; tarefas de código levam minutos
    "default_tools_approval_mode = 'approve'", // sem pedir permissão a cada delegação (sem editar: true, o OpenCode nem escreve)
    ...(exe ? ["", "[mcp_servers.opencode.env]", `OPENCODE_EXE = ${toml(exe.replace(/\\/g, "/"))}`] : []),
  ].join("\n");
  writeFileSync(CONFIG, porBloco(lerOuVazio(CONFIG), "mcp", "#", corpo));
  ok(CONFIG);
}

// ---------- 6. AGENTS.md ----------
console.log("\n6/7 Escrevendo as instruções globais (AGENTS.md)");
backupUmaVez(AGENTS);
const modelo = readFileSync(join(AQUI, "arquivos", "AGENTS-economia.md"), "utf8");
const blocoRtk = rtkOk ? readFileSync(join(AQUI, "arquivos", "bloco-rtk.md"), "utf8") : "";
writeFileSync(AGENTS, porBloco(lerOuVazio(AGENTS), "agents", "<!--", modelo.replace("{{RTK}}", blocoRtk).replaceAll("{{DEST}}", DEST.replace(/\\/g, "/"))));
ok(AGENTS);

// ---------- 7. rtk ----------
console.log("\n7/7 Ligando o rtk ao Codex");
if (!rtkOk) aviso("Pulado: rtk não instalado.");
else {
  // Versões antigas recusam --auto-patch junto com --codex; aí tenta sem.
  const r = tenta("rtk", ["init", "-g", "--codex", "--auto-patch"], { env: { ...process.env, CODEX_HOME } })
    ?? tenta("rtk", ["init", "-g", "--codex"], { env: { ...process.env, CODEX_HOME } });
  r === null ? aviso("`rtk init -g --codex` falhou; o Codex ainda segue a regra do AGENTS.md de prefixar com rtk.") : ok("rtk init -g --codex");
  const maior = Number(((tenta("rtk", ["--version"]) || "").match(/(\d+)\.\d+/) || [])[1]);
  if (maior < 1) aviso("Seu rtk é anterior à 1.0: no Codex ele só funciona por instrução. Atualize (`winget upgrade rtk-ai.rtk` ou `brew upgrade rtk`) e rode de novo para o modo automático.");
}

// ---------- teste ----------
console.log("\nTeste do servidor");
try { console.log("  " + sh("node", ["teste.mjs"], { cwd: DEST, env: { ...process.env, ...(exe ? { OPENCODE_EXE: exe } : {}) } }).trim()); }
catch (e) { aviso(`O servidor não subiu: ${String(e.stderr || e.message).trim().split("\n").slice(-2).join(" ")}`); }

console.log(avisos.length ? `\nTerminou com ${avisos.length} aviso(s) acima.` : "\nTudo certo.");
console.log(`Pasta do servidor (teste, manutenção e consumo): ${DEST}`);
console.log("Feche e abra o Codex para ele ler a nova configuração. Se ele pedir permissão para usar o `opencode`, escolha aprovar sempre.\n");
