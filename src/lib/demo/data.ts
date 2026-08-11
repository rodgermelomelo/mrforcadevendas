import type { Customer, PriceTable, Product } from "@/lib/domain/types";
import batom from "@/assets/prod-batom.jpg";
import esmalte from "@/assets/prod-esmalte.jpg";
import base from "@/assets/prod-base.jpg";
import skincare from "@/assets/prod-skincare.jpg";

/** Dados 100% sintéticos — nenhum dado real de cliente ou produto. */

export const erpLastUpdate = "2026-08-06T11:22:00-03:00";
export const demoSellerName = "Ana Ribeiro (vendedor externo)";

export const priceTables: PriceTable[] = [
  { code: "T01", name: "Tabela Varejo", mappedLevel: 1, levelLabel: "Nível 2" },
  { code: "T02", name: "Tabela Distribuidor", mappedLevel: 2, levelLabel: "Nível 3" },
  { code: "T07", name: "Tabela Especial Norte", mappedLevel: null, levelLabel: null },
];

export const customers: Customer[] = [
  {
    id: "c1", erpCode: "004512", legalName: "Bela Forma Comércio de Cosméticos LTDA",
    tradeName: "Bela Forma", taxId: "12345678000190", city: "Campinas", uf: "SP",
    segment: "Perfumaria", priceTableCode: "T01", paymentTerm: "28/56 dias",
    restricted: false, creditLimit: 45000, openBalance: 8200, minOrderValue: 600,
    lastOrderAt: "2026-07-28T14:10:00-03:00",
  },
  {
    id: "c2", erpCode: "004890", legalName: "Distribuidora Aurora de Beleza S/A",
    tradeName: "Aurora Beleza", taxId: "98765432000155", city: "Ribeirão Preto", uf: "SP",
    segment: "Distribuidor", priceTableCode: "T02", paymentTerm: "30/60/90 dias",
    restricted: false, creditLimit: 120000, openBalance: 31500, minOrderValue: 2500,
    lastOrderAt: "2026-08-03T09:40:00-03:00",
  },
  {
    id: "c3", erpCode: "005120", legalName: "Salão Estilo & Cia LTDA ME",
    tradeName: "Estilo & Cia", taxId: "11222333000144", city: "Sorocaba", uf: "SP",
    segment: "Salão", priceTableCode: "T01", paymentTerm: "À vista",
    restricted: true, restrictionReason: "Títulos em atraso há mais de 30 dias",
    creditLimit: 9000, openBalance: 7400, minOrderValue: 400,
    lastOrderAt: "2026-05-19T16:00:00-03:00",
  },
  {
    id: "c4", erpCode: "005433", legalName: "Norte Cosméticos Comércio LTDA",
    tradeName: "Norte Cosméticos", taxId: "22333444000199", city: "Manaus", uf: "AM",
    segment: "Atacado", priceTableCode: "T07", paymentTerm: "28 dias",
    restricted: false, creditLimit: 60000, openBalance: 0, minOrderValue: 1500,
    lastOrderAt: null,
  },
  {
    id: "c5", erpCode: "005780", legalName: "Farmácia Vida Plena LTDA",
    tradeName: "Vida Plena", taxId: "33444555000122", city: "Belo Horizonte", uf: "MG",
    segment: "Farmácia", priceTableCode: "T01", paymentTerm: "21/42 dias",
    restricted: false, creditLimit: 25000, openBalance: 22100, minOrderValue: 500,
    lastOrderAt: "2026-06-02T11:25:00-03:00",
  },
  {
    id: "c6", erpCode: "006001", legalName: "Mercado Charme Comercial EIRELI",
    tradeName: "Charme Store", taxId: "44555666000177", city: "Curitiba", uf: "PR",
    segment: "Perfumaria", priceTableCode: "T02", paymentTerm: "30/60 dias",
    restricted: false, creditLimit: 80000, openBalance: 12000, minOrderValue: 1200,
    lastOrderAt: "2026-08-01T15:05:00-03:00",
  },
];

interface Seed {
  code: string; name: string; group: string; stock: number; launch: boolean;
  img: string; p1: number; p2: number;
}

const seeds: Seed[] = [
  { code: "220145", name: "Batom Matte Intenso Rubi 3,5g", group: "Lábios", stock: 480, launch: false, img: batom, p1: 12.9, p2: 10.4 },
  { code: "220146", name: "Batom Cremoso Nude Suave 3,5g", group: "Lábios", stock: 260, launch: false, img: batom, p1: 12.5, p2: 10.1 },
  { code: "220180", name: "Batom Líquido Longa Duração Magenta", group: "Lábios", stock: 0, launch: true, img: batom, p1: 18.9, p2: 15.2 },
  { code: "231001", name: "Esmalte Cremoso Rosa Vibrante 8ml", group: "Unhas", stock: 1240, launch: false, img: esmalte, p1: 4.2, p2: 3.4 },
  { code: "231002", name: "Esmalte Glitter Festa 8ml", group: "Unhas", stock: 310, launch: true, img: esmalte, p1: 4.9, p2: 3.9 },
  { code: "231010", name: "Esmalte Base Fortalecedora 8ml", group: "Unhas", stock: 55, launch: false, img: esmalte, p1: 5.4, p2: 4.3 },
  { code: "240300", name: "Base Líquida Alta Cobertura 30ml", group: "Pele", stock: 190, launch: false, img: base, p1: 29.9, p2: 24.2 },
  { code: "240301", name: "Base Fluida Efeito Natural 30ml", group: "Pele", stock: 0, launch: false, img: base, p1: 27.5, p2: 22.3 },
  { code: "240320", name: "Primer Facial Matificante 25ml", group: "Pele", stock: 88, launch: true, img: base, p1: 32.9, p2: 26.5 },
  { code: "250700", name: "Sérum Facial Vitamina C 30ml", group: "Skincare", stock: 140, launch: true, img: skincare, p1: 49.9, p2: 40.2 },
  { code: "250701", name: "Creme Hidratante Facial 50g", group: "Skincare", stock: 320, launch: false, img: skincare, p1: 38.9, p2: 31.4 },
  { code: "250710", name: "Gel de Limpeza Facial 120ml", group: "Skincare", stock: 0, launch: false, img: skincare, p1: 26.9, p2: 21.7 },
  { code: "260900", name: "Kit Cuidados Diários (3 itens)", group: "Kits", stock: 60, launch: true, img: skincare, p1: 89.9, p2: 72.5 },
  { code: "260901", name: "Kit Maquiagem Essencial (4 itens)", group: "Kits", stock: 24, launch: false, img: batom, p1: 119.9, p2: 96.7 },
];

export const products: Product[] = seeds.map((s, i) => ({
  id: `p${i + 1}`,
  erpCode: s.code,
  name: s.name,
  group: s.group,
  unit: "UN",
  stock: s.stock,
  isLaunch: s.launch,
  imageUrl: s.img,
  prices: {
    // 6 valores por tabela; o valor aplicável depende do nível mapeado.
    T01: [0, s.p1, s.p1 * 0.96, s.p1 * 0.93, s.p1 * 0.9, s.p1 * 0.87],
    T02: [0, s.p2 * 1.05, s.p2, s.p2 * 0.97, s.p2 * 0.94, s.p2 * 0.91],
    // Produtos do grupo Kits não têm preço na tabela especial (bloqueio por produto).
    ...(s.group === "Kits" ? {} : { T07: [0, s.p1, s.p1, s.p1, s.p1, s.p1] }),
  },
}));

export const productGroups = Array.from(new Set(products.map((p) => p.group)));
