import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Calendar,
  Target,
  Award,
  BarChart3
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as ReBarChart, Bar, XAxis, CartesianGrid } from "recharts";

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
  // Calculate statistics
  const totalBooks = books.length;
  const completedBooks = books.filter(book => book.progress >= 100).length;
  const inProgressBooks = books.filter(book => book.progress > 0 && book.progress < 100).length;
  const totalPages = books.reduce((sum, book) => sum + book.totalPages, 0);
  const pagesRead = books.reduce((sum, book) => sum + Math.floor((book.progress / 100) * book.totalPages), 0);
  const averageProgress = totalBooks > 0 ? books.reduce((sum, book) => sum + book.progress, 0) / totalBooks : 0;

  // Mock data for enhanced dashboard
  const weeklyStats = [
    { day: 'Mon', minutes: 25, pages: 12 },
    { day: 'Tue', minutes: 30, pages: 15 },
    { day: 'Wed', minutes: 20, pages: 8 },
    { day: 'Thu', minutes: 35, pages: 18 },
    { day: 'Fri', minutes: 15, pages: 6 },
    { day: 'Sat', minutes: 40, pages: 22 },
    { day: 'Sun', minutes: 22, pages: 11 },
  ];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-page-fade">
        <h2 className="text-2xl font-bold ritual-heading mb-2">Reading Insights</h2>
        <p className="text-muted-foreground">Track your mindful reading journey</p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="animate-page-fade ritual-glow">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-2xl font-bold mb-1">{totalBooks}</div>
            <div className="text-sm text-muted-foreground">Books in Library</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 gradient-secondary rounded-lg flex items-center justify-center mx-auto mb-4 achievement-glow">
              <Award className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div className="text-2xl font-bold mb-1">{completedBooks}</div>
            <div className="text-sm text-muted-foreground">Books Completed</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-focus/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-focus" />
            </div>
            <div className="text-2xl font-bold mb-1">{pagesRead}</div>
            <div className="text-sm text-muted-foreground">Pages Read</div>
          </CardContent>
        </Card>

        <Card className="animate-page-fade">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div className="text-2xl font-bold mb-1">{Math.round(averageProgress)}%</div>
            <div className="text-sm text-muted-foreground">Avg. Progress</div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Goals */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Monthly Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Books Read</span>
                <span className="text-sm text-muted-foreground">
                  {monthlyGoals.booksRead} / {monthlyGoals.booksTarget}
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.booksRead / monthlyGoals.booksTarget) * 100} 
                className="h-2" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pages Read</span>
                <span className="text-sm text-muted-foreground">
                  {monthlyGoals.pagesRead} / {monthlyGoals.pagesTarget}
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.pagesRead / monthlyGoals.pagesTarget) * 100} 
                className="h-2" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Reading Time</span>
                <span className="text-sm text-muted-foreground">
                  {monthlyGoals.minutesRead} / {monthlyGoals.minutesTarget} min
                </span>
              </div>
              <Progress 
                value={(monthlyGoals.minutesRead / monthlyGoals.minutesTarget) * 100} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Activity */}
      <Card className="animate-page-fade">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            This Week's Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 px-2">
          <ChartContainer
            config={{
              minutes: { label: "Minutes", color: "hsl(var(--primary))" },
              pages: { label: "Pages", color: "hsl(var(--secondary))" },
            }}
            className="min-w-[520px] w-full h-[260px]"
          >
            <ReBarChart data={weeklyStats} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[6,6,0,0]} />
              <Bar dataKey="pages" fill="var(--color-pages)" radius={[6,6,0,0]} />
            </ReBarChart>
          </ChartContainer>
          </div>
          <div className="text-center text-sm text-muted-foreground mt-3">
            Total this week: {weeklyStats.reduce((sum, day) => sum + day.minutes, 0)} minutes · {weeklyStats.reduce((sum, day) => sum + day.pages, 0)} pages
          </div>
        </CardContent>
      </Card>

      {/* Reading Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Currently Reading */}
        <Card className="animate-page-fade">
          <CardHeader>
            <CardTitle className="text-lg">Currently Reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inProgressBooks > 0 ? (
              books
                .filter(book => book.progress > 0 && book.progress < 100)
                .slice(0, 3)
                .map((book) => (
                  <div key={book.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{book.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {Math.round(book.progress)}%
                      </Badge>
                    </div>
                    <Progress value={book.progress} className="h-2" />
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No books in progress</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Read */}
        <Card className="animate-page-fade">
          <CardHeader>
            <CardTitle className="text-lg">Recently Read</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentlyRead.length > 0 ? (
              recentlyRead.map((book) => (
                <div key={book.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {book.lastRead ? new Date(book.lastRead).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No recent reading activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reading Insights */}
      <Card className="gradient-primary text-primary-foreground animate-page-fade">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Your Reading Journey</h3>
              <p className="text-primary-foreground/90">
                {totalBooks === 0 
                  ? "Start your mindful reading journey by adding your first book!"
                  : `You've made great progress! ${completedBooks} books completed out of ${totalBooks} in your library. ${
                      inProgressBooks > 0 
                        ? `Keep going with your ${inProgressBooks} book${inProgressBooks === 1 ? '' : 's'} in progress.`
                        : "Consider starting a new book to maintain your reading momentum."
                    }`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};