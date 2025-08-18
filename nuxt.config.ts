import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      title: "NATS JetStream Explorer",
      htmlAttrs: {
        lang: "en",
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
  },
  modules: ["@nuxt/image", "@nuxt/test-utils"],
  nitro: {
    preset: "deno",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
