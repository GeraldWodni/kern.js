// Serverwide configuration
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");

function Config( opts ) {

    var configData = null;

    /* dynamic-config (depends on request) */
    function dynamicConfig( req, res, next ) {
        /* TODO: check real config for debug-hosts */
        req.config.debugHost = true;
        next();
    };

    /* config-callback */
    return function( req, res, next ) {
    	console.log( "CONFIG!" );

        /* if config loaded, add it to request and resume */
        if( configData ) {
            req.config = configData;
            dynamicConfig( req, res, next );
            return;
        }
        
        /* otherwise attempt to run config */
        fs.readFile( "config.json", 'utf8', function( err, data ) {
            if( !err ) {
                /* load static config */
                configData = JSON.parse( data );
                dynamicConfig( req, res, next );
            }
            else
                /* on error just resume */
                next();
        });
    };
}

module.exports = Config;

