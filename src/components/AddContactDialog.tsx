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

export const AddContactDialog = ({
  open,
  onOpenChange,
  onSave,
  initialData,
}: AddContactDialogProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone_number || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [relationship, setRelationship] = useState(initialData?.relationship || "");
  const [isPrimary, setIsPrimary] = useState(initialData?.is_primary || false);

  const handleSave = () => {
    if (!name || !phone) return;
    
    onSave({
      name,
      phone_number: phone,
      email: email || undefined,
      relationship: relationship || undefined,
      is_primary: isPrimary,
    });

    // Reset form
    setName("");
    setPhone("");
    setEmail("");
    setRelationship("");
    setIsPrimary(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-secondary" />
            {initialData ? "Edit Contact" : "Add Emergency Contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship (optional)</Label>
            <Input
              id="relationship"
              placeholder="e.g., Spouse, Parent, Friend"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="primary">Primary Contact</Label>
              <p className="text-xs text-muted-foreground">
                Notified first during emergencies
              </p>
            </div>
            <Switch
              id="primary"
              checked={isPrimary}
              onCheckedChange={setIsPrimary}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-secondary hover:bg-secondary/90"
              onClick={handleSave}
              disabled={!name || !phone}
            >
              {initialData ? "Update" : "Add Contact"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
