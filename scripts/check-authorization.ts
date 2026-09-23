// Verificação do motor de autorização (porte de importar_v2.py).
// Rodar:  npx tsx scripts/check-authorization.ts
import {
  classificarPedido,
  aprovacao,
  norm,
  type DadosDescontos,
} from "../src/lib/orders/authorization/engine";

const dados: DadosDescontos = {
  acordo: { "23591": "5%", "1078": "ACORDO 5% + 3%" },
  nfdPorCod: {
    "22405": [
      { num: "105", valor: 120.5, status: "PENDENTE" },
      { num: "150", valor: 80, status: "DESCONTADO" },
    ],
  },
  nfdPorNum: { "105": [{ num: "105", valor: 120.5, status: "PENDENTE", cod: "22405" }] },
  sellOutPorCod: { "23918": [{ num: "", valor: 300, status: "PENDENTE" }] },
  selosPorCod: {},
  ccSaldo: { "24831": 250.75 },
  campanhas: [
    { nome: "BLACK NOVEMBRO - MAKE", valor: 10, cat: "MAKE", status: "ATIVA", de: "2026-11-01", ate: "2026-11-30", kw: ["BLACK", "MAKE"] },
  ],
};

let ok = 0;
let fail = 0;
function check(nome: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    fail++;
    console.log(`  ✗ ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}

// 1) Bonificado por CFOP
check(
  "bonificado (CFOP 5911)",
  classificarPedido({ obs: "encaminhar amostra", cod: "999", cfop: 5911, total: 50 }, dados).bonif,
  true,
);

// 2) Acordo OK (5% cadastro, obs cita 5%)
check(
  "acordo OK 5%",
  classificarPedido({ obs: "ACORDO 5%", cod: "23591", cfop: null, total: 1000 }, dados).fontes.ACORDO,
  { status: "OK", texto: "5%", valorDesconto: 50 },
);

// 3) Acordo divergência (5% cadastro, obs diz 10%)
check(
  "acordo divergência",
  classificarPedido({ obs: "ACORDO 10%", cod: "23591", cfop: null, total: 1000 }, dados).fontes.ACORDO,
  { status: "DIVERGENCIA", texto: "5% (obs diz 10%)", valorDesconto: null },
);

// 4) Acordo com 2 percentuais -> VERIFICAR
check(
  "acordo 2 percentuais -> verificar",
  classificarPedido({ obs: "acordo comercial", cod: "1078", cfop: null, total: 500 }, dados).fontes.ACORDO,
  { status: "VERIFICAR", texto: "ACORDO 5% + 3%", valorDesconto: null },
);

// 5) Campanha OK (10% dentro da vigência)
check(
  "campanha OK 10%",
  classificarPedido({ obs: "BLACK 10% MAKE", cod: "555", cfop: null, total: 200, data: "2026-11-15" }, dados).fontes.CAMPANHA,
  { status: "OK", texto: "10% BLACK NOVEMBRO", valorDesconto: 20 },
);

// 6) Campanha fora de vigência (mesma obs, data fora) -> "nao cadastrada" (genérica)
check(
  "campanha fora de vigência",
  classificarPedido({ obs: "campanha relampago", cod: "555", cfop: null, total: 200, data: "2026-06-15" }, dados).fontes.CAMPANHA,
  { status: "VERIFICAR", texto: "campanha nao cadastrada", valorDesconto: null },
);

// 7) NFD pendente casada pelo número
check(
  "NFD 105 pendente OK",
  classificarPedido({ obs: "descontar NFD 105", cod: "22405", cfop: null, total: 300 }, dados).fontes.NFD,
  { status: "OK", texto: "R$ 120.50", valorDesconto: 120.5 },
);

// 8) NFD já descontada (número com 3+ dígitos, como o regex exige)
check(
  "NFD 150 já descontada",
  classificarPedido({ obs: "usar NFD 150", cod: "22405", cfop: null, total: 300 }, dados).fontes.NFD,
  { status: "VERIFICAR", texto: "NFD 150 já descontada", valorDesconto: null },
);

// 9) Sell Out pendente
check(
  "sell out pendente",
  classificarPedido({ obs: "abater sell out", cod: "23918", cfop: null, total: 400 }, dados).fontes["SELL OUT"],
  { status: "OK", texto: "R$ 300.00", valorDesconto: 300 },
);

// 10) Aprovação (aguardando autorização)
check("aprovação aguardando", aprovacao(norm("aguardando autorização do gerente")), "AGUARDANDO");
check("aprovação autorizado (liberado)", aprovacao(norm("já autorizado, pode faturar")), "");

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
