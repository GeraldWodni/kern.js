// Windows service wrapper
// (c)copyright 2017 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");

/* load node-windows */
var NodeWindows;
try {
    NodeWindows = require("node-windows")
} catch( err ) {
    console.log( "ERROR: node-windows is required, install it from the optional dependencies or by running 'npm install -g node-windows'");
    process.exit(1000);
}

/* serverConfig, load from file if exists */
var serverConfig = {
};

try { 
    serverConfig = JSON.parse( fs.readFileSync("serverConfig.json", { encoding: "utf-8" } ) );
} catch( err ) {
    console.log( "WARNING: serverConfig.json not found, proceeding without serverConfig" );
}

_.defaults( serverConfig, {
    windowsService: {
        name: "kern.js",
        description: "high performance node.js-webserver",
    }
});

/* service */
var service = new NodeWindows.Service({
    name: serverConfig.windowsService.name,
    description: serverConfig.windowsService.description,
    script: path.join( __dirname, 'kern.js' )
});

/* allow configuring domain, user and password */
if( serverConfig.user )
    _.extend( service.user, serverConfig.user );

service.on('install', function() {
    console.log( "SUCCESS: installed, running kern.js" );
    service.start();
});

service.on('alreadyinstalled', function( err ) {
    console.log( "ERROR: service already installed" );
});

service.on('invalidinstalled', function( err ) {
    console.log( "ERROR: service already installed but broken" );
});

service.on('uninstall', function() {
    if( service.exists )
        console.log( "ERROR: uninstall failed, service still exists" );
    else
        console.log( "SUCCESS: uninstalled" );
});

service.on('start', function() {
    console.log( "SUCCESS: started" );
});

service.on('stop', function() {
    console.log( "SUCCESS: stopped" );
});

service.on('error', function( err ) {
    console.log( "ERROR: execution error:", err );
});


/* usage documentation */
function usage() {
    console.log( "\nusage: node windows.js <command>\n"
        + "where <command> is one of the following:\n"
        + "install - install as windows service\n"
        + "uninstall - remove windows service"
    );
    process.exit( 1 );
}

/* parse command line */
if( process.argv.length < 3 )
    usage();

var command = process.argv[ 2 ];
switch( command ) {
    case 'install':
        console.log( "Installing...");
        service.install();
    break;
    case 'uninstall':
        console.log( "Uninstalling..." );
        service.uninstall();
    break;
    default:
        usage();
}
