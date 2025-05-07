const express = require("express");
const app = express();
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const https = require("https");
const fs = require("fs");
const cron = require("node-cron");
const socket = require("./socket/config/socket"); 
const router = express.Router();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swaggerConfig");
// const swaggerGen = require("./swaggerGen");

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ limit: "200mb", extended: true }));

let isMaintenanceMode = false;
  
morgan.token("host", function (req) {
  return req.hostname;
});

let date = new Date().toJSON();
app.use(
  morgan((tokens, req, res) => {
    return [
      tokens.method(req, res),
      tokens.host(req, res),
      tokens.url(req, res),
      " | ",
      tokens.status(req, res),
      tokens.res(req, res, "content-length"),
      tokens["response-time"](req, res),
      "ms",
      " - ",
      date,
    ].join(" ");
  })
);
app.use("/api", router);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// app.use("./api/routes", router); // Use your routes

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  if (isMaintenanceMode) {
    return res.status(503).json({
      message: "The server is under maintenance. Please try again later.",
    });
  }
  next(); // Continue to normal routes
});

var port = process.env.PORT || 4500;

const server = http.createServer(app);

require("./config/database");
app.use("/public", express.static(path.join("./public")));
app.use("/css", express.static(path.join("./css")));

// var socketio = require("socket.io")(server);
// require("./socket/v1")(socketio);

const io = socket.init(server); 
require("./socket/v1")(io);

app.use("/", router);
app.use(require("./api/routes/app/v1"));
app.use(require("./api/routes/admin/v1"));

// Sample route
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "templates") });
});

server.listen(port, () => {
  console.log(`Server listning at port : ${port}`);
});
  