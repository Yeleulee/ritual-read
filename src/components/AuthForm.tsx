import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wordmark } from '@/components/Wordmark';
import { Logo } from '@/components/Logo';
import { ReadingNookIllustration } from '@/components/auth/ReadingNookIllustration';
import { useAuth, DEV_AUTH_BYPASS } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const heading = tab === 'signin' ? 'Welcome back.' : 'Begin your ritual.';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account.",
      });
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    try {
      const { error } = await signInWithGoogle();

      if (error) {
        console.error('Google sign in error:', error);
        toast({
          title: "Google Sign In Failed",
          description: error.message || "Failed to authenticate with Google. Please try again.",
          variant: "destructive",
        });
        setGoogleLoading(false);
      }
      // If successful, user will be redirected to Google OAuth
    } catch (err) {
      console.error('Google sign in exception:', err);
      toast({
        title: "Google Sign In Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-12">
      {/* Statement panel — same colour block as the landing hero. Pinned to one viewport so the
          form can scroll without stretching the composition. */}
      <aside className="hidden lg:flex lg:col-span-7 lg:sticky lg:top-0 lg:h-dvh flex-col justify-between border-r border-white/10 bg-[linear-gradient(135deg,#0B0B0B_0%,#161514_55%,#242220_100%)] text-white px-10 xl:px-14 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Ritual Reader — home" className="inline-flex">
            <Logo label="" className="text-3xl text-white" />
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">Sign in</p>
        </div>

        {/* Height-bounded so the headline and stats always stay on screen; scene hugs the left
            padding edge to line up with the headline below. */}
        <div className="flex-1 min-h-0 flex items-center py-8">
          <ReadingNookIllustration align="start" className="h-full w-full max-w-[680px]" />
        </div>

        <div>
          <p className="display text-5xl xl:text-6xl max-w-xl text-balance">
            The book is waiting <em className="italic text-white/55">where you left it.</em>
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-white/15 pt-5">
            {[
              ['Library', 'Synced to your account'],
              ['Streak', 'Kept across devices'],
              ['Privacy', 'Your books stay yours'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">{k}</dt>
                <dd className="mt-1.5 text-sm leading-snug text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      {/* Form panel */}
      <section className="lg:col-span-5 flex flex-col px-4 sm:px-8 py-6 lg:py-8">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden"><Wordmark iconOnly /></span>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -mr-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
          </Button>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            {/* Below lg the statement panel is hidden, so carry the illustration into a compact banner */}
            <div className="lg:hidden mt-4 mb-6 sm:mb-8 overflow-hidden rounded-sm bg-[linear-gradient(135deg,#0B0B0B_0%,#161514_55%,#242220_100%)] text-white">
              <div className="aspect-[21/8] max-h-60 w-full">
                <ReadingNookIllustration crop="wide" fit="slice" className="h-full w-full" />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Ritual Reader</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">One book · Twenty minutes</p>
              </div>
            </div>

            <div className="mb-8 lg:mb-10">
              <p className="eyebrow">{greeting}</p>
              <h1 className="display text-4xl lg:text-[2.75rem] mt-3 text-balance">{heading}</h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-[34ch]">
                {tab === 'signin'
                  ? 'Pick up where you left off — your shelf and streak are waiting.'
                  : 'One book, twenty minutes a day. Your library syncs to every device.'}
              </p>
            </div>

            {DEV_AUTH_BYPASS && (
              <div className="mb-8 border border-dashed border-border p-4">
                <p className="eyebrow">Local mode</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  No Supabase keys found, so auth is bypassed. Books are stored in this browser.
                </p>
                <Button className="mt-4 h-11 w-full" onClick={() => signIn('', '')}>
                  Continue locally
                </Button>
              </div>
            )}

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')} className="space-y-8">
              <TabsList className="grid w-full grid-cols-2 gap-0">
                <TabsTrigger value="signin" className="justify-start">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="justify-start">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="animate-page-fade mt-0">
                <div className="space-y-6">
                  <Button
                    onClick={handleGoogleSignIn}
                    variant="outline"
                    className="h-11 w-full"
                    disabled={googleLoading || loading}
                  >
                    {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="eyebrow">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="eyebrow">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="eyebrow">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="h-11 w-full" disabled={loading || googleLoading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="animate-page-fade mt-0">
                <div className="space-y-6">
                  <Button
                    onClick={handleGoogleSignIn}
                    variant="outline"
                    className="h-11 w-full"
                    disabled={googleLoading || loading}
                  >
                    {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="eyebrow">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="eyebrow">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="eyebrow">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <Button type="submit" className="h-11 w-full" disabled={loading || googleLoading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create account
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <p className="eyebrow text-center lg:text-right mt-8">Free · No card required</p>
      </section>
    </div>
  );
};
