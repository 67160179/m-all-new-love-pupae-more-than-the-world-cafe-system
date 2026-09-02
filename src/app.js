require("dotenv").config();
const express = require("express");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
app.use(express.json());

app.use("/api", orderRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Cafe POS API is running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
