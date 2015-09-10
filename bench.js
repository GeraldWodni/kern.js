"use strict";
require("colors");
var async   = require("async");
var request = require("request");

var args = process.argv;
var opts = {
    requests: 128,
    parallel: 8
};

var cmd = args.shift() + " " + args.shift();

if( args.length == 0 ) {
    console.log( "usage:", cmd, "<url> [requests] [parallel]" );
    process.exit(1);
}

opts.url = args.shift();
if( args.length > 0 )
    opts.requests = args.shift();

if( args.length > 0 )
    opts.parallel = args.shift();

var statusCount = {};
var time = {
    total: 0,
    max: 0,
    min: Number.POSITIVE_INFINITY
}

var totStart = process.hrtime();
var q = async.queue( function( n, next ) {
    var start = process.hrtime();
    request(opts.url, function( err, response, body ) {
        var end = process.hrtime();
        next();
        var duration = end[0] * 1e9 + end[1] - ( start[0] * 1e9 + start[1] );
        time.total += duration;
        time.min = Math.min( duration, time.min );
        time.max = Math.max( duration, time.max );

        if( response.statusCode in statusCount )
            statusCount[ response.statusCode ]++;
        else
            statusCount[ response.statusCode ] = 1;

        //console.log( "Request", n, (duration / 1e6).toFixed(2) );
    });
}, opts.parallel );

q.drain = function() {
    var totEnd = process.hrtime();
    var totDuration = totEnd[0] * 1e9 + totEnd[1] - ( totStart[0] * 1e9 + totStart[1] );

    console.log( "Time[ms] real:", (totDuration / 1e6).toFixed(2), "total:", (time.total / 1e6).toFixed(2) );
    console.log( "Request[ms] avg:", ((time.total / opts.requests )/1e6).toFixed(2), "min:", (time.min / 1e6).toFixed(2), "max:", (time.max / 1e6).toFixed(2) );

    console.log( statusCount );
}

for( var i = 0; i < opts.requests; i++ ) {
    q.push( i );
}
