// Mostra para onde vão os tokens do Codex, lendo os históricos locais em ~/.codex/sessions.
// Uso: node consumo.mjs [dias]   (padrão: 7 dias; 0 = tudo)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const dias = Number(process.argv[2] ?? 7);
const desde = dias > 0 ? Date.now() - dias * 864e5 : 0;
const raiz = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "sessions");

function* jsonls(dir) {
  let itens; try { itens = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const i of itens) {
    const p = join(dir, i.name);
    if (i.isDirectory()) yield* jsonls(p);
    else if (i.name.endsWith(".jsonl") && statSync(p).mtimeMs >= desde) yield p;
  }
}

// Cada sessão registra o uso acumulado em eventos "token_count"; vale o último.
const sessoes = [];
let limite = null;
for (const arq of jsonls(raiz)) {
  const s = { pasta: "?", arquivo: basename(arq), uso: null, quando: statSync(arq).mtime };
  for (const linha of readFileSync(arq, "utf8").split("\n")) {
    if (!linha.includes('"session_meta"') && !linha.includes('"token_count"')) continue;
    let j; try { j = JSON.parse(linha); } catch { continue; }
    const p = j.payload || {};
    if (j.type === "session_meta") { s.pasta = p.cwd || s.pasta; s.quando = new Date(p.timestamp || j.timestamp || s.quando); }
    if (p.type === "token_count") {
      if (p.info?.total_token_usage) s.uso = p.info.total_token_usage;
      if (p.rate_limits && !(limite?.quando > j.timestamp)) limite = { ...p.rate_limits, quando: j.timestamp }; // o mais recente
    }
  }
  if (s.uso && s.quando >= desde) sessoes.push(s); // a data do arquivo pode mudar em migrações; vale a da sessão
}

if (!sessoes.length) { console.log(`Nenhuma sessão com uso registrado em ${raiz} nos últimos ${dias || "todos os"} dias.`); process.exit(0); }

const n = (x) => Math.round(x || 0).toLocaleString("pt-BR");
const total = { entrada: 0, cache: 0, saida: 0, raciocinio: 0 };
for (const { uso } of sessoes) {
  total.entrada += uso.input_tokens || 0; total.cache += uso.cached_input_tokens || 0;
  total.saida += uso.output_tokens || 0; total.raciocinio += uso.reasoning_output_tokens || 0;
}
const pctCache = total.entrada ? Math.round((100 * total.cache) / total.entrada) : 0;

console.log(`Codex — ${sessoes.length} sessões (${dias ? `últimos ${dias} dias` : "tudo"})\n`);
console.log(`Entrada:   ${n(total.entrada)} tokens (${pctCache}% reaproveitado do cache, que custa bem menos)`);
console.log(`Saída:     ${n(total.saida)} tokens (dos quais ${n(total.raciocinio)} de raciocínio)`);
if (limite?.primary) console.log(`Cota:      ${limite.primary.used_percent}% usada na janela atual${limite.secondary ? `; ${limite.secondary.used_percent}% na semanal` : ""}`);

console.log("\nSessões mais pesadas:");
for (const s of sessoes.sort((a, b) => (b.uso.total_tokens || 0) - (a.uso.total_tokens || 0)).slice(0, 5))
  console.log(`- ${n(s.uso.total_tokens)} tokens | ${s.quando.toLocaleDateString("pt-BR")} | ${s.pasta}`);
console.log("\nDica: sessão longa relê todo o histórico a cada mensagem. Comece uma nova a cada assunto diferente e delegue leituras grandes ao OpenCode.");
