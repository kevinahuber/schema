const port = process.env.PORT || 3000;
const target = `http://localhost:${port}`;

export default {
  server: {
    proxy: {
      '/ws': {
        target: target.replace('http', 'ws'),
        ws: true,
      },
      '/api': {
        target,
      },
      '/data': {
        target,
      },
      // Mosaic PNG export — only proxy .png under /s/
      '^/s/.+/mosaic\\.png': {
        target,
      },
    },
  },
};
