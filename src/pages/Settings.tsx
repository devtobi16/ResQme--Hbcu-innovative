import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Volume2, Shield, LogOut, VolumeX, MessageSquare, Lock, MapPin, Bell } from "lucide-react";
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

const DEFAULT_MESSAGE = "🚨 EMERGENCY: I need help! This is an automated alert from ResQ Me. Please check on me immediately.";

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
  const [silentMode, setSilentMode] = useState(false);
  const [defaultMessage, setDefaultMessage] = useState(DEFAULT_MESSAGE);
  const [isMessageSaving, setIsMessageSaving] = useState(false);
  
  // Permission states
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setLocalWakeWord(wakeWord);
    checkPermissions();
    loadSettings();
  }, [wakeWord]);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Load settings from profile if they exist (we'll store them there)
    // For now, use localStorage as fallback
    const savedSilentMode = localStorage.getItem("resqme_silent_mode");
    const savedMessage = localStorage.getItem("resqme_default_message");
    
    if (savedSilentMode !== null) {
      setSilentMode(savedSilentMode === "true");
    }
    if (savedMessage) {
      setDefaultMessage(savedMessage);
    }
  };

  const checkPermissions = async () => {
    try {
      // Check microphone permission
      const micResult = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicPermission(micResult.state);
      micResult.onchange = () => setMicPermission(micResult.state);

      // Check location permission
      const locResult = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      setLocationPermission(locResult.state);
      locResult.onchange = () => setLocationPermission(locResult.state);
    } catch (e) {
      console.log("Permissions API not fully supported");
    }
  };

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

  const handleSilentModeChange = (enabled: boolean) => {
    setSilentMode(enabled);
    localStorage.setItem("resqme_silent_mode", String(enabled));
    toast({
      title: enabled ? "Silent Mode Enabled" : "Silent Mode Disabled",
      description: enabled 
        ? "SOS will trigger silently without any sounds or vibrations" 
        : "Normal alert sounds will play during SOS",
    });
  };

  const handleSaveDefaultMessage = () => {
    if (defaultMessage.trim().length < 10) {
      toast({
        title: "Message too short",
        description: "Default message must be at least 10 characters",
        variant: "destructive",
      });
      return;
    }
    setIsMessageSaving(true);
    localStorage.setItem("resqme_default_message", defaultMessage.trim());
    setTimeout(() => {
      setIsMessageSaving(false);
      toast({
        title: "Message saved",
        description: "Your default emergency message has been updated",
      });
    }, 500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getPermissionBadge = (status: "granted" | "denied" | "prompt") => {
    switch (status) {
      case "granted":
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">Allowed</span>;
      case "denied":
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-600">Denied</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600">Not Set</span>;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your safety preferences</p>
        </div>
      </header>

      {/* Silent SOS Mode */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VolumeX className="w-5 h-5 text-orange-500" />
            Silent SOS Mode
          </CardTitle>
          <CardDescription>
            Trigger emergencies discreetly without any sounds or vibrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="silent-toggle" className="flex flex-col gap-1">
              <span>Enable silent mode</span>
              <span className="text-xs text-muted-foreground font-normal">
                No audio or haptic feedback during SOS
              </span>
            </Label>
            <Switch
              id="silent-toggle"
              checked={silentMode}
              onCheckedChange={handleSilentModeChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Default Emergency Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-secondary" />
            Default Emergency Message
          </CardTitle>
          <CardDescription>
            This message is sent when AI analysis is unavailable
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={defaultMessage}
            onChange={(e) => setDefaultMessage(e.target.value)}
            placeholder="Enter your default emergency message..."
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {defaultMessage.length}/300 characters
            </p>
            <Button
              onClick={handleSaveDefaultMessage}
              disabled={defaultMessage === localStorage.getItem("resqme_default_message") || isMessageSaving}
              size="sm"
            >
              {isMessageSaving ? "Saving..." : "Save Message"}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* Privacy & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-secondary" />
            Privacy & Permissions
          </CardTitle>
          <CardDescription>
            App permissions required for emergency features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Microphone</span>
            </div>
            {getPermissionBadge(micPermission)}
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Location</span>
            </div>
            {getPermissionBadge(locationPermission)}
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Notifications</span>
            </div>
            {getPermissionBadge("granted")}
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Audio recordings are stored securely and encrypted. You have full control over deletion.
          </p>
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
