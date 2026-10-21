// Teste do servidor. Uso:
//   node teste.mjs            -> só confere que as 4 ferramentas aparecem (não gasta nada)
//   node teste.mjs --completo -> também faz uma delegação de verdade ao OpenCode (modelo grátis)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const c = new Client({ name: "teste", version: "1" });
await c.connect(new StdioClientTransport({ command: "node", args: [import.meta.dirname + "/server.mjs"], env: process.env }));
const nomes = (await c.listTools()).tools.map((t) => t.name).sort();
const esperado = ["delegar", "delegar_paralelo", "economia", "resultado"];
if (JSON.stringify(nomes) !== JSON.stringify(esperado)) { console.error("FALHOU: ferramentas =", nomes); process.exit(1); }
console.log("OK: servidor sobe e expõe", nomes.join(", "));

if (process.argv.includes("--completo")) {
  const r = await c.callTool({ name: "delegar", arguments: {
    tarefa: "Liste os nomes dos arquivos desta pasta e diga quantos são.", pasta: import.meta.dirname } }, undefined, { timeout: 600000 });
  console.log(r.content[0].text);
}
await c.close();
