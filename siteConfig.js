// website specific configuration
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require( "underscore" );
var os      = require( "os" );
var fs      = require( "fs" );
var path    = require( "path" );
var async   = require( "async" );

module.exports = function _siteConfig( k, opts ) {

    var websiteConfigs = {};
    function getField( item, field, defaultValue ) {
        var index = field.indexOf( "." );
        if( index > 0 )
            return getField( item[ field.substring( 0, index ) ], field.substring( index + 1 ) );
        else if( _.has( item, field ) )
            return item[ field ];
        else
            return defaultValue;
    };
    function get( website, key, defaultValue ) {
        if( !_.has( websiteConfigs, website ) )
            return defaultValue;

        return getField( websiteConfigs[ website ], key, defaultValue );
    }

    function loadAll(d) {
        /* configure websites (async) */
        fs.readdir( k.kernOpts.websitesRoot, function _loadAll_readdir( err, dirs ) {
            if( err )
                throw err;

            /* all loaded, perform callback */
            var remaining = dirs.length;
            function done() {
                if( --remaining == 0 )
                    d();
            }

            _.map( dirs, function _configure_dir( website ) {
                fs.readFile( path.join( k.kernOpts.websitesRoot, website, "config.json" ), function( err, data ) {
                    /* skip if error / non-existant */
                    if( err )
                        return done();

                    var finalConfig = {};

                    var config = JSON.parse( data );
                    _.each( config, function _it( websiteConfig, host ) {
                        if( new RegExp( host, "i" ).test( os.hostname() ) ) {
                            finalConfig = _.extend( finalConfig, websiteConfig );
                            console.log( "Config".green.bold + " " + website.grey + " " + host + " activated".bold.green );
                        }
                        else
                            console.log( "Config".green.bold + " " + website.grey + " " +  host + " skipped".yellow );
                    });

                    websiteConfigs[ website ] = finalConfig;

                    /* add routes */
                    if( finalConfig.hierarchyUp ) {
                        console.log( "Hierarchy-Route: ", website, " -> ", finalConfig.hierarchyUp );
                        k.hierarchy.addRoute( website, finalConfig.hierarchyUp );
                    }

                    /* add mysql DB */
                    if( finalConfig.mysql ) {
                        k.db.add( website, finalConfig.mysql );
                    }

                    /* autoload */
                    if( finalConfig.autoLoad )
                        k.site.load( website, function _autoLoad_callback(err) {
                            if( err )
                                console.log("Autoload-Error:".bold.red, err );
                            done();
                        })
                    else
                        done();
                });
            });
        });
    }

    return {
        loadAll: loadAll,
        get: get
    }
}
