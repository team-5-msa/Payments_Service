const app = require("./app");
const http = require("http");

const port = process.env.PORT || 3002;
app.set("port", port);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Payment Service listening on port ${port}`);
});
