import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RitualMusicSearch } from "@/components/RitualMusicSearch";
import { InlineRitualAudioControls } from "@/components/InlineRitualAudioControls";
import { Music2 } from "lucide-react";

export const RitualModeButton = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="transition-ritual hover:focus-glow"
        >
          <Music2 className="w-4 h-4 mr-2" />
          Ritual Music
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="ritual-heading">Ritual Music</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <RitualMusicSearch />
          <Separator />
          <InlineRitualAudioControls />
        </div>
      </DialogContent>
    </Dialog>
  );
};