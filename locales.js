// Locales
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");

module.exports = function( rdb, defaultLocale ) {

    var locales = {};
    var localeNames = [];
    var folder = "locales";
    defaultLocale = defaultLocale || 'en_US';

    function reload() {
        locales = {};
        localeNames = [];

        _.each( fs.readdirSync( folder ), function( filename ) {
            var name = filename.replace( /\.json$/, '' );
	    if( /^[a-z]{2}_[A-Z]{2}\.json$/.test( filename ) ) {
                localeNames.push( name );
                locales[ name ] = JSON.parse( fs.readFileSync( path.join( folder, filename ) ) );
                console.log( "Found Locale", name );
            }
        });
    };

    /* get the closest locale */
    function getClosest( locale ) {
        if( locale in localeNames )
            return locale;

        var language = locale.substring( 0, 2 );
        for( var i = 0; i < localeNames.length; i++ )
            if( localeNames[i].indexOf( language ) == 0 )
                return localeNames[i];

        return defaultLocale;
    }

    /* handle unfound strings */
    function notFound( text ) {
        /* report missing text */
        rdb.sadd( "missing-locales", text );

        return "\u2702" + text;
    }

    
    /* TODO: finish this function, always yields notFound */
    function __( locale, text ) {
        var resolved = locales[ locale ][ text ];
        if( resolved == undefined )
            return notFound( text );

        return resolved;
    };

    reload();

    return function( req, res, next ) {
    	/* TODO: get from user agent */
        var current = getClosest( "de_DE" );

        var requested = req.headers["accept-language"];

        console.log( requested );
        console.log("Closest:", current );

        req.locales = {
            current:    current,
            available:  localeNames,
            reload:     reload,
            __:         function() { return __( current, arguments[0], Array.prototype.slice.call( arguments, 1 ) ); }
        };

        next();
    };
};
