// Funções auxiliares da loja
function formatarPreco(valor) {
  return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

function aplicarCupom(total, cupom) {
  if (cupom === 'BEMVINDO') return total * 0.9;
  return total;
}

function calcularFrete(cep, peso) {
  const base = cep.startsWith('0') ? 12 : 18;
  return base + peso * 2.5;
}

module.exports = { formatarPreco, aplicarCupom, calcularFrete };
