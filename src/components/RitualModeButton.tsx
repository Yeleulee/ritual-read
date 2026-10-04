import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RitualMusicSearch } from "@/components/RitualMusicSearch";
import { InlineRitualAudioControls } from "@/components/InlineRitualAudioControls";
import { Music2 } from "lucide-react";

export const RitualModeButton = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-11 min-w-11 px-3 text-sm" aria-label="Music">
          <Music2 className="w-4 h-4" />
          <span className="hidden sm:inline">Music</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-lg p-0 gap-0 overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <p className="eyebrow">Ritual</p>
          <DialogTitle className="display text-3xl">Music for reading</DialogTitle>
        </DialogHeader>

        <InlineRitualAudioControls />
        <RitualMusicSearch />
      </DialogContent>
    </Dialog>
  );
};