import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Pause, 
  Volume2, 
  Bell,
  BellOff,
  Timer,
  Waves,
  Coffee,
  CloudRain,
  Wind
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const RitualModeButton = () => {
  const [isRitualActive, setIsRitualActive] = useState(false);
  const [ritualTime, setRitualTime] = useState(25); // minutes
  const [selectedSound, setSelectedSound] = useState("rain");
  const [volume, setVolume] = useState(50);
  const [notifications, setNotifications] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();

  const soundscapes = [
    { id: "rain", name: "Rain", icon: CloudRain, description: "Gentle rainfall" },
    { id: "waves", name: "Ocean Waves", icon: Waves, description: "Calming ocean sounds" },
    { id: "cafe", name: "Coffee Shop", icon: Coffee, description: "Ambient café atmosphere" },
    { id: "wind", name: "Forest Wind", icon: Wind, description: "Wind through trees" },
  ];

  const startRitual = () => {
    setIsRitualActive(true);
    setTimeRemaining(ritualTime * 60); // convert to seconds
    toast({
      title: "Ritual Mode Activated",
      description: `${ritualTime} minutes of focused reading begins now. Notifications disabled.`,
    });
  };

  const stopRitual = () => {
    setIsRitualActive(false);
    setTimeRemaining(0);
    toast({
      title: "Ritual Complete",
      description: "Great work! Your focused reading session is complete.",
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isRitualActive) {
    return (
      <Card className="focus-glow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-focus rounded-full animate-pulse"></div>
            <div>
              <div className="text-sm font-medium">Ritual Mode</div>
              <div className="text-xs text-muted-foreground">
                {formatTime(timeRemaining)} remaining
              </div>
            </div>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={stopRitual}
            >
              <Pause className="w-3 h-3 mr-1" />
              End
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const SelectedSoundIcon = soundscapes.find(s => s.id === selectedSound)?.icon || CloudRain;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="transition-ritual hover:focus-glow"
        >
          <Timer className="w-4 h-4 mr-2" />
          Ritual Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="ritual-heading">Start Reading Ritual</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Timer Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Focus Duration</Label>
            <div className="px-3">
              <Slider
                value={[ritualTime]}
                onValueChange={(value) => setRitualTime(value[0])}
                max={120}
                min={5}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5 min</span>
                <span className="font-medium">{ritualTime} minutes</span>
                <span>2 hours</span>
              </div>
            </div>
          </div>

          {/* Soundscape Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ambient Soundscape</Label>
            <div className="grid grid-cols-2 gap-3">
              {soundscapes.map((sound) => {
                const Icon = sound.icon;
                return (
                  <Card 
                    key={sound.id}
                    className={`cursor-pointer transition-ritual hover:ritual-glow ${
                      selectedSound === sound.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSound(sound.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <Icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-medium">{sound.name}</div>
                      <div className="text-xs text-muted-foreground">{sound.description}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Volume</Label>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{volume}%</span>
              </div>
            </div>
            <Slider
              value={[volume]}
              onValueChange={(value) => setVolume(value[0])}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {notifications ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Label className="text-sm font-medium">Block Notifications</Label>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          {/* Start Button */}
          <Button variant="ritual" className="w-full">
            <Play className="w-4 h-4 mr-2" />
            Begin {ritualTime}-Minute Ritual
          </Button>

          {/* Preview */}
          <Card className="gradient-ethereal">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <SelectedSoundIcon className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Ritual Preview</div>
                  <div className="text-xs text-muted-foreground">
                    {ritualTime} min • {soundscapes.find(s => s.id === selectedSound)?.name} • 
                    {notifications ? ' Notifications blocked' : ' Notifications allowed'}
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Focus Mode
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};