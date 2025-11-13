import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      natsUrl: process.env.NUXT_PUBLIC_NATS_URL || '',
    },
  },
  app: {
    head: {
      title: "NATS JetStream Explorer",
      htmlAttrs: {
        lang: "en",
        class: "bg-slate-900",
      },
      bodyAttrs: {
        class: "bg-slate-900",
      },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          id: "description",
          name: "description",
          content: "Explore and manage your NATS JetStream instance.",
        },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.ico" }],
    },
    pageTransition: false,
    layoutTransition: false,
  },
  modules: ["@nuxt/image", "@nuxt/test-utils"],
  nitro: {
    preset: "bun",
    bun: {
      // Increase timeout for long-running SSE streams
      // Default is 10 seconds, we need more for streaming searches
      idleTimeout: 300, // 5 minutes in seconds
    },
    logLevel: process.env.NODE_ENV === 'production' ? 3 : 4, // info in prod, debug in dev
    experimental: {
      openAPI: false,
    },
  },
  // Override console.log to use ISO timestamps
  hooks: {
    'nitro:config': (nitroConfig) => {
      // Monkey-patch console methods to add ISO timestamps
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalInfo = console.info;

      const withTimestamp = (method: typeof console.log) => {
        return function(...args: any[]) {
          const timestamp = new Date().toISOString();
          method.call(console, `[${timestamp}]`, ...args);
        };
      };

      console.log = withTimestamp(originalLog);
      console.error = withTimestamp(originalError);
      console.warn = withTimestamp(originalWarn);
      console.info = withTimestamp(originalInfo);
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
