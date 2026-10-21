// MCP "opencode-delegate": deixa o Claude Code ou o Codex terceirizar trabalho braçal para o OpenCode
// (modelos grátis NVIDIA/OpenCode Zen) e recebe de volta só o resumo — economizando tokens.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn, execFile } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// OPENCODE_EXE (definido pelo instalador) > binário do npm no Windows > "opencode" no PATH.
const EXE_NPM_WIN = join(process.env.APPDATA || "", "npm", "node_modules", "@opencode", "cli", "bin", "opencode.exe");
const EXE = process.env.OPENCODE_EXE || (existsSync(EXE_NPM_WIN) ? EXE_NPM_WIN : "opencode");
const LOG = join(import.meta.dirname, "uso.jsonl");
const SAUDE = join(import.meta.dirname, "saude.json");

// Ordem = preferência por qualidade. Modelos em quarentena são pulados; se um trava/falha, cai pro próximo.
// Fica em niveis.json (relido a cada tarefa) para a manutenção semanal reordenar sem reiniciar o servidor.
const NIVEIS_ARQ = join(import.meta.dirname, "niveis.json");
const NIVEIS_PADRAO = {
  rapido: ["nvidia/deepseek-ai/deepseek-v4.1-flash", "opencode/big-pickle", "opencode/mimo-v2.6-flash-free", "nvidia/z-ai/glm-5.3"],
  codigo: ["nvidia/moonshotai/kimi-k3", "opencode/big-pickle", "nvidia/z-ai/glm-5.3"],
  pesado: ["nvidia/moonshotai/kimi-k3", "nvidia/z-ai/glm-5.3", "opencode/big-pickle"],
};
const lerNiveis = () => { try { return { ...NIVEIS_PADRAO, ...JSON.parse(readFileSync(NIVEIS_ARQ, "utf8")) }; } catch { return NIVEIS_PADRAO; } };
// Segundos sem nenhum sinal do modelo até considerá-lo travado. O OpenCode só emite eventos ao fim de
// cada passo, então tarefas de escrita longa precisam de mais folga.
const SILENCIO = { rapido: 60, codigo: 150, pesado: 180 };
const SILENCIO_MODELO = { "nvidia/deepseek-ai/deepseek-v4.1-flash": 45 }; // fila grátis instável: tenta rápido e desiste rápido
const EDIT_TOOLS = new Set(["edit", "write", "patch", "multiedit", "apply_patch"]);

// ---------- memória de saúde: quarentena com espera crescente (5 min, 10, 20… até 6 h) ----------
const lerSaude = () => { try { return JSON.parse(readFileSync(SAUDE, "utf8")); } catch { return {}; } };
function marcar(modelo, ok, segundos) {
  const s = lerSaude(), m = (s[modelo] ||= { ok: 0, falhas: 0, seguidas: 0, ate: 0 });
  if (ok) { m.ok++; m.seguidas = 0; m.ate = 0; m.ultimoTempo = segundos; }
  else { m.falhas++; m.seguidas++; m.ate = Date.now() + Math.min(5 * 60e3 * 2 ** (m.seguidas - 1), 6 * 3600e3); }
  try { writeFileSync(SAUDE, JSON.stringify(s, null, 1)); } catch {}
}
function ordenar(cadeia) {
  const s = lerSaude(), agora = Date.now();
  const livres = cadeia.filter((m) => !(s[m]?.ate > agora));
  return livres.length ? livres : cadeia; // tudo em quarentena: tenta mesmo assim
}

// ---------- contrato de resposta: formato que o Claude consegue conferir barato ----------
const CONTRATO = `Formato OBRIGATÓRIO da resposta final (em português, objetiva, sem colar arquivos inteiros):
## Resposta
O resultado em si.
## Evidências
- caminho/do/arquivo:linha — o que ali confirma a resposta (só o que você realmente leu)
## Dúvidas
- O que você não verificou, suposições feitas ou pontos que podem estar errados ("nenhuma" se for o caso).`;

