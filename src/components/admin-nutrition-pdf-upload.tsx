"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Info, Upload } from "lucide-react";
import { uploadAndSendNutritionPlanPdf } from "@/lib/actions/nutrition-plan-pdf";
import { ClientInformationDialog } from "@/components/client-information-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientIntakeInfo } from "@/lib/actions/client-intake";

export function AdminNutritionPdfUpload({
  clientId,
  requestId,
  clientIntake,
  requestPreferences,
}: {
  clientId: string;
  requestId: string;
  clientIntake: ClientIntakeInfo | null;
  requestPreferences?: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (file && file.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleSend = () => {
    if (!selectedFile) {
      setError("Select a PDF nutrition plan to send");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      const result = await uploadAndSendNutritionPlanPdf(requestId, clientId, formData);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      router.push(`/admin/clients/${clientId}?request=${requestId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Client information</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setInfoOpen(true)}>
            <Info className="mr-2 h-4 w-4" />
            View intake
          </Button>
        </CardHeader>
        {requestPreferences && (
          <CardContent>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Client preferences</p>
            <p className="text-sm">{requestPreferences}</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload nutrition plan PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Build the plan in your preferred tool, export as PDF, then upload it here. The client
            will be able to view the PDF in their dashboard.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 px-6 py-10 transition-colors hover:border-primary/40 hover:bg-secondary/50"
          >
            {selectedFile ? (
              <>
                <FileText className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className="text-xs text-primary">Click to change file</span>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Choose PDF file</p>
                  <p className="text-xs text-muted-foreground">Max 10 MB</p>
                </div>
              </>
            )}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={handleSend}
            disabled={isPending || !selectedFile}
            className="w-full"
            size="lg"
          >
            {isPending ? "Sending…" : "Send PDF to client"}
          </Button>
        </CardContent>
      </Card>

      <ClientInformationDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        intake={clientIntake}
        preferences={requestPreferences}
      />
    </div>
  );
}
