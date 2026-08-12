import { useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SellerGoalsHistory } from "@/components/admin/seller-goals-history";

interface Props {
  erpCode: string;
  sellerName: string;
  currentGoal: number;
}

export function SellerGoalsDialog({ erpCode, sellerName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2">
          <Target className="h-4 w-4" /> Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metas: {sellerName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto py-2">
          <SellerGoalsHistory erpCode={erpCode} canManage />
        </div>
      </DialogContent>
    </Dialog>
  );
}
