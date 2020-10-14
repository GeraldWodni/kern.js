// static content + less processing
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var url         = require("url");
var fs          = require("fs");
var path        = require("path");
var mkdirp      = require("mkdirp");
var less        = require("less");
var imageMagick = require("gm").subClass({imageMagick: true});
var _           = require("underscore");

module.exports = function _static( k, opts ) {

    var guardRegex = new RegExp( '\\' + path.sep, 'g' );
    function guard( prefix, req, res, callback ) {

        /* normalize to os-independent path */
        var pathname = url.parse( req.url ).pathname;
        pathname = path.normalize( pathname );
        pathname = pathname.replace( guardRegex, '/' );

        /* contain in directory */
        if( pathname.indexOf( ".." ) >= 0 )
            return k.err.renderHttpStatus( req, res, 403 );

        callback( pathname.indexOf( prefix ) == 0, pathname );
    };

    function prefixServeStatic( router, prefix ) {
        router.use( function( req, res, next ) {
            guard( prefix, req, res, function( prefixOkay, pathname ) {
                if( prefixOkay ) {
                    var filepath = k.hierarchy.lookupFileThrow( req.kern.website, pathname );
                    return res.sendfile( filepath );
                }
                next();
            });
        });
    };

    /* serve static content like images and javascript */
    function serveStatic( directory, req, res ) {
        var filename = req.requestman.filename( 'file' );
        var filepath = k.hierarchy.lookupFileThrow( req.kern.website, path.join( directory, filename ) );

        res.header("Cache-Control", "max-age=" + 12*60*60);
        res.sendfile( filepath );
    };

    function prefixCache( prefix, originPrefix, generator, opts ) {
        opts = opts || {};
        (opts.router || k.app).get( prefix + "*", function( req, res, next ) {
            /* capture esacape attempts */
            guard( prefix, req, res, function( prefixOkay, pathname ) {
                if( prefixOkay ) {
                    /* rename source */
                    var targetExtension = path.extname( pathname );
                    if( opts.sourceExtension )
                        pathname = pathname.slice( 0, -targetExtension.length ) + opts.sourceExtension;

                    /* get original and cache-filename */
                    pathname = pathname.replace( new RegExp( "^" + prefix ), originPrefix );
                    var filepath = k.hierarchy.lookupFileThrow( req.kern.website, pathname );
                    var cachepath = filepath.replace( /^websites\//, "cache" + prefix )

                    /* rename target (from hierarchy path to be safe) */
                    if( opts.sourceExtension )
                        cachepath = cachepath.slice( 0, -opts.sourceExtension.length ) + targetExtension;

                    /* file cached? */
                    fs.stat( cachepath, function( err, cacheStat ) {
                        function sendIt() {
                            if( opts.contentType )
                                res.header( 'Content-Type', opts.contentType );
                            const fullpath = path.join( k.kernOpts.rootFolder, cachepath );
                            res.sendFile( fullpath );
                        }

                        /* exists -> check age */
                        if( err == null )
                            return fs.stat( filepath, function( err, fileStat ) {
                                /* send cached file */
                                if( err || fileStat.mtimeMs <= cacheStat.mtimeMs )
                                    return sendIt();

                                /* generate */
                                console.log( "Refresh prefixCache: " + filepath );
                                generator( filepath, cachepath, function( err ) {
                                    if( err ) {
                                        console.log( "GeneratorRefresh-ERROR: ", err );
                                        return next( err );
                                    }

                                    sendIt();
                                });

                            });

                        /* create cache directory */
                        mkdirp( path.dirname( cachepath ), function( err ) {
                            if( err )
                                return next( err );

                            generator( filepath, cachepath, function( err ) {
                                if( err ) {
                                    console.log( "Generator-ERROR: ", err );
                                    return next( err );
                                }

                                sendIt();
                            });
                        });

                    });
                }
                else
                    next();
            });
        });
    }

    function single(filename, mimeType) {
        return function( req, res, next ) {
            var file = k.hierarchy.createReadStream( req.kern.website, filename );
            res.header('Content-Type', mimeType);
            file.pipe( res );
        }
    }

    function route() {
        prefixCache( "/images-preview/", "/images/", function( filepath, cachepath, next ) {
            imageMagick( filepath )
                .autoOrient()
                .resize( 200, 200 + "^" )
                .gravity( "Center" )
                .extent( 200, 200 )
                .write( cachepath, next );
        });

        prefixCache( "/images-gallery/", "/images/", function( filepath, cachepath, next ) {
            imageMagick( filepath )
                .autoOrient()
                .resize( 1024, 1024 )
                .write( cachepath, next );
        });

        k.app.get("/images-download/*", function( req, res, next ) {
            /* add disposition header and route to image */
            req.url = req.url.replace( /^\/images\-download\//, "/images/" );
            res.header("Content-Disposition", path.basename( req.url ));
            next();
        });

        prefixServeStatic( k.app, "/images/" );


        prefixCache( "/files-preview/", "/files/", function( filepath, cachepath, next ) {
            var extension = path.extname( filepath );
            if( [".jpg", ".jpeg", ".png", ".gif"].indexOf( extension ) < 0 )
                return next( new Error( `Unsupported file type '${extension}'` ) );

            imageMagick( filepath )
                .autoOrient()
                .resize( 200, 200 + "^" )
                .gravity( "Center" )
                .extent( 200, 200 )
                .write( cachepath, next );
        });

        k.app.get("/files-download/*", function( req, res, next ) {
            req.url = req.url.replace( /^\/files\-download\//, "/files/" );
            res.header("Content-Disposition", path.basename( req.url ));
            next();
        });

        prefixServeStatic( k.app, "/media/" );

        //app.get("/images/:file", function( req, res, next ) {
        //    serveStatic( "images", req, res );
        //});

        k.app.get("/js/:file", function _static_js( req, res, next ) {
            serveStatic( "js", req, res );
        });
        k.app.get("/js/:directory/:file", function _static_js_dir( req, res, next ) {
            serveStatic( "js/" + req.requestman.filename( 'directory' ), req, res );
        });

        k.app.get("/fonts/:file", function _static_fonts( req, res, next ) {
            serveStatic( "fonts", req, res );
        });

        /* less, circumvent path-processing */
        var lessCache = k.cache( "less" );
        function lessRequest( prefix, preloader, plugins = ( req => [] ) ) {
            return function _lessRequest( req, res, next ) {
                var filename = req.path.substring( prefix.length );
                var filepath = k.hierarchy.lookupFile( req.kern.website, path.join( 'css', filename ) );

                /* static css found, serve it */
                if( filepath != null )
                    return res.sendfile( filepath );

                /* dynamic less */
                filepath = k.hierarchy.lookupFile( req.kern.website, path.join( 'css', filename.replace( /\.css$/g, '.less' ) ) );
                if( filepath == null )
                    return next();

                lessCache.get( { filename: filepath, website: req.kern.website }, function( err, data ) {

                    if( err )
                        return next( err );

                    if( data ) {
                        res.set( 'Content-Type', 'text/css' );
                        res.send( data );
                        return;
                    }

                    new Promise( (fulfill, reject) => {
                        fs.readFile( filepath, 'utf8', ( err, data ) => {
                            if( err )
                                reject( err );
                            else
                                fulfill( data );
                        });
                    })
                    .then( data => {
                        if( preloader )
                            return preloader( req, data );
                        return Promise.resolve( data );
                    })
                    .then( (data) => {
                        /* parse less & convert to css */
                        return less.render( data.toString(), {
                            filename: filepath,
                            paths: k.hierarchy.paths( req.kern.website, 'css' ),
                            plugins: plugins( req )
                        });
                    })
                    .then( output => {
                        res.set( 'Content-Type', 'text/css' );
                        res.send( output.css );
                        console.log( "LESS-OK:".bold.green, filepath, output.imports );
                        lessCache.set( {
                            filename: filepath,
                            website: req.kern.website,
                            dependencies: output.imports
                        }, output.css );
                    })
                    .catch( err => {
                        console.log( "LESS-Error".bold.red, err.toString() );
                        next( err );
                    });
                });
            };
        }

        k.app.get("/css/dynamic/*", lessRequest( "/css/dynamic/",
            function _preloader( req, data ) {
                return new Promise( (fulfill, reject) => {
                    k.site.getTarget( req, (err, _website) => {
                        req.kern.adminMenu = req.kern.site.registeredSiteModules["admin"].getMenu( req, { showAll: true } );
                        if( err ) return reject( err );
                        fulfill( data );
                    })
                });
            },
            function _plugins( req ) {
                return [{
                    install: ( l, pM, f ) => {
                        f.add( "kernAdminMenu", () => new l.tree.Value( _.pluck( req.kern.adminMenu, "link" ) ) );
                        f.add( "kernAdminMenuPropery", ( link, keys, defaultValue ) => {
                            link = link.value; keys = keys.value.split(".");
                            var item = _.find( req.kern.adminMenu, item => item.link == link );
                            var value = item;
                            while( keys.length ) {
                                var key = keys.shift();
                                if( _.has( value, key ) )
                                    value = value[key];
                                else
                                    return defaultValue;
                            }

                            return value;
                        });
                    }
                }]
            }
        ));
        k.app.get("/css/*", lessRequest( "/css/" ) );
        k.app.get("/css/:directory/:file", function _static_css_dir( req, res, next ) {
            serveStatic( "css/" + req.requestman.filename( 'directory' ), req, res );
        });
    }

    return {
        prefixServeStatic: prefixServeStatic,
        prefixCache: prefixCache,
        single: single,
        route: route
    }
}
