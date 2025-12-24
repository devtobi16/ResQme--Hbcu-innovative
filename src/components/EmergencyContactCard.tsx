import { User, Phone, Mail, MoreVertical, Star, Trash2, Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface EmergencyContact {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
  relationship?: string;
  is_primary: boolean;
}

interface EmergencyContactCardProps {
  contact: EmergencyContact;
  onEdit: (contact: EmergencyContact) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

export const EmergencyContactCard = ({
  contact,
  onEdit,
  onDelete,
  onSetPrimary,
}: EmergencyContactCardProps) => {
  return (
    <Card className={cn(
      "glass-card border-border/50 overflow-hidden transition-all duration-200",
      contact.is_primary && "border-l-4 border-l-secondary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              contact.is_primary ? "bg-secondary/20" : "bg-muted"
            )}>
              <User className={cn(
                "w-6 h-6",
                contact.is_primary ? "text-secondary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-foreground">
                  {contact.name}
                </h3>
                {contact.is_primary && (
                  <Star className="w-4 h-4 text-secondary fill-secondary" />
                )}
              </div>
              {contact.relationship && (
                <span className="text-xs text-muted-foreground">
                  {contact.relationship}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!contact.is_primary && (
                <DropdownMenuItem onClick={() => onSetPrimary(contact.id)}>
                  <Star className="w-4 h-4 mr-2" />
                  Set as Primary
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(contact)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(contact.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={`tel:${contact.phone_number}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="w-4 h-4" />
            {contact.phone_number}
          </a>
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
              {contact.email}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
