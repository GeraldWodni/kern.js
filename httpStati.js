// http error codes
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

module.exports = {
    403: { title: "Forbidden", text: "You are not entitled to access the specified resource." },
    404: { title: "Not Found", text: "The specified resource could not be found." },
    422: { title: "Unprocessable Entity", text: "The request contains semantic errors." },
    423: { title: "Locked", text: "The resource that is being accessed is locked." },
    501: { title: "Not Implemented", text: "The request cannot be fulfilled." },
    502: { title: "Bad Gateway", text: "Invalid response received from upstream server." },
    503: { title: "Service Unavailable", text: "The server is currently unavailable, or you have reached an unconfigured host." }
};
