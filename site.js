// website loading (site.js)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = function _site( k, opts ) {

    var websites = {};
    function load( website, next ) {
        console.log("LoadWebsite".bold.magenta, website, websites );
        var siteFilename = k.hierarchy.lookupFile( website, "site.js" );
        if( siteFilename != null ) {
            console.log( "Using ".magenta.bold, siteFilename );

            try {
                var target = siteModule( '', './' + siteFilename, { exactFilename: true } );
                websites[ website ] = target;
                console.log("LoadWebsite".bold.green, website, websites );
                return target;
            } catch( err ) {
                console.log("LoadWebsite-Error:".bold.red, err );
                next( err );
            }
        }
        else
            next();

        return null;
    }

    function getOrLoad(req, res, next) {
        var target;
        if( req.kern.website in websites )
            target = websites[ req.kern.website ];
        else
            /* get site specific script and execute it */
            target = load( req.kern.website, next );

        /* execute target site-script */
        if( target != null && "router" in target )
            target.router( req, res, next );
    }

    function routeRequestStart() {
        k.app.use(function (req, res, next) {

            /* get website from host, use kern if no config is set */
            var website = hierarchy.website( kernOpts.websitesRoot, req.host ) || "default";
            if( !( serverConfig.active || false ) )
                website = "kern";

            if( kernOpts.setupEnabled )
                console.log( "AUTHTOKEN:", serverConfig.authToken );

            filters( req );
            requestData( req );

            req.kern = {
                website: website,
                lookupFile: function( filePath ) {
                    return hierarchy.lookupFileThrow( kernOpts.websitesRoot, website, filePath );
                },
                getWebsiteConfig: function( key, defaultValue ) {
                    return k.siteConfig.get( website, key, defaultValue );
                },
                renderJade: app.renderJade
            };

            req.messages = [];

            var ended = false;
            var end = res.end;
            res.end = function( chunk, encoding ) {
                if( ended )
                    return false;
                ended = true;

                end.call( res, chunk, encoding );

                app.postHooks.forEach( function( postHook ){
                    postHook( req, res );
                });
            };

            next();
        });
    }

    var registeredSiteModules = {};
    function siteModule( website, filename, opts ) {
        /* get site specific script and execute it */
        opts = opts || {};

        if( !opts.exactFilename )
            filename = "./" + k.hierarchy.lookupFileThrow( website, filename );

        target = require( filename )

        /* register module */
        if( opts.register ) {
            console.log( "Register SiteModule".magenta.bold, opts.register );
            registeredSiteModules[ opts.register ] = target;
        }

        var router = express.Router();
        target.setup({
            website: website,
            ws: function() {
                console.log( "Websocket-Server".yellow.bold, arguments );
                k.app.ws.apply( this, arguments );
            },
            siteRequire: function _siteRequire( website, filename ) {

                var filepath = k.hierarchy.lookupFile( website, filename );
                if( filepath != null ) {
                    return require( "./" + filepath )
                }
                else
                    throw new Error( "siteRequire failed, '" + website + "' '" + filename + "' not found" );
            },
            siteModule: siteModule,
            useSiteModule: function( prefix, website, filename, opts ) {
                console.log( "USE".magenta.bold, website, filename );
                var subTarget = siteModule( website, filename, opts );
                router.use( prefix, subTarget.router );
            },
            exitHook: function _exitHook( callback ) {
                app.exitHooks.push( callback );
            },
            router: router,
            httpStatus: k.err.renderHttpStatus,
            serverConfig: serverConfig,
            prefixServeStatic: prefixServeStatic,
            serverStaticFile: function _serveStatic( filename ) {
                return function( req, res ) {
                    var filepath = k.hierarchy.lookupFileThrow( req.kern.website, filename );
                    res.sendfile( filepath );
                }
            },
            hierarchyRoot: function( website ) {
                var root = k.hierarchy.website( kernOpts.websitesRoot, website );
                if( root )
                    return path.join( kernOpts.websitesRoot, root );
                else
                    return null;
            },
            readHierarchyDir: function( website, dirname, callback ) {
                var dirpath = hierarchy.lookupFile( kernOpts.websitesRoot, website, dirname );
                if( dirpath == null )
                    return callback( new Error( "Dir not found" ) );
                fs.readdir( dirpath, callback );
            },
            readHierarchyFile: function( website, filenames, callback ) {
                if( !_.isArray( filenames ) )
                    filenames = [ filenames ];
                
                async.mapSeries( filenames, function( filename, d ) {
                    var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, filename );
                    if( filepath == null )
                        return d( new Error( filename + " not found" ) );
                    fs.readFile( filepath, 'utf8', d );

                }, callback );
            },
            createHierarchyReadStream: function( website, filename ) {
                var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, filename );
                if( filepath == null )
                    return null;
                return fs.createReadStream( filepath );
            },
            renderJade: app.renderJade,
            rdb: rdb,
            kernOpts: kernOpts,
            hostname: os.hostname(),
            getWebsiteConfig: function( key, defaultValue ) {
                var value = k.siteConfig.get( website, key, defaultValue );
                console.log( "getWebsiteConfig", website, key, value, defaultValue )
                console.log( websiteConfigs[ website ] ); 
                console.log( websiteConfigs );
                return value;
            },
            reg: function( name ) {
                return registeredSiteModules[ name ];
            }
        });

        /* app requires cleanup */
        if( target.exit )
            app.exitHooks.push( target.exit );

        /* attach new router */
        target.router = router;
        return target;
    };

    return {
        load: load,
        getOrLoad: getOrLoad,
        routeRequestStart: routeRequestStart,
        module: module
    }
}
