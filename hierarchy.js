// hierarchy functions
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var path    = require("path");
var fs      = require("fs");

/* TODO: refactor to also extract path-array for less */
/* locate by hierarchy: cut subdomains, then check 'default' folder  */
function lookupFile( websitesRoot, website, filename ) {

    /* file found */
    var filePath = path.join( websitesRoot, website, filename ) 
    console.log( "LookUp:", filePath );
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

module.exports.lookupFile = lookupFile;
