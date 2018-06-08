// Locales
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");

module.exports = function _locales( k, opts ) {

    var locales = {};
    var localeNames = [];
    var languages = [];
    var folder = "locales";
    var defaultLocale = ( opts ? opts.defaultLocale : null ) || 'en-US';

    function reload() {
        locales = {};
        localeNames = [];

        _.each( fs.readdirSync( folder ), function( filename ) {
            var name = filename.replace( /\.json$/, '' );
            if( /^[a-z]{2}-[A-Z]{2}\.json$/.test( filename ) ) {
                localeNames.push( name );
                languages.push( name.substring( 0, 2 ) );
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

    function sortRequested( requested ) {

        /* parse quality groups */
        var items = [];
        requested.replace( /\s/g, '' ).split( ',' ).forEach( function( item ) {
            var qIndex = item.indexOf( ";q=" );
            if( qIndex > 0 )
                items.push({
                    language: item.substring( 0, qIndex ),
                    quality: parseFloat( item.substring( qIndex + 3 ) ),
                });
            else
                items.push({ language: item, quality: 1.0 });
        });

        /* sort by descending quality, then select language attribute */
        return _.pluck( _.sortBy( items,
            function( item ) { return -item.quality; } ),
            'language'
        );
    }

    function getBestMatch( requested ) {
        var requests = sortRequested( requested );

        for( var i = 0; i < requests.length; i++ ) {
            var request = requests[i];
            if( request.length == 0 )
                continue;

            /* perfect match */
            if( localeNames.indexOf( request ) >= 0 )
                return request;

            /* language match */
            if( languages.indexOf( request.substring( 0, 2  ) ) >= 0 )
                return getClosest( request );
        }

        return defaultLocale;
    }

    /* handle unfound strings */
    function notFound( text ) {
        /* report missing text */
        k.rdb.sadd( "missing-locales", text );

        return "\u2702" + text;
    }

    
    /* TODO: finish this function, always yields notFound */
    function __( locale, text ) {
        if( text.length > 0 && text.charAt(0) === "=" )
            return text.substring(1);
    
        var resolved = locales[ locale ][ text ];
        if( resolved == undefined )
            return notFound( text );

        return resolved;
    };

    reload();

    function route() {
        k.app.use( function _locales( req, res, next ) {
            var requested = req.headers["accept-language"] || "en-us";
            var current = getBestMatch( requested );

            //console.log( requested );
            //console.log("Closest:", current );

            req.locales = {
                current:    current,
                currentRoot:current.split("-")[0],
                available:  localeNames,
                reload: reload,
                __: function() { return __( current, arguments[0], Array.prototype.slice.call( arguments, 1 ) ); },
                _n: function( num, decimals ) {
                    let thousandsSeparator =__( current, "numThousandsSeparator" );
                    let decimalSeparator =  __( current, "numDecimalSeparator"   );

                    if( typeof decimals === 'undefined' )
                        decimals = 2;

                    let numText = num.toFixed(decimals) + '';
                    let commaPos = numText.indexOf( '.' );
                    console.log( "_NCP:", numText, commaPos );

                    let text = decimalSeparator + numText.substring( commaPos + 1 );
                    numText = numText.substring( 0, commaPos );
                    console.log( "_N:", num, text, numText );
                    for( var i = 0; i < numText.length; i++ ) {
                        if( i%3 == 0 && i > 0 )
                            text = thousandsSeparator + text;
                        text = numText[ numText.length - i - 1 ] + text;
                    }

                    return text;
                }
            };

            next();
        });
    }

    return {
        route: route,
        reload: reload
    }
};
