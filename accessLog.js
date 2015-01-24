var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var moment = require("moment");
var async = require("async");
var useragent = require("useragent");
var geoip = require("geoip-lite");
var _ = require("underscore");

function sum() {
    var s = 0;
    _.each( arguments, function( arg ) {
        if( _.isArray( arg ) )
            s += sum.apply( this, arg );
        else
            s += arg;
    });

    return s;
}

function uniqKeys( objects ) {
    return _.uniq( _.flatten( _.map( objects, _.keys ) ) );
}

function combine( objects, merger ) {
    var result = {};
    var keys = uniqKeys( objects );
    keys.forEach( function( key ) {
        var values = []
        objects.forEach( function( object ) {
            if( _.has( object, key ) )
                values.push( object[key] );
        });

        result[key] = merger( values );
    });

    return result;
}

//console.log( combine( [ { a: 1, b: 2 }, { c: 3 }, { a: 10 } ], sum ) );

function analyze( requests, callback ) {
    var data = {};
    requests.forEach( function( request ) {
        if( !data[ request.host ] )
            data[ request.host ] = { hits: 0, browsers: {}, countries: {} };

        /* ignore monitoring requests */
        if( request.userAgent == "Hetzner System Monitoring" )
            return;

        var userAgent = useragent.lookup( request.userAgent );
        if( userAgent.device.family === "Spider" )
            return;

        var geo = geoip.lookup( request.ip );
        if( !_.has( data[ request.host ].countries, geo.country ) )
            data[ request.host ].countries[ geo.country ] = 0; 

        data[ request.host ].countries[ geo.country ]++; 
        data[ request.host ].hits++;
    });

    callback( null, data );
}

function parseFile( content, callback ) {

    var lines = content.toString().split(/\r?\n/);
    var data = [];

    lines.forEach( function( line, index ){
        if( line.length == "" )
            return;

        // http://redmine.lighttpd.net/projects/lighttpd/wiki/Docs_ModAccessLog
        // 8.8.4.4 example.com - [01/Jan/2010:01:02:03 +0100] "GET /example HTTP/1.1" 200 12345 "Referer" "Useragent"

        regex = /^([^\s]+) ([^\s]+) ([^\s]+) \[([^\]]+)\] "((?:\\"|[^"])*)" (\d+) ([^\s]+) "([^"]*)" "([^"]*)"/g;
        var match = regex.exec( line );

        if( match == null ) {
            console.error("Cannot Parse [" + index + "]:" + line);
            return;
        }

        var ip = match[1];
        var host = match[2].split(":")[0].replace(/^www\./, '');
        var user = match[3];
        var rawTime = match[4];
        rawTime = rawTime.split(" ")[0];
        var requestString = match[5]
        var responseCode = match[6]
        var bodySize = match[7]
        var referer = match[8]
        var userAgent = match[9]

        //console.log( ip, host, user, rawTime, time.format("YYYY-MM-DD hh:mm:ss"), requestString, responseCode, bodySize, referer, userAgent );

        data.push({
            ip: ip,
            host: host,
            //time: moment(rawTime,"DD/MMM/YYYY:hh:mm:ss"),
            rawTime: rawTime,
            requestString: requestString,
            responseCode: responseCode,
            bodySize: bodySize,
            referer: referer,
            userAgent: userAgent
        });
    });

    analyze( data, callback );
    //callback( null, data );
}

function loadFile( filename, callback ) {
    fs.readFile( filename, function( err, data ) {
        if( err )
            return callback( err, [] );

        if( filename.indexOf(".gz") > 0 )
            zlib.gunzip( data, function( err, content ) {
                if( err )
                    callback( err, [] )
                else
                    parseFile( content, callback );
            });
        else
            parseFile( data, callback );
    });
};

function loadFiles( opts, callback ) {
    /* read all files */
    fs.readdir( opts.folder, function( err, items ) {
        if( err )
            return callback( err, [] );

        /* empty object containing nulls */
        var files = {};
        for( var i = 0; i < items.length; i++ )
            files[i] = null;

        items.forEach( function ( filename ) {
            /* get only access logs */
            if( /^access\.log.*/.test( filename ) ) {
                /* assign them to files */
                var match = /access\.log.?(\d*)\.?g?z?/.exec( filename );
                files[match[1] || 0] = path.join( opts.folder, filename );
            }
        });

        /* filter null-files */
        files = _.reject( files, function( file ) { return file == null; } );

        var i = 1;
        async.mapSeries( files, function( filename, d ) {
            opts.progressReporter( i++ / files.length, filename );
            loadFile( filename, function( err, data ) {
                if( err )
                    console.log("ERR", filename, err);
                d( err, data );
            } );
        }, function( err, requests ) {
            if( err )
                return callback( err, {} )

            callback( null, combine( requests, function( parts ) {
                var obj = {
                    hits: 0,
                    countries: {}
                };
                parts.forEach( function( part ) {
                    obj.hits += part.hits;
                    obj.countries = combine( [ obj.countries, part.countries ], sum );
                });

                return obj;
            }) );
        });
    });
}

//

if(false)
loadFile( "/var/log/lighttpd/access.log.10.gz", function( err, data ) {
    if( err )
        return console.error( err );
});

else
loadFiles( { folder: "/var/log/lighttpd", progressReporter: function( progress, msg ) { console.log( "PROGRESS:", Math.round(progress * 100), msg ); } }, function( err, data ) {
    if( err )
        return console.error( err );

    console.log( "All Done:", data["echotab.com"] );
});

