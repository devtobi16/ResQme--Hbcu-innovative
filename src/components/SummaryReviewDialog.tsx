import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Send, X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SummaryReviewDialogProps {
  isOpen: boolean;
  summary: string;
  isProcessing: boolean;
  onApprove: (editedSummary: string) => void;
  onCancel: () => void;
}

export const SummaryReviewDialog = ({
  isOpen,
  summary,
  isProcessing,
  onApprove,
  onCancel,
}: SummaryReviewDialogProps) => {
  const [editedSummary, setEditedSummary] = useState(summary);

  // Update local state when summary changes
  if (summary !== editedSummary && !editedSummary) {
    setEditedSummary(summary);
  }

  const handleApprove = () => {
    onApprove(editedSummary || summary);
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Review Emergency Summary
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review and optionally edit the AI-generated summary before sending to your emergency contacts.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing audio...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-warning">
                This message will be sent to all your emergency contacts via SMS.
              </p>
            </div>
            
            <Textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              placeholder="Emergency summary..."
              className="min-h-[120px] resize-none"
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Cancel Alert
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleApprove}
              disabled={isProcessing || !editedSummary?.trim()}
              className="gap-2 bg-destructive hover:bg-destructive/90"
            >
              <Send className="w-4 h-4" />
              Send to Contacts
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
