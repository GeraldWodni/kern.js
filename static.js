// static content + less processing
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var url         = require("url");
var fs          = require("fs");
var path        = require("path");
var mkdirp      = require("mkdirp");
var less        = require("less");
var imageMagick = require("gm").subClass({imageMagick: true});

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

    function prefixCache( prefix, originPrefix, generator ) {
        k.app.get( prefix + "*", function( req, res, next ) {
            /* capture esacape attempts */
            guard( prefix, req, res, function( prefixOkay, pathname ) {
                if( prefixOkay ) {
                    /* get original and cache-filename */
                    pathname = pathname.replace( new RegExp( "^" + prefix ), originPrefix );
                    var filepath = k.hierarchy.lookupFileThrow( req.kern.website, pathname );
                    var cachepath = filepath.replace( /^websites\//, "cache" + prefix );

                    /* file cached? */
                    fs.exists( cachepath, function( cacheExists ) {
                        /* send cached image */
                        if( cacheExists )
                            return res.sendfile( cachepath );

                        /* create cache directory */
                        mkdirp( path.dirname( cachepath ), function( err ) {
                            if( err )
                                return next( err );

                            generator( filepath, cachepath, function( err ) {
                                console.log( "Generator-ERROR: ", err );
                                if( err )
                                    return next( err );

                                res.sendfile( cachepath );
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
        k.app.get("/css/*", function _static_less( req, res, next ) {

            var filename = req.path.substring( 5 );
            var filepath = k.hierarchy.lookupFile( req.kern.website, path.join( 'css', filename ) );

            /* static css found, serve it */
            if( filepath != null )
                return res.sendfile( filepath );

            /* dynamic less */
            filepath = k.hierarchy.lookupFile( req.kern.website, path.join( 'css', filename.replace( /\.css$/g, '.less' ) ) );
            if( filepath == null )
                return next();

            lessCache.get( filepath, function( err, data ) {

                if( err )
                    return next( err );

                if( data ) {
                    res.set( 'Content-Type', 'text/css' );
                    res.send( data );
                    return;
                }

                fs.readFile( filepath, 'utf8', function( err, data ) {
                    if( err ) 
                        return next( err );

                    /* parse less & convert to css */
                    less.render( data.toString(), {
                        filename: filepath,
                        paths: k.hierarchy.paths( req.kern.website, 'css' )
                    })
                    .then( output => {
                        res.set( 'Content-Type', 'text/css' );
                        res.send( output.css );
                        console.log( "LESS-OK:".bold.green, filepath, output.imports );
                        lessCache.set( {
                            filename: filepath,
                            dependencies: output.imports
                        }, output.css );
                    })
                    .catch( err => {
                        console.log( "LESS-Error".bold.red, err.toString() );
                        next( err );
                    });
                });

            });
        });
        k.app.get("/css/:directory/:file", function _static_css_dir( req, res, next ) {
            serveStatic( "css/" + req.requestman.filename( 'directory' ), req, res );
        });
    }

    return {
        prefixServeStatic: prefixServeStatic,
        single: single,
        route: route
    }
}
