// hierarchy module - website inheritance
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>

var path    = require("path");
var fs      = require("fs");


module.exports = function _hierarchy( k ) {

    var routes = {};
    var websitesRoot = k.kernOpts.websitesRoot;

    /* locate by hierarchy: cut subdomains, then check 'default' folder  */
    function lookupFile( website, filename ) {

        /* file found */
        var filePath = path.join( websitesRoot, website, filename ) 
        //console.log( "LookUp:", filePath );
        if( fs.existsSync( filePath ) )
            return filePath;

        /* check for route */
        if( website in routes )
            return lookupFile( routes[website], filename ); 

        /* cut next subdomain */
        var firstDot = website.indexOf(".");
        if( firstDot >= 0 )
            return lookupFile( website.substring( firstDot + 1 ), filename );

        /* if we are at TLD, check default */
        if( website !== "default" )
            return lookupFile( "default", filename );

        /* nothing in default, just fail */
        return null;
    }

    function lookupFileThrow( website, filename ) {
        var filePath = lookupFile( website, filename );
        if( filePath == null )
            throw new Error( "hierarchy-lookupFile: '" + filename + "' not found!" ); 

        return filePath;
    }

    /* locate by hierarchy: cut subdomains, then check 'default' folder  */
    function up( website ) {
        if( website in routes )
            return routes[website];

        /* cut next subdomain */
        var firstDot = website.indexOf(".");
        if( firstDot >= 0 )
            return website.substring( firstDot + 1 );

        /* if we are at TLD, check default */
        if( website !== "default" )
            return "default";

        /* nothing in default, just fail */
        return null;
    }

    function upParts( website ) {
        var parts = [ website ];
        part = website;

        while( part = up( part ) )
            parts.push( part );

        return parts;
    }

    /* go up until directory exists */
    function upExists( website, dir ) {
        while( true ) {
            website = up( website );
            if( website == null )
                return null;

            var dirPath = path.join( websitesRoot, website, dir || '' );
            if( fs.existsSync( dirPath ) )
                return website;
        }
    }

    function paths( website, dir ) {
        var paths = []

        /* prepend dummy to include website itself */
        website = "dummy." + website;

        while( true ) {
            website = upExists( website, dir );

            if( website == null )
                break;

            paths.push( path.join( websitesRoot, website, dir || '' ) );
        }

        return paths;
    }

    /* get website without any subdomain */
    function website( website ) {
        return upExists( "dummy." + website );
    }

    /* add custom route to hierary */
    function addRoute( source, target ) {
        routes[ source ] = target;
    }

    return {
        addRoute:       addRoute,
        lookupFile:     lookupFile,
        lookupFileThrow:lookupFileThrow,
        up:             up,
        upParts:        upParts,
        upExists:       upExists,
        paths:          paths,
        website:        website
    }
}
