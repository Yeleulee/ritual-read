import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Calendar, Trophy, Target, Star } from "lucide-react";

interface StreakTrackerProps {
  detailed?: boolean;
}

export const StreakTracker = ({ detailed = false }: StreakTrackerProps) => {
  const [currentStreak, setCurrentStreak] = useState(7);
  const [longestStreak, setLongestStreak] = useState(23);
  const [todayProgress, setTodayProgress] = useState(65);
  const [badges, setBadges] = useState([
    { id: 1, name: "First Steps", description: "Read for 1 day", earned: true, icon: "🌱" },
    { id: 2, name: "Week Warrior", description: "7-day streak", earned: true, icon: "⚡" },
    { id: 3, name: "Page Turner", description: "Read 100 pages", earned: true, icon: "📖" },
    { id: 4, name: "Month Master", description: "30-day streak", earned: false, icon: "🏆" },
    { id: 5, name: "Reading Sage", description: "Read 1000 pages", earned: false, icon: "🧙‍♂️" },
  ]);

  // Weekly reading calendar (last 7 days)
  const weeklyData = [
    { day: 'Sun', read: true, minutes: 25 },
    { day: 'Mon', read: true, minutes: 30 },
    { day: 'Tue', read: true, minutes: 20 },
    { day: 'Wed', read: true, minutes: 35 },
    { day: 'Thu', read: true, minutes: 15 },
    { day: 'Fri', read: true, minutes: 40 },
    { day: 'Sat', read: true, minutes: 22 },
  ];

  if (!detailed) {
    return (
      <Card className="w-fit">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Flame className="w-6 h-6 text-streak animate-streak-pulse" />
            </div>
            <div>
              <div className="text-lg font-bold">{currentStreak}</div>
              <div className="text-xs text-muted-foreground">day streak</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streak Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="ritual-glow animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-streak-pulse">
              <Flame className="w-8 h-8 text-streak-foreground" />
            </div>
            <div className="text-3xl font-bold text-streak mb-2">{currentStreak}</div>
            <div className="text-sm text-muted-foreground">Current Streak</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-secondary" />
            </div>
            <div className="text-3xl font-bold mb-2">{longestStreak}</div>
            <div className="text-sm text-muted-foreground">Longest Streak</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-focus" />
            </div>
            <div className="text-3xl font-bold mb-2">{todayProgress}%</div>
            <div className="text-sm text-muted-foreground">Today's Goal</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Progress */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Today's Reading Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">20 minutes daily goal</span>
            <span className="font-medium">{Math.round((todayProgress / 100) * 20)} min read</span>
          </div>
          <Progress value={todayProgress} className="h-3" />
          <p className="text-sm text-muted-foreground">
            Keep going! You're {100 - todayProgress}% away from maintaining your streak.
          </p>
        </CardContent>
      </Card>

      {/* Weekly Calendar */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="ritual-heading">This Week's Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-3">
            {weeklyData.map((day, index) => (
              <div key={index} className="text-center">
                <div className="text-xs text-muted-foreground mb-2">{day.day}</div>
                <div 
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-medium transition-ritual ${
                    day.read 
                      ? 'gradient-secondary text-secondary-foreground achievement-glow' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.read ? day.minutes : '—'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-secondary" />
            Reading Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badges.map((badge) => (
              <div 
                key={badge.id} 
                className={`p-4 rounded-lg border transition-ritual ${
                  badge.earned 
                    ? 'bg-secondary/10 border-secondary/20 animate-achievement-bounce' 
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{badge.icon}</div>
                  <div className="flex-1">
                    <div className={`font-medium ${badge.earned ? 'text-secondary' : 'text-muted-foreground'}`}>
                      {badge.name}
                    </div>
                    <div className="text-sm text-muted-foreground">{badge.description}</div>
                  </div>
                  {badge.earned && (
                    <Badge className="gradient-secondary">
                      Earned
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Motivation */}
      <Card className="gradient-primary text-primary-foreground animate-page-fade">
        <CardContent className="p-6 text-center">
          <Flame className="w-12 h-12 mx-auto mb-4 animate-ritual-glow" />
          <h3 className="text-xl font-bold mb-2">You're on fire! 🔥</h3>
          <p className="text-primary-foreground/90">
            {currentStreak >= 7 
              ? `Amazing! You've been reading consistently for ${currentStreak} days. Keep the momentum going!`
              : `You're doing great! Just ${7 - currentStreak} more days to unlock the Week Warrior badge.`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
};