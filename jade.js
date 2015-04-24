// jade caching and rendering
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var url     = require("url");
var path    = require("path");

module.exports = function _jade( k, opts ) {

    var jadeCache = {};

    /* TODO: make cache Website-aware! (login.jade:flink vs. login.jade:echo) */
    function renderJade( req, res, filename, locals, opts ) {

        opts = opts || {};
        /* allow website override */
        var website = req.kern.website;
        if( opts.website )
            website = opts.website;

        console.log( "Render: ".grey, website.green, filename.cyan );

        /* compile template */
        var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, path.join( kernOpts.viewFolder, filename + '.jade' ) );
        if( !filepath ) {
            var message = "Unable to locate view " + filename + " in " + website;
            res.status(500).end( message );
            throw new Error( message.bold.red );
        }

        locals = _.extend( locals || {}, {
            __: req.locales.__,
            __locale: req.locales,
            _: _,
            os: os
        });

        if( filepath in app.jadeCache ) {
            console.log( "Jade Cachehit ".grey, filename.cyan, website.grey );
            return res.send( app.jadeCache[ filepath ]( locals ) );
        }


        _.extend( opts, {
            filename: filepath,
            kernWebsite: website,
            pretty: k.siteConfig.get( website, "jadePrettyPrint", true )
        } );

        fs.readFile( filepath, 'utf8', function( err, data ) {
            if( err ) {
                console.log( err );
                res.send("ERROR: " + err );
                return;
            }

            /* store dependencies */
            var dependencies = [ filepath ];
            /* override jade's resolvePath to use kern-hierarchy */
            jade.Parser.prototype.resolvePath = function (filename, purpose) {
                var callerFile = this.filename;
                var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( '/views/' ) + '/views/'.length ) );

                var file = hierarchy.lookupFileThrow( kernOpts.websitesRoot, this.options.kernWebsite, path.join( kernOpts.viewFolder, path.join( callerDir, filename + '.jade' ) ) );
                dependencies.push( file );
                return file;
            };

            /* compile (synced) */
            var compiledJade = jade.compile( data, opts );

            /* store in cache */
            if( kernOpts.cacheJade ) {
                app.jadeCache[ filepath ] = compiledJade;

                dependencies = _.uniq( dependencies );

                /* remove from cache on dependency change */
                var watchers = [];
                dependencies.forEach( function( filename ) {
                    var watcher = fs.watch( filename, function() {
                        console.log( "Jade Changed".grey, filepath.yellow, website.grey );
                        delete app.jadeCache[ filepath ];

                        /* close all watchers for root file */
                        watchers.forEach( function( watcher ) { watcher.close() } );
                    });
                    watchers.push( watcher );
                });
            }

            var html = compiledJade( locals );
            console.log( "Jade Rendered ".grey, filename.green, website.grey );
            res.send( html );
        });
    };

    return {
        render: renderJade
    }
}
