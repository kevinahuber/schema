export default {
  server: {
    proxy: {
      // In dev, Vite proxies /ws to the Node server so the WS URL
      // works the same in both dev and production.
      '/ws': {
        target: `ws://localhost:${process.env.PORT || 3000}`,
        ws: true,
      },
    },
  },
};
