// Manutenção semanal do opencode-delegate: testa os modelos com 3 tarefas padrão, descobre modelos grátis novos,
// reordena niveis.json (com cópia da versão anterior) e escreve um relatório curto. Uso: node manutencao.mjs
// Não gasta cota do Claude/Codex: só o OpenCode trabalha aqui.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { rodar, lerSaude, lerNiveis, NIVEIS_ARQ, LOG, EXE } from "./server.mjs";

const DIR = import.meta.dirname;
const BANCADA = join(DIR, "bancada");
const hoje = new Date().toISOString().slice(0, 10);
const sh = (cmd, args) => new Promise((r) => execFile(cmd, args, { windowsHide: true, timeout: 120e3 }, (e, out) => r(e ? "" : String(out).trim())));

// Três tarefas com resposta conhecida (arquivos em bancada/). Cada uma vale 1 ponto.
const TESTES = [
  { nome: "resumo", tarefa: "Leia relatorio.md. Quantas vendas houve na semana e qual foi o produto campeão?",
    ok: (t) => /\b37\b/.test(t) && /garrafa/i.test(t) },
  { nome: "codigo", tarefa: "Em util.js, em que linha começa a função que calcula o frete? Responda o número da linha.",
    ok: (t) => /\b11\b/.test(t) && /calcularFrete/i.test(t) },
  { nome: "json", tarefa: 'Leia pedidos.csv e some o valor dos pedidos de Curitiba. Na seção Resposta coloque só este JSON, preenchido: {"cidade": "Curitiba", "total": <número>}',
    ok: (t) => { const m = t.match(/\{[^{}]*"cidade"[^{}]*\}/); try { return Math.abs(JSON.parse(m[0]).total - 200) < 0.01; } catch { return false; } } },
];

async function avaliar(modelo) {
  let nota = 0; const tempos = [], erros = [];
  for (const t of TESTES) {
    const t0 = Date.now();
    const r = await rodar({ tarefa: t.tarefa, modelo, pasta: BANCADA, editar: false, silencioS: 120 });
    tempos.push(Math.round((Date.now() - t0) / 1000));
    if (r.ok && t.ok(r.texto)) nota++; else erros.push(`${t.nome}: ${r.ok ? "resposta errada" : r.erro}`.slice(0, 100));
  }
  return { modelo, nota, segundos: Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length), erros };
}

async function emLotes(itens, n, fn) {
  const saida = []; for (let i = 0; i < itens.length; i += n) saida.push(...await Promise.all(itens.slice(i, i + n).map(fn)));
  return saida;
}

const niveis = lerNiveis();
const catalogo = new Set((await sh(EXE, ["models"])).split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
const emUso = [...new Set(Object.values(niveis).flat())];
const sumidos = catalogo.size ? emUso.filter((m) => !catalogo.has(m)) : [];
const novos = [...catalogo].filter((m) => m.startsWith("opencode/") && /free|pickle/.test(m) && !emUso.includes(m)).slice(0, 4);

const notas = Object.fromEntries((await emLotes([...emUso.filter((m) => !sumidos.includes(m)), ...novos], 3, avaliar)).map((a) => [a.modelo, a]));

// Reordenação conservadora: tira os sumidos, manda para o fim quem acertou menos de 2 de 3 (mantendo a ordem de
// qualidade entre os bons) e acrescenta no fim do nível rapido os novos que acertaram 3 de 3.
const novo = {};
for (const [nivel, lista] of Object.entries(niveis)) {
  const vivos = lista.filter((m) => !sumidos.includes(m));
  novo[nivel] = [...vivos.filter((m) => notas[m]?.nota >= 2), ...vivos.filter((m) => !(notas[m]?.nota >= 2))];
}
novo.rapido.push(...novos.filter((m) => notas[m]?.nota === 3));
const mudou = JSON.stringify(novo) !== JSON.stringify(niveis);
if (mudou) {
  mkdirSync(join(DIR, "historico"), { recursive: true });
  if (existsSync(NIVEIS_ARQ)) copyFileSync(NIVEIS_ARQ, join(DIR, "historico", `niveis-antes-${hoje}.json`));
  writeFileSync(NIVEIS_ARQ, JSON.stringify(novo, null, 2));
}

const instalada = (await sh(EXE, ["--version"])).replace(/[^\d.]/g, "");
const ultima = process.platform === "win32" // npm é .cmd no Windows
  ? await sh("cmd.exe", ["/d", "/c", "npm", "view", "@opencode/cli", "version"])
  : await sh("npm", ["view", "@opencode/cli", "version"]);

const semana = existsSync(LOG) ? readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => Date.now() - Date.parse(r.quando) < 7 * 864e5) : [];
const economia = Math.round(semana.reduce((s, r) => s + r.lidoChars - r.devolvidoChars, 0) / 4);
const saude = lerSaude();

const pendencias = [
  ...(ultima && instalada && ultima !== instalada ? [`OpenCode tem versão nova (${instalada} → ${ultima}). Atualizar com: npm i -g @opencode/cli`] : []),
  ...(!catalogo.size ? ["Não consegui listar os modelos do OpenCode (sem internet ou OpenCode quebrado)."] : []),
];

const linhas = Object.values(notas).sort((a, b) => b.nota - a.nota || a.segundos - b.segundos)
  .map((a) => `| ${a.modelo}${novos.includes(a.modelo) ? " (novo)" : ""} | ${a.nota}/3 | ${a.segundos}s | ${saude[a.modelo] ? `${saude[a.modelo].ok} ok / ${saude[a.modelo].falhas} falhas` : "-"} | ${a.erros.join("; ") || "-"} |`);
const relatorio = `# Manutenção OpenCode — ${hoje}

**Economia da semana:** ${semana.length} delegações, ~${economia.toLocaleString("pt-BR")} tokens que o Claude/Codex deixaram de ler.

## Teste dos modelos
| Modelo | Acertos | Tempo médio | Uso real (acumulado) | Problemas |
|---|---|---|---|---|
${linhas.join("\n")}

## Mudanças aplicadas
${mudou ? Object.entries(novo).map(([n, l]) => `- ${n}: ${l.join(" → ")}`).join("\n") + `\n- Versão anterior guardada em historico/niveis-antes-${hoje}.json` : "- Nenhuma: a ordem atual continua a melhor."}
${sumidos.length ? `- Saíram (não existem mais no OpenCode): ${sumidos.join(", ")}` : ""}

## Precisa de você
${pendencias.length ? pendencias.map((p) => `- ${p}`).join("\n") : "- Nada. Tudo funcionando."}
`;
mkdirSync(join(DIR, "relatorios"), { recursive: true });
const arq = join(DIR, "relatorios", `${hoje}.md`);
writeFileSync(arq, relatorio);
console.log(relatorio);
console.log(`(salvo em ${arq})`);
