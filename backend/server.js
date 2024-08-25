const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const { PORT } = require("./config/index");
const dbConnect = require("./database");
const errorHandler = require("./middlewares/errorHandler");
const router = require("./routes/index");
app.use(cookieParser());
app.use(express.json());
app.use(router);
dbConnect();
app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`app is listening on port ${PORT}`);
});
