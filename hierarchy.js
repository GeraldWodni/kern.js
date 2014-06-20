// hierarchy functions
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var path    = require("path");
var fs      = require("fs");

/* TODO: refactor to also extract path-array for less */
/* locate by hierarchy: cut subdomains, then check 'default' folder  */
function lookupFile( websitesRoot, website, filename ) {

    /* file found */
    var filePath = path.join( websitesRoot, website, filename ) 
    //console.log( "LookUp:", filePath );
    if( fs.existsSync( filePath ) )
        return filePath;

    /* cut next subdomain */
    var firstDot = website.indexOf(".");
    if( firstDot >= 0 )
        return lookupFile( websitesRoot, website.substring( firstDot + 1 ), filename );

    /* if we are at TLD, check default */
    if( website !== "default" )
        return lookupFile( websitesRoot, "default", filename );

    /* nothing in default, just fail */
    return null;
}

/* locate by hierarchy: cut subdomains, then check 'default' folder  */
function up( website ) {

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

/* go up until directory exists */
function upExists( websitesRoot, website ) {
    while( true ) {
        website = up( website );
        if( website == null )
            return null;

        var dirPath = path.join( websitesRoot, website );
        if( fs.existsSync( dirPath ) )
            return website;
    }
}

function paths( websitesRoot, website ) {
    var paths = []

    /* prepend dummy to include website itself */
    website = "dummy." + website;

    while( true ) {
        //website = upExists( websitesRoot, website );

        /* TODO: use upExists */
        website = up( website );

        if( website == null )
            break;

        paths.push( path.join( websitesRoot, website ) );
    }

    return paths;
}


module.exports.lookupFile = lookupFile;
module.exports.up = up;
module.exports.upExists = upExists;
module.exports.paths = paths;
