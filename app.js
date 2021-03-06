// Sample application file
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

console.log( "ARGS:", process.argv );

module.exports = require("./kern")(function( app ){
    app.debug("App Running in Worker #" + app.status.workerId );

    app.get("/disabled", function( req, res ) {
        res.write( "kern.js running. talking to worker #" + app.status.workerId + " !");
    });
});

