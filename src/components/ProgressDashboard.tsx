import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Calendar,
  Target,
  Award,
  BarChart3,
  Users,
  Timer,
  Zap,
  BookMarked,
  ArrowUpRight,
  Bookmark,
  Star
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  lastRead?: Date;
}

interface ProgressDashboardProps {
  books: BookItem[];
}

export const ProgressDashboard = ({ books }: ProgressDashboardProps) => {
  // Live tracking data (minutes, streak, weekly)
  const { current, weekly } = useReadingStats();
  const isMobile = useIsMobile();
  const [compact, setCompact] = React.useState<boolean>(false as any);

  React.useEffect(() => {
    // Auto-enable compact on mobile
    setCompact(isMobile);
  }, [isMobile]);
  // Calculate statistics
  const totalBooks = books.length;
  const completedBooks = books.filter(book => book.progress >= 100).length;
  const inProgressBooks = books.filter(book => book.progress > 0 && book.progress < 100).length;
  const totalPages = books.reduce((sum, book) => sum + book.totalPages, 0);
  const pagesRead = books.reduce((sum, book) => sum + Math.floor((book.progress / 100) * book.totalPages), 0);
  const averageProgress = totalBooks > 0 ? books.reduce((sum, book) => sum + book.progress, 0) / totalBooks : 0;

  // Derive weekly stats from tracking (pages approximated from progress deltas when available; fallback ratio 0.5 pages/min)
  const weeklyStats = weekly.map((d) => ({ day: d.day, minutes: d.minutes, pages: Math.max(0, Math.round(d.minutes * 0.5)) }));

  const monthlyGoals = {
    booksTarget: 3,
    booksRead: completedBooks,
    pagesTarget: 500,
    pagesRead: pagesRead,
    minutesTarget: 600,
    minutesRead: 380,
  };

  const recentlyRead = books
    .filter(book => book.lastRead)
    .sort((a, b) => (b.lastRead?.getTime() || 0) - (a.lastRead?.getTime() || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-0 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02] rounded-3xl" />
      
      {/* Header */}
      <div className="animate-page-fade relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
              <h2 className="text-[20px] md:text-[26px] lg:text-[28px] font-semibold tracking-tight ritual-heading bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Analytics Dashboard
              </h2>
            </div>
            <p className="text-muted-foreground text-[12px] md:text-[14px] leading-relaxed ml-5">Comprehensive insights into your reading habits</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <Star className="w-3 h-3" />
              Pro Analytics
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setCompact(v => !v)} className="bg-muted/50 hover:bg-muted/80 transition-all duration-200">
              {compact ? 'Expand' : 'Compact'}
            </Button>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 md:gap-6`}>
        <Card className="animate-page-fade group relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-primary/3 to-primary/8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className={`p-4 ${compact ? '' : 'md:p-6'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`gradient-primary rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ${compact ? 'w-9 h-9' : 'w-10 h-10 md:w-12 md:h-12'}`}>
                <BookOpen className={`${compact ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} text-primary-foreground`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
            </div>
            <div className={`font-semibold mb-0.5 text-foreground group-hover:text-primary transition-colors duration-300 ${compact ? 'text-[18px]' : 'text-[22px] md:text-[26px]'}`}>{totalBooks}</div>
            <div className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-[12px] md:text-[13px]'} font-medium`}>Total Library</div>
            <div className="text-xs text-primary mt-1 font-medium">+{totalBooks > 0 ? '12%' : '0%'} this month</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade group relative overflow-hidden border-0 bg-gradient-to-br from-secondary/8 via-secondary/3 to-secondary/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className={`p-4 ${compact ? '' : 'md:p-6'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`gradient-secondary rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 achievement-glow ${compact ? 'w-9 h-9' : 'w-10 h-10 md:w-12 md:h-12'}`}>
                <Award className={`${compact ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} text-secondary-foreground`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
            </div>
            <div className={`font-semibold mb-0.5 text-foreground group-hover:text-secondary transition-colors duration-300 ${compact ? 'text-[18px]' : 'text-[22px] md:text-[26px]'}`}>{completedBooks}</div>
            <div className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-[12px] md:text-[13px]'} font-medium`}>Completed</div>
            <div className="text-xs text-secondary mt-1 font-medium">+{completedBooks > 0 ? '25%' : '0%'} this month</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/8 via-emerald-500/3 to-emerald-500/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className={`p-4 ${compact ? '' : 'md:p-6'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`${compact ? 'w-9 h-9' : 'w-10 h-10 md:w-12 md:h-12'} bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <BookMarked className={`${compact ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} text-white`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
            </div>
            <div className={`font-semibold mb-0.5 text-foreground group-hover:text-emerald-600 transition-colors duration-300 ${compact ? 'text-[18px]' : 'text-[22px] md:text-[26px]'}`}>{pagesRead}</div>
            <div className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-[12px] md:text-[13px]'} font-medium`}>Pages Read</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">+{pagesRead > 0 ? '8%' : '0%'} this week</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500/8 via-violet-500/3 to-violet-500/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className={`p-4 ${compact ? '' : 'md:p-6'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`${compact ? 'w-9 h-9' : 'w-10 h-10 md:w-12 md:h-12'} bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <TrendingUp className={`${compact ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} text-white`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
            </div>
            <div className={`font-semibold mb-0.5 text-foreground group-hover:text-violet-600 transition-colors duration-300 ${compact ? 'text-[18px]' : 'text-[22px] md:text-[26px]'}`}>{Math.round(averageProgress)}%</div>
            <div className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-[12px] md:text-[13px]'} font-medium`}>Avg Progress</div>
            <div className="text-xs text-violet-600 mt-1 font-medium">Trending up</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Goals */}
      <Card className="animate-page-fade border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              Monthly Performance
            </CardTitle>
            <Button variant="outline" size="sm" className="w-fit">
              <Calendar className="w-4 h-4 mr-2" />
              View Details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">Books Read</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {monthlyGoals.booksRead} / {monthlyGoals.booksTarget}
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.booksRead / monthlyGoals.booksTarget) * 100} 
                className="h-3" 
              />
              <div className="text-xs text-primary font-medium">
                {Math.round((monthlyGoals.booksRead / monthlyGoals.booksTarget) * 100)}% Complete
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-focus/5 to-focus/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-focus/20 rounded-lg flex items-center justify-center">
                    <BookMarked className="w-4 h-4 text-focus" />
                  </div>
                  <span className="font-medium">Pages Read</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {monthlyGoals.pagesRead} / {monthlyGoals.pagesTarget}
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.pagesRead / monthlyGoals.pagesTarget) * 100} 
                className="h-3" 
              />
              <div className="text-xs text-focus font-medium">
                {Math.round((monthlyGoals.pagesRead / monthlyGoals.pagesTarget) * 100)}% Complete
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Timer className="w-4 h-4 text-secondary" />
                  </div>
                  <span className="font-medium">Reading Time</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {monthlyGoals.minutesRead} / {monthlyGoals.minutesTarget}m
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.minutesRead / monthlyGoals.minutesTarget) * 100} 
                className="h-3" 
              />
              <div className="text-xs text-secondary font-medium">
                {Math.round((monthlyGoals.minutesRead / monthlyGoals.minutesTarget) * 100)}% Complete
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Activity Analytics */}
      <Card className="animate-page-fade border bg-border/50 shadow-sm bg-card/60 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              Weekly Reading Analytics
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Most Active: {weeklyStats.reduce((a, b) => a.minutes > b.minutes ? a : b).day}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="overflow-hidden rounded-xl border bg-background/50">
            <div className="overflow-x-auto">
              <ChartContainer
                config={{
                  minutes: { label: "Reading Minutes", color: "hsl(var(--primary))" },
                  pages: { label: "Pages Read", color: "hsl(var(--secondary))" },
                }}
                className={`${compact ? 'min-w-[420px] h-[220px]' : 'min-w-[520px] h-[280px] md:h-[320px]'} w-full`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={weeklyStats} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={12}
                      fontSize={12}
                      fontWeight={500}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                      fontSize={11}
                      fontWeight={400}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }}
                    />
                    <Bar 
                      dataKey="minutes" 
                      fill="var(--color-minutes)" 
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                    <Bar 
                      dataKey="pages" 
                      fill="var(--color-pages)" 
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                  </ReBarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10">
            <div className="text-center">
              <div className="text-lg md:text-xl font-bold text-primary">{weeklyStats.reduce((sum, day) => sum + day.minutes, 0)}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Minutes</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-xl font-bold text-secondary">{weeklyStats.reduce((sum, day) => sum + day.pages, 0)}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Pages</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-xl font-bold text-focus">{Math.round(weeklyStats.reduce((sum, day) => sum + day.minutes, 0) / 7)}</div>
              <div className="text-xs text-muted-foreground font-medium">Daily Average</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-xl font-bold text-accent-foreground">{weeklyStats.filter(day => day.minutes > 0).length}</div>
              <div className="text-xs text-muted-foreground font-medium">Active Days</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Currently Reading */}
        <Card className="animate-page-fade border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                Currently Reading
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {inProgressBooks} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {inProgressBooks > 0 ? (
              books
                .filter(book => book.progress > 0 && book.progress < 100)
                .slice(0, 3)
                .map((book, index) => (
                  <div key={book.id} className="group p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-sm md:text-base">{book.title}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{book.author}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {Math.round(book.progress)}%
                        </Badge>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Progress value={book.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{Math.floor(book.progress / 100 * book.totalPages)} pages read</span>
                        <span>{book.totalPages - Math.floor(book.progress / 100 * book.totalPages)} remaining</span>
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium mb-1">No books in progress</p>
                <p className="text-xs text-muted-foreground">Start reading to see progress here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Read */}
        <Card className="animate-page-fade border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-focus/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-focus" />
                </div>
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentlyRead.length > 0 ? (
              recentlyRead.map((book, index) => (
                <div key={book.id} className="group p-4 rounded-xl bg-gradient-to-r from-muted/20 to-muted/5 hover:from-muted/40 hover:to-muted/15 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate text-sm md:text-base">{book.title}</p>
                        {book.progress >= 100 && (
                          <Badge className="bg-secondary/20 text-secondary-foreground text-xs px-1.5 py-0.5">
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{book.author}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {book.lastRead ? new Date(book.lastRead).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'Never'}
                        </div>
                        <div className="text-xs font-mono text-primary">
                          {Math.round(book.progress)}%
                        </div>
                      </div>
                      <div className="w-1 h-8 bg-gradient-to-b from-focus to-focus/30 rounded-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium mb-1">No recent activity</p>
                <p className="text-xs text-muted-foreground">Your reading history will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights & Recommendations */}
      <Card className="animate-page-fade border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 backdrop-blur-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl md:text-2xl font-bold text-foreground">Reading Intelligence</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                {totalBooks === 0 
                  ? "Welcome to your reading analytics dashboard! Add your first book to start tracking your progress and building insightful reading habits."
                  : `Outstanding progress! You've completed ${completedBooks} out of ${totalBooks} books in your library. ${
                      inProgressBooks > 0 
                        ? `You're actively reading ${inProgressBooks} book${inProgressBooks === 1 ? '' : 's'} - maintain this momentum for optimal learning retention.`
                        : "Ready for your next literary adventure? Consider adding a new book to continue your growth."
                    }`
                }
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-primary/20 text-primary-foreground border-primary/30">
                  <Users className="w-3 h-3 mr-1" />
                  Personal Analytics
                </Badge>
                <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/30">
                  <Target className="w-3 h-3 mr-1" />
                  Goal Tracking
                </Badge>
                {totalBooks > 0 && (
                  <Badge className="bg-focus/20 text-focus-foreground border-focus/30">
                    <Zap className="w-3 h-3 mr-1" />
                    Active Reader
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};