var kern = require("./kern");

var app = kern();
app.debug("App Running in Worker #" + app.status.workerId );

module.exports = app;

