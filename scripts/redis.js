#!/usr/local/bin/node

var redis   = require("redis");
var async   = require("async");
var fs      = require("fs");
var rdb     = redis.createClient();

var dump    = [];

function error(msg) {
    if( msg ) {
        console.error( "Error:", msg );
        process.exit(1)
    }
}

function usage(msg) {
    if( msg )
        console.error( "Error:", msg );
    console.error( "Usage: ./redis.js <command> [website]\nCommands: dump-users, restore" );
    process.exit(1)
};

if( process.argv.length <= 2 )
    return usage();

if( process.argv[2] === "dump-users" ) {
    if( process.argv.length < 4 ) 
        return usage( "No Website specified" );

    dumpUsers( process.argv[3] );
}
else if( process.argv[2] === "restore" ) {
    if( process.argv.length < 4 ) 
        return usage( "No File specified" );
    restore( process.argv[3] );
}
else {
    usage( "Unknown command " + process.argv[2] );
}

function seq( start, end ) {
    if( !end ) {
        end = start;
        start = 1;
    }

    var s = [];
    for( var i = start; i <= end; i++ )
        s.push( i );

    return s;
}

function printDump() {
    console.log( "[" );
    dump.forEach( function( key, index ) {
        console.log( " " + JSON.stringify( key ) + ( index < dump.length - 1 ? "," : "" ) );
    } );
    console.log( "]" );
}

function dumpKey( func, type, key, callback ) {
    rdb[func]( key, function( err, data ) {
        error( err );
        if( data != null ) {
            dump.push( { key: key, type: type, data: data } );
        }
        callback( null, data );
    });
}

function dumpUsers( website ) {

    /* count */
    dumpKey( "get", "string", website + ":users", function( err, count ) {

        /* names */
        dumpKey( "hgetall", "hash", website + ":usernames", function() {

            /* user objects */
            async.map( seq( count ), function( index, d ) {
                dumpKey( "hgetall", "hash", website + ":user:" + index, d );
            }, function( res ) {
                rdb.quit();
                printDump();
            });
        });
    });
};

function restore( file ) {
    fs.readFile( file, function( err, data ) {
        error( err );
        
        /* find matching setter */
        var data = JSON.parse( data );
        for( var i = 0; i < data.length; i++ ) {
            var type = data[i].type;
            var func = "";
            if( type === "string" )
                func = "set";
            else if( type === "hash" )
                func = "hmset";
            else
                error( "Unknown Type: ", type );

            data[i].func = func;
        }

        /* execute */
        async.map( data, function( item, d ) {
            rdb[ item.func ]( item.key, item.data, d );
        }, function( errs, res ) {
            error( errs );
            rdb.quit();
            console.error( "Restored" );
        });
    });
};

