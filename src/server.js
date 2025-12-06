require("module-alias/register");

const app = require("@root/app");
const http = require("http");

const port = process.env.PORT || 3000;
app.set("port", port);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Payment Service listening on port ${port}`);
});

module.exports = app;
