export const VISIT_PHOTO_BUCKET = "visit-proofs";
export const VISIT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export type VisitShelfStatus = "abastecida" | "baixo_estoque" | "sem_exposicao" | "oportunidade";
export type VisitProofStatus = "photo_sent" | "validated" | "rejected";

export const visitShelfStatusOptions: {
  value: VisitShelfStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "abastecida",
    label: "Gôndola abastecida",
    description: "Produtos presentes e exposição saudável.",
  },
  {
    value: "baixo_estoque",
    label: "Baixo estoque",
    description: "Há produto, mas precisa reposição.",
  },
  {
    value: "sem_exposicao",
    label: "Sem exposição",
    description: "Não encontrei exposição relevante da linha.",
  },
  {
    value: "oportunidade",
    label: "Oportunidade",
    description: "Espaço para negociar ponto extra ou mix.",
  },
];

export const visitReasonOptions = [
  { value: "rotina", label: "Rotina mensal" },
  { value: "reposicao", label: "Reposição / ruptura" },
  { value: "treinamento", label: "Treinamento da equipe" },
  { value: "negociacao", label: "Negociação comercial" },
] as const;

export interface CustomerVisit {
  id: string;
  customerErpCode: string;
  customerName: string;
  customerLegalName: string;
  city: string;
  uf: string;
  sellerErpCode: string;
  visitedAt: string;
  visitReason: string;
  shelfStatus: VisitShelfStatus;
  proofStatus: VisitProofStatus;
  proofPhotoPath: string;
  proofPhotoUrl: string | null;
  notes: string;
  routineIntervalDays: number;
  nextVisitDate: string;
  createdAt: string;
  createdByName: string | null;
}

export interface CreateCustomerVisitInput {
  customerErpCode: string;
  sellerErpCode: string;
  visitedAt: string;
  visitReason: string;
  shelfStatus: VisitShelfStatus;
  proofPhotoPath: string;
  proofPhotoMime: string;
  proofPhotoSize: number;
  notes: string;
  routineIntervalDays: number;
}
