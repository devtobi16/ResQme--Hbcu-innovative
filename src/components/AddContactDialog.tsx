import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserPlus } from "lucide-react";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (contact: {
    name: string;
    phone_number: string;
    email?: string;
    relationship?: string;
    is_primary: boolean;
  }) => void;
  initialData?: {
    id?: string;
    name: string;
    phone_number: string;
    email?: string;
    relationship?: string;
    is_primary: boolean;
  };
}

export const AddContactDialog = ({ open, onOpenChange, onSave, initialData }: AddContactDialogProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone_number || "");
  const [isPrimary, setIsPrimary] = useState(initialData?.is_primary || false);

  const handleSave = () => {
    if (!name || !phone) return;
    
    // Clean phone number: keep only digits
    let digits = phone.replace(/\D/g, "");
    let finalPhone = phone;

    // USA Logic: If 10 digits, add +1. If 11 digits starting with 1, add +.
    if (digits.length === 10) {
      finalPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      finalPhone = `+${digits}`;
    } else if (!phone.startsWith("+")) {
      finalPhone = `+${digits}`;
    }

    onSave({
      name,
      phone_number: finalPhone,
      is_primary: isPrimary,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {initialData ? "Edit Contact" : "Add Emergency Contact"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" type="tel" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Primary Contact</Label>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
