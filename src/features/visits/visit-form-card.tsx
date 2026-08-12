import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, Loader2, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/domain/types";
import { createCustomerVisit } from "@/lib/visits.functions";
import {
  VISIT_PHOTO_BUCKET,
  VISIT_PHOTO_MAX_BYTES,
  visitReasonOptions,
  visitShelfStatusOptions,
  type VisitShelfStatus,
} from "@/lib/visits.types";
import { normalizeSearchText } from "@/lib/utils";

export interface VisitFormCardProps {
  customers: Customer[];
  defaultSellerCode?: string | undefined;
}

const defaultShelfStatus: VisitShelfStatus = "abastecida";

function fileExtension(file: File) {
  const nameExt = file.name.split(".").pop()?.toLowerCase();
  if (nameExt && nameExt.length <= 5) return nameExt;
  return file.type.split("/")[1] || "jpg";
}

async function uploadVisitPhoto(file: File) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user)
    throw new Error("Sessão expirada. Entre novamente para enviar a foto.");

  const path = `${userData.user.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabase.storage.from(VISIT_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export function VisitFormCard({ customers, defaultSellerCode }: VisitFormCardProps) {
  const queryClient = useQueryClient();
  const saveVisit = useServerFn(createCustomerVisit);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [term, setTerm] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [visitReason, setVisitReason] = useState("rotina");
  const [shelfStatus, setShelfStatus] = useState<VisitShelfStatus>(defaultShelfStatus);
  const [routineIntervalDays, setRoutineIntervalDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  const options = useMemo(() => {
    const q = normalizeSearchText(term.trim());
    return customers
      .filter((customer) => {
        if (!q) return true;
        return normalizeSearchText(
          [
            customer.erpCode,
            customer.tradeName,
            customer.legalName,
            customer.city,
            customer.uf,
          ].join(" "),
        ).includes(q);
      })
      .slice(0, 40);
  }, [customers, term]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Selecione um cliente da carteira.");
      if (!photo) throw new Error("Envie uma foto da loja ou gôndola para validar a visita.");
      if (!photo.type.startsWith("image/"))
        throw new Error("O comprovante precisa ser uma imagem.");
      if (photo.size > VISIT_PHOTO_MAX_BYTES) throw new Error("A foto deve ter no máximo 10 MB.");

      const proofPhotoPath = await uploadVisitPhoto(photo);
      return saveVisit({
        data: {
          customerErpCode: selectedCustomer.erpCode,
          sellerErpCode: selectedCustomer.sellerErpCode ?? defaultSellerCode ?? "",
          visitedAt: new Date().toISOString(),
          visitReason,
          shelfStatus,
          proofPhotoPath,
          proofPhotoMime: photo.type,
          proofPhotoSize: photo.size,
          notes,
          routineIntervalDays: Number(routineIntervalDays),
        },
      });
    },
    onSuccess: async () => {
      toast.success("Visita registrada com foto.");
      setCustomerId("");
      setTerm("");
      setNotes("");
      setPhoto(null);
      setPhotoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["customer-visits"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="surface-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Camera className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Adicionar visita</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A foto da loja ou gôndola é obrigatória para validar a visita.
          </p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar cliente da carteira"
            className="h-12 rounded-xl bg-card pl-11"
          />
        </div>

        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger className="h-12 rounded-xl bg-card">
            <SelectValue placeholder="Selecione o cliente visitado" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {options.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.tradeName} · {customer.city}/{customer.uf} · Rep.{" "}
                {customer.sellerErpCode ?? "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={visitReason} onValueChange={setVisitReason}>
            <SelectTrigger className="h-12 rounded-xl bg-card">
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              {visitReasonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={shelfStatus}
            onValueChange={(value) => setShelfStatus(value as VisitShelfStatus)}
          >
            <SelectTrigger className="h-12 rounded-xl bg-card">
              <SelectValue placeholder="Situação da gôndola" />
            </SelectTrigger>
            <SelectContent>
              {visitShelfStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observações sobre exposição, falta de produto, oportunidade ou próximo passo"
            className="min-h-28 rounded-xl bg-card"
          />
          <Input
            type="number"
            min={7}
            max={120}
            value={routineIntervalDays}
            onChange={(event) => setRoutineIntervalDays(event.target.value)}
            className="h-12 rounded-xl bg-card"
            aria-label="Intervalo da rotina em dias"
          />
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onPhotoChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UploadCloud className="h-4 w-4" />
            {photo ? "Trocar foto obrigatória" : "Enviar foto obrigatória"}
          </button>
          {photoPreview && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
              <img
                src={photoPreview}
                alt="Prévia da visita"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Foto anexada. A visita já pode ser salva.
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-brand-gradient"
          disabled={mutation.isPending || !selectedCustomer || !photo}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar visita comprovada
        </Button>
      </form>
    </section>
  );
}
