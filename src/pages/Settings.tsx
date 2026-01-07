import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SettingsProps {
  wakeWord: string;
  onWakeWordChange: (word: string) => void;
  isVoiceEnabled: boolean;
  onVoiceEnabledChange: (enabled: boolean) => void;
  isVolumeButtonEnabled: boolean;
  onVolumeButtonEnabledChange: (enabled: boolean) => void;
  isBackgroundServiceActive?: boolean;
}

const Settings = ({
  wakeWord,
  onWakeWordChange,
  isVoiceEnabled,
  onVoiceEnabledChange,
  isVolumeButtonEnabled,
  onVolumeButtonEnabledChange,
  isBackgroundServiceActive,
}: SettingsProps) => {
  const [localWakeWord, setLocalWakeWord] = useState(wakeWord);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setLocalWakeWord(wakeWord);
  }, [wakeWord]);

  const handleSaveWakeWord = () => {
    if (localWakeWord.trim().length < 2) {
      toast({
        title: "Invalid wake word",
        description: "Wake word must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    onWakeWordChange(localWakeWord.trim().toLowerCase());
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Wake word updated",
        description: `Now listening for "${localWakeWord.trim()}"`,
      });
    }, 500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your safety triggers</p>
        </div>
      </header>

      {/* Voice Activation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-secondary" />
            Voice Activation
          </CardTitle>
          <CardDescription>
            Trigger emergency alerts by saying your wake word followed by "help"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="voice-toggle" className="flex flex-col gap-1">
              <span>Enable voice activation</span>
              <span className="text-xs text-muted-foreground font-normal">
                Works in background on Android
              </span>
            </Label>
            <Switch
              id="voice-toggle"
              checked={isVoiceEnabled}
              onCheckedChange={onVoiceEnabledChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wake-word">Wake word</Label>
            <div className="flex gap-2">
              <Input
                id="wake-word"
                value={localWakeWord}
                onChange={(e) => setLocalWakeWord(e.target.value)}
                placeholder="e.g., help me, rescue, danger"
                disabled={!isVoiceEnabled}
              />
              <Button
                onClick={handleSaveWakeWord}
                disabled={!isVoiceEnabled || localWakeWord === wakeWord || isSaving}
                size="sm"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Say "{localWakeWord} help" or "{localWakeWord} emergency" to trigger
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Volume Button Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-secondary" />
            Volume Button Trigger
          </CardTitle>
          <CardDescription>
            Press both volume buttons simultaneously to trigger an alert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="volume-toggle" className="flex flex-col gap-1">
              <span>Enable volume button trigger</span>
              <span className="text-xs text-muted-foreground font-normal">
                Press Vol+ and Vol- together to trigger
              </span>
            </Label>
            <Switch
              id="volume-toggle"
              checked={isVolumeButtonEnabled}
              onCheckedChange={onVolumeButtonEnabledChange}
            />
          </div>
          
          {/* Background service status indicator */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div className={`w-2 h-2 rounded-full ${isBackgroundServiceActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-sm text-muted-foreground">
              {isBackgroundServiceActive 
                ? "Background service active - works when app closed" 
                : "Background service inactive"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
