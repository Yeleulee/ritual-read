import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          glow: "hsl(var(--secondary-glow))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        focus: {
          DEFAULT: "hsl(var(--focus))",
          foreground: "hsl(var(--focus-foreground))",
        },
        streak: {
          DEFAULT: "hsl(var(--streak))",
          foreground: "hsl(var(--streak-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      perspective: {
        '1000': '1000px',
      },
      transform: {
        'rotate-y-0': 'rotateY(0deg)',
        'rotate-y-180': 'rotateY(-180deg)',
        'rotate-y-neg-180': 'rotateY(180deg)',
        'page-flip-next': 'rotateY(-180deg) scale(0.95)',
        'page-flip-prev': 'rotateY(180deg) scale(0.95)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "ritual-glow": {
          "0%, 100%": {
            boxShadow: "0 10px 40px -10px hsl(var(--primary) / 0.3)",
          },
          "50%": {
            boxShadow: "0 15px 50px -5px hsl(var(--primary) / 0.5)",
          },
        },
        "achievement-bounce": {
          "0%, 100%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.05)",
          },
        },
        "page-fade": {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "streak-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 hsl(var(--streak) / 0.7)",
          },
          "50%": {
            transform: "scale(1.02)",
            boxShadow: "0 0 0 8px hsl(var(--streak) / 0)",
          },
        },
        "page-flip": {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(-90deg)" },
          "100%": { transform: "rotateY(0deg)" }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ritual-glow": "ritual-glow 3s ease-in-out infinite",
        "achievement-bounce": "achievement-bounce 0.6s ease-in-out",
        "page-fade": "page-fade 0.5s ease-out",
        "streak-pulse": "streak-pulse 2s ease-in-out infinite",
        "page-flip": "page-flip 0.6s ease-in-out",
      },
      animationDelay: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      // Prose (AI chat answers) inherits the app's tokens so it tracks light/dark automatically.
      typography: ({ theme }: { theme: (path: string) => string | string[] }) => {
        const font = (name: string) => [theme(`fontFamily.${name}`)].flat().join(", ");
        // Size modifiers (prose-sm etc.) re-declare sizes/margins after DEFAULT, so metrics
        // must be repeated on each modifier we use.
        const metrics = {
          maxWidth: "68ch",
          "h2": { fontSize: "1.65em", marginTop: "1.7em", marginBottom: "0.5em", lineHeight: "1.15" },
          "h3": { fontSize: "1.25em", marginTop: "1.4em", marginBottom: "0.4em", lineHeight: "1.2" },
          ":where(h1, h2, h3):first-child": { marginTop: "0" },
          "p": { marginTop: "0.85em", marginBottom: "0.85em" },
          "li": { marginTop: "0.3em", marginBottom: "0.3em" },
          "blockquote": { fontSize: "1.08em", lineHeight: "1.45", paddingLeft: "1em", marginTop: "1.2em", marginBottom: "1.2em" },
          "code": { fontSize: "0.875em", padding: "0.15em 0.4em", borderRadius: "2px" },
          "pre": { fontSize: "0.85em", lineHeight: "1.6", borderRadius: "2px" },
          "table": { fontSize: "0.95em", lineHeight: "1.45" },
          "thead th": { fontSize: "11px", paddingBottom: "0.6em" },
          "tbody td": { paddingTop: "0.55em", paddingBottom: "0.55em" },
          "hr": { marginTop: "1.8em", marginBottom: "1.8em" },
        };
        return {
        sm: { css: metrics },
        DEFAULT: {
          css: {
            "--tw-prose-body": "hsl(var(--foreground) / 0.88)",
            "--tw-prose-headings": "hsl(var(--foreground))",
            "--tw-prose-lead": "hsl(var(--muted-foreground))",
            "--tw-prose-links": "hsl(var(--foreground))",
            "--tw-prose-bold": "hsl(var(--foreground))",
            "--tw-prose-counters": "hsl(var(--muted-foreground))",
            "--tw-prose-bullets": "hsl(var(--foreground) / 0.5)",
            "--tw-prose-hr": "hsl(var(--border))",
            "--tw-prose-quotes": "hsl(var(--foreground))",
            "--tw-prose-quote-borders": "hsl(var(--primary))",
            "--tw-prose-captions": "hsl(var(--muted-foreground))",
            "--tw-prose-code": "hsl(var(--foreground))",
            "--tw-prose-pre-code": "hsl(var(--foreground))",
            "--tw-prose-pre-bg": "hsl(var(--muted))",
            "--tw-prose-th-borders": "hsl(var(--border))",
            "--tw-prose-td-borders": "hsl(var(--border))",
            "--tw-prose-invert-body": "hsl(var(--foreground) / 0.88)",
            "--tw-prose-invert-headings": "hsl(var(--foreground))",
            "--tw-prose-invert-lead": "hsl(var(--muted-foreground))",
            "--tw-prose-invert-links": "hsl(var(--foreground))",
            "--tw-prose-invert-bold": "hsl(var(--foreground))",
            "--tw-prose-invert-counters": "hsl(var(--muted-foreground))",
            "--tw-prose-invert-bullets": "hsl(var(--foreground) / 0.5)",
            "--tw-prose-invert-hr": "hsl(var(--border))",
            "--tw-prose-invert-quotes": "hsl(var(--foreground))",
            "--tw-prose-invert-quote-borders": "hsl(var(--primary))",
            "--tw-prose-invert-captions": "hsl(var(--muted-foreground))",
            "--tw-prose-invert-code": "hsl(var(--foreground))",
            "--tw-prose-invert-pre-code": "hsl(var(--foreground))",
            "--tw-prose-invert-pre-bg": "hsl(var(--muted))",
            "--tw-prose-invert-th-borders": "hsl(var(--border))",
            "--tw-prose-invert-td-borders": "hsl(var(--border))",
            ...metrics,
            "h1, h2, h3, h4": {
              fontFamily: font("serif"),
              fontWeight: "400",
              letterSpacing: "-0.01em",
            },
            "ul > li::marker": { fontSize: "0.9em" },
            "ol > li::marker": { fontFamily: font("mono"), fontSize: "0.85em" },
            "blockquote": {
              fontFamily: font("serif"),
              fontStyle: "italic",
              fontWeight: "400",
              borderLeftWidth: "1px",
              ...metrics.blockquote,
            },
            "blockquote p:first-of-type::before": { content: "none" },
            "blockquote p:last-of-type::after": { content: "none" },
            "a": { textDecorationThickness: "1px", textUnderlineOffset: "4px", fontWeight: "400" },
            "code": {
              fontFamily: font("mono"),
              fontWeight: "400",
              backgroundColor: "hsl(var(--muted))",
              ...metrics.code,
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            "pre": {
              border: "1px solid hsl(var(--border))",
              ...metrics.pre,
            },
            "pre code": { backgroundColor: "transparent", padding: "0" },
            "thead th": {
              fontFamily: font("mono"),
              fontWeight: "400",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "hsl(var(--muted-foreground))",
              ...metrics["thead th"],
            },
            "strong": { fontWeight: "600" },
          },
        },
        };
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