function rodar({ tarefa, modelo, pasta, editar, arquivos, sessao, silencioS }) {
  const regra = editar
    ? "Você pode criar/editar arquivos. Inclua em Evidências cada arquivo que alterou e o que mudou."
    : "Apenas leia e responda; não altere nada.";
  const prompt = `${tarefa}\n\n---\n${regra}\nQuem lê sua resposta não vê seu processo, só a resposta final.\n${CONTRATO}`;
  // Sem edição usa o agente "plan" do OpenCode, que bloqueia escrita de verdade.
  const args = ["run", "--auto", "--format", "json", "-m", modelo, "--agent", editar ? "build" : "plan"];
  if (sessao) args.push("-s", sessao);
  for (const f of arquivos || []) args.push("-f", f);
  args.push(prompt);

  return new Promise((resolve) => {
    const p = spawn(EXE, args, { cwd: pasta, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "", err = "", travou = false, vigia;
    const st = { textos: [], editados: new Set(), ferramentas: 0, lidoChars: 0, sessao: sessao || null };
    const rearmar = () => { clearTimeout(vigia); vigia = setTimeout(() => { travou = true; p.kill(); }, silencioS * 1000); };
    const linha = (l) => {
      let ev; try { ev = JSON.parse(l); } catch { return; }
      st.sessao ||= ev.sessionID;
      const part = ev.part || {};
      if (part.type === "text" && part.text) st.textos.push(part.text);
      if (part.type === "tool") {
        st.ferramentas++;
        const out = part.state?.output;
        if (typeof out === "string") st.lidoChars += out.length;
        const inp = part.state?.input || {};
        if (EDIT_TOOLS.has(part.tool)) st.editados.add(inp.filePath || inp.path || inp.file || "?");
      }
    };
    rearmar();
    p.stdout.on("data", (d) => { rearmar(); buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { linha(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => {
      clearTimeout(vigia); if (buf) linha(buf);
      const texto = st.textos.join("\n").trim();
      const erro = texto ? "" : travou ? `travou (${silencioS}s sem resposta)` : (err.trim().split("\n").pop() || `saiu com código ${code}`);
      resolve({ ok: !!texto, texto, ...st, editados: [...st.editados], erro });
    });
    p.on("error", (e) => { clearTimeout(vigia); resolve({ ok: false, erro: String(e), textos: [], editados: [] }); });
  });
}

// Tokens reais gastos pelo OpenCode (desconta o que a sessão já tinha, quando é continuação).
function tokensDaSessao(id) {
  return new Promise((res) => execFile(EXE, ["session", "export", id], { windowsHide: true, maxBuffer: 64e6, timeout: 30e3 }, (e, out) => {
    try { const t = JSON.parse(out).info.tokens; res(t.input + t.output + (t.reasoning || 0) + (t.cache?.read || 0)); } catch { res(null); }
  }));
}
const tokensAntes = (id) => {
  if (!id || !existsSync(LOG)) return 0;
  const regs = readFileSync(LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.sessao === id);
  return regs.length ? regs.at(-1).tokensSessao || 0 : 0;
};

async function delegar(a) {
  if (!existsSync(a.pasta)) return `[opencode] Pasta não encontrada: ${a.pasta}`;
  const nivel = a.nivel || "rapido";
  const cadeia = a.modelo ? [a.modelo] : ordenar(lerNiveis()[nivel]);
  const t0 = Date.now(), falhas = [];
  for (const modelo of cadeia) {
    const t1 = Date.now();
    const r = await rodar({ ...a, modelo, silencioS: a.silencio_s || SILENCIO_MODELO[modelo] || SILENCIO[nivel] });
    const seg = Math.round((Date.now() - t1) / 1000);
    marcar(modelo, r.ok, seg);
    if (!r.ok) { falhas.push(`${modelo}: ${r.erro.slice(0, 120)}`); continue; }

    let texto = r.texto;
    const max = a.max_chars || 6000;
    if (texto.length > max) texto = texto.slice(0, max) + `\n…[cortado: ${r.texto.length} chars no total; peça para continuar com sessao=${r.sessao}]`;
    const tokensSessao = r.sessao ? await tokensDaSessao(r.sessao) : null;
    const reg = { quando: new Date().toISOString(), modelo, nivel, sessao: r.sessao, segundos: Math.round((Date.now() - t0) / 1000),
      ferramentas: r.ferramentas, lidoChars: r.lidoChars, devolvidoChars: texto.length, editados: r.editados.length,
      tokensOpencode: tokensSessao == null ? null : tokensSessao - tokensAntes(r.sessao), tokensSessao };
    try { appendFileSync(LOG, JSON.stringify(reg) + "\n"); } catch {}
    const rodape = [`modelo: ${modelo}`, `sessao: ${r.sessao}`, `${reg.segundos}s`, `${r.ferramentas} ações`,
      r.editados.length ? `arquivos alterados: ${r.editados.join(", ")}` : "nenhum arquivo alterado",
      falhas.length ? `pulados: ${falhas.join("; ")}` : ""].filter(Boolean).join(" | ");
    return `${texto}\n\n[opencode] ${rodape}`;
  }
  return `[opencode] Todos os modelos falharam: ${falhas.join("; ")}. Faça a tarefa você mesmo.`;
}

// ---------- tarefas em segundo plano ----------
const jobs = new Map();
function disparar(a) {
  const id = randomUUID().slice(0, 8), j = { status: "rodando", inicio: Date.now(), tarefa: a.tarefa.slice(0, 80) };
  j.promessa = delegar(a).then((r) => { j.status = "pronto"; j.resultado = r; return r; });
  jobs.set(id, j);
  return id;
}

const server = new McpServer({ name: "opencode-delegate", version: "2.0.0" });

const campos = {
  tarefa: z.string().describe("Instrução completa e autocontida. O OpenCode não vê esta conversa: inclua caminhos, contexto e o que exatamente deve voltar."),
  pasta: z.string().describe("Pasta de trabalho absoluta onde o OpenCode vai atuar."),
  nivel: z.enum(["rapido", "codigo", "pesado"]).optional().describe("rapido: buscas, resumos, leitura de muitos arquivos. codigo: escrever/editar código. pesado: raciocínio difícil. Padrão: rapido."),
  editar: z.boolean().optional().describe("true permite criar/editar arquivos. Padrão false (só leitura, bloqueado de verdade)."),
  arquivos: z.array(z.string()).optional().describe("Arquivos para anexar à mensagem."),
  sessao: z.string().optional().describe("ID de sessão anterior para continuar a conversa (aparece no rodapé)."),
  modelo: z.string().optional().describe("Força um modelo específico (provider/model), ignorando o nível."),
  max_chars: z.number().optional().describe("Tamanho máximo da resposta devolvida. Padrão 6000."),
  silencio_s: z.number().optional().describe("Segundos sem sinal do modelo até desistir dele e passar ao próximo. Padrão por nível (60/150/180)."),
};
const txt = (text) => ({ content: [{ type: "text", text }] });

server.tool("delegar",
  "Terceiriza uma tarefa para o OpenCode (modelos gratuitos) e devolve só a resposta final no formato Resposta / Evidências (arquivo:linha) / Dúvidas. Use para trabalho que consumiria muitos tokens mas não exige seu julgamento: varrer/ler muitos arquivos, resumir docs/logs, localizar código, gerar boilerplate, testes, traduções, rascunhos, refactors mecânicos. Confira as Evidências citadas em vez de refazer o trabalho — os modelos são mais fracos que você. Com esperar=false volta na hora com um id; pegue o resultado depois com `resultado`.",
  { ...campos, esperar: z.boolean().optional().describe("false = roda em segundo plano e devolve um id imediatamente. Padrão true.") },
  async (a) => {
    if (a.esperar === false) return txt(`[opencode] Tarefa disparada em segundo plano. id: ${disparar(a)} — continue trabalhando e chame \`resultado\` com esse id.`);
    return txt(await delegar(a));
  });

server.tool("resultado",
  "Busca o resultado de uma tarefa disparada com delegar(esperar=false). Espera até `esperar_s` segundos se ainda estiver rodando.",
  { id: z.string(), esperar_s: z.number().optional().describe("Quanto esperar se ainda não terminou. Padrão 0 (só consulta).") },
  async ({ id, esperar_s }) => {
    const j = jobs.get(id);
    if (!j) return txt(`[opencode] id desconhecido: ${id}. Em andamento: ${[...jobs.keys()].join(", ") || "nenhuma"}`);
    if (j.status !== "pronto" && esperar_s) await Promise.race([j.promessa, new Promise((r) => setTimeout(r, esperar_s * 1000))]);
    if (j.status !== "pronto") return txt(`[opencode] ${id} ainda rodando há ${Math.round((Date.now() - j.inicio) / 1000)}s ("${j.tarefa}").`);
    jobs.delete(id);
    return txt(j.resultado);
  });

server.tool("delegar_paralelo",
  "Roda várias tarefas independentes no OpenCode ao mesmo tempo e devolve as respostas juntas. Ideal para analisar várias pastas/arquivos em paralelo.",
  { tarefas: z.array(z.object(campos)).min(1).max(6) },
  async ({ tarefas }) => {
    const rs = await Promise.all(tarefas.map(delegar));
    return txt(rs.map((r, i) => `### Tarefa ${i + 1}\n${r}`).join("\n\n"));
  });

server.tool("economia", "Mostra quanto trabalho já foi terceirizado ao OpenCode, tokens reais gastos lá (grátis) e a saúde de cada modelo.", {}, async () => {
  const regs = existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const soma = (k) => regs.reduce((s, r) => s + (r[k] || 0), 0);
  const porModelo = {}; for (const r of regs) porModelo[r.modelo] = (porModelo[r.modelo] || 0) + 1;
  const s = lerSaude(), agora = Date.now();
  const saude = Object.entries(s).map(([m, v]) => `- ${m}: ${v.ok} ok / ${v.falhas} falhas${v.ate > agora ? ` — em quarentena por mais ${Math.ceil((v.ate - agora) / 60e3)} min` : ""}`).join("\n");
  return txt(`Delegações: ${regs.length}
Tokens gastos no OpenCode (grátis, medidos): ${soma("tokensOpencode")}
Conteúdo que o agente (Claude/Codex) deixou de ler: ~${Math.round(soma("lidoChars") / 4)} tokens
Devolvido ao agente: ~${Math.round(soma("devolvidoChars") / 4)} tokens
Uso por modelo: ${JSON.stringify(porModelo)}
Saúde dos modelos:\n${saude || "- sem dados ainda"}`);
});

// Importado pela manutenção (manutencao.mjs) só para reaproveitar rodar(); como servidor, liga o MCP.
export { rodar, lerSaude, lerNiveis, NIVEIS_ARQ, LOG, EXE };
if (process.argv[1] && import.meta.filename.toLowerCase() === process.argv[1].toLowerCase()) {
  await server.connect(new StdioServerTransport());
}
