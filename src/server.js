const { createApp } = require('./app');
const PORT = process.env.PORT || 5001;
createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`✅ PunchDad Swagger mock chạy tại http://localhost:${PORT}/api-docs`);
});
