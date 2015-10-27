// http error codes
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

module.exports = {
    403: { title: "Forbidden", text: "You are not entitled to access the specified resource." },
    404: { title: "Not Found", text: "The specified resource could not be found." },
    501: { title: "Not Implemented", text: "The request cannot be fulfilled." },
    503: { title: "Service Unavailable", text: "The server is currently unavailable, or you have reached an unconfigured host." }
};
