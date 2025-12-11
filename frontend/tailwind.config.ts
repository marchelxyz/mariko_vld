import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
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
        "el-messiri": ["El Messiri", "sans-serif"],
      },
      colors: {
        mariko: {
          primary: "#8E1A1B", // Main red background
          secondary: "#721516", // Темно-красный, как был
          field: "#EFEFEF", // Мягкий серый фон для инпутов
          dark: "#172127", // Header background
          accent: "#761516", // Footer background
          "text-light": "#EBEBEB", // Light text
          "text-secondary": "#ABB3B3", // Secondary text
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        "city-pulse": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(255,255,255,0.45)",
            transform: "translateY(0) scale(1)",
          },
          "50%": {
            boxShadow: "0 0 0 18px rgba(255,255,255,0)",
            transform: "translateY(-1px) scale(1.01)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(255,255,255,0)",
            transform: "translateY(0) scale(1)",
          },
        },
        "city-fade": {
          "0%": {
            opacity: "0",
            filter: "blur(3px)",
            transform: "translateY(8px) scale(0.98)",
          },
          "60%": {
            opacity: "1",
            filter: "blur(0)",
            transform: "translateY(0) scale(1.01)",
          },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "city-pin": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "30%": { transform: "rotate(-6deg) scale(1.05)" },
          "60%": { transform: "rotate(6deg) scale(1.05)" },
          "100%": { transform: "rotate(0deg) scale(1)" },
        },
        "city-glow": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(142,26,27,0.14)",
            transform: "translateY(0) scale(1)",
          },
          "50%": {
            boxShadow: "0 0 0 8px rgba(142,26,27,0.08)",
            transform: "translateY(-1px) scale(1.006)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(142,26,27,0)",
            transform: "translateY(0) scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "city-pulse": "city-pulse 0.7s ease-out",
        "city-fade": "city-fade 0.45s ease-out",
        "city-pin": "city-pin 0.55s ease-out",
        "city-glow": "city-glow 0.75s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
