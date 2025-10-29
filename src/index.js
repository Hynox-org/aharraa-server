const connectDB = require('./config/db');
const app = require('./app');

// Connect to MongoDB and then start server
connectDB();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
