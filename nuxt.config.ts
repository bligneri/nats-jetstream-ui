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
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
