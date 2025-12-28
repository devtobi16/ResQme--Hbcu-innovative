import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmergencyContactCard } from "@/components/EmergencyContactCard";
import { AddContactDialog } from "@/components/AddContactDialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmergencyContact {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
  relationship?: string;
  is_primary: boolean;
}

const MAX_CONTACTS = 3;

const Contacts = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error", description: "Failed to load contacts", variant: "destructive" });
    } else {
      setContacts(data || []);
    }
    setIsLoading(false);
  };

  const handleAddContact = async (contact: {
    name: string;
    phone_number: string;
    email?: string;
    relationship?: string;
    is_primary: boolean;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingContact) {
      // Update existing contact
      const { error } = await supabase
        .from("emergency_contacts")
        .update(contact)
        .eq("id", editingContact.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
      } else {
        toast({ title: "Contact Updated", description: `${contact.name} has been updated` });
        fetchContacts();
      }
      setEditingContact(null);
    } else {
      // Add new contact
      const { error } = await supabase
        .from("emergency_contacts")
        .insert({ ...contact, user_id: user.id });

      if (error) {
        toast({ title: "Error", description: "Failed to add contact", variant: "destructive" });
      } else {
        toast({ title: "Contact Added", description: `${contact.name} has been added` });
        fetchContacts();
      }
    }
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    } else {
      toast({ title: "Contact Deleted", description: "Contact has been removed" });
      fetchContacts();
    }
  };

  const handleSetPrimary = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First, unset all primary contacts
    await supabase
      .from("emergency_contacts")
      .update({ is_primary: false })
      .eq("user_id", user.id);

    // Set the selected contact as primary
    const { error } = await supabase
      .from("emergency_contacts")
      .update({ is_primary: true })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to set primary contact", variant: "destructive" });
    } else {
      toast({ title: "Primary Contact Set", description: "Contact marked as primary" });
      fetchContacts();
    }
  };

  const handleEditContact = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setShowAddDialog(true);
  };

  const canAddMore = contacts.length < MAX_CONTACTS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Emergency Contacts</h2>
            <p className="text-xs text-muted-foreground">
              {contacts.length}/{MAX_CONTACTS} contacts added
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditingContact(null);
            setShowAddDialog(true);
          }}
          disabled={!canAddMore}
          className="bg-secondary hover:bg-secondary/90"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-foreground mb-2">No Contacts Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add up to {MAX_CONTACTS} emergency contacts who will be notified during alerts
          </p>
          <Button onClick={() => setShowAddDialog(true)} className="bg-secondary hover:bg-secondary/90">
            <UserPlus className="w-4 h-4 mr-2" />
            Add First Contact
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {contacts.map((contact) => (
            <EmergencyContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              onSetPrimary={handleSetPrimary}
            />
          ))}

          {!canAddMore && (
            <p className="text-center text-sm text-muted-foreground py-2">
              Maximum of {MAX_CONTACTS} contacts reached
            </p>
          )}
        </div>
      )}

      <AddContactDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) setEditingContact(null);
        }}
        onSave={handleAddContact}
        initialData={editingContact || undefined}
      />
    </div>
  );
};

export default Contacts;
