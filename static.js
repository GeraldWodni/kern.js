// static content + less processing
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var url         = require("url");
var fs          = require("fs");
var path        = require("path");
var mkdirp      = require("mkdirp");
var less        = require("less");
var imageMagick = require("gm").subClass({imageMagick: true});

module.exports = function _static( k, opts ) {

    function guard( prefix, req, res, callback ) {

        var pathname = url.parse( req.url ).pathname;
        pathname = path.normalize( pathname );
        //console.log( pathname );

        /* contain in directory */
        if( pathname.indexOf( ".." ) >= 0 )
            return k.app.renderHttpStatus( req, res, 403 );

        callback( pathname.indexOf( prefix ) == 0, pathname );
    };
    
    function prefixServeStatic( prefix ) {

        k.app.use( function( req, res, next ) {
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

        prefixServeStatic( "/images/" );

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
                    var parser = new less.Parser({
                        filename: filepath,
                        paths: k.hierarchy.paths( req.kern.website, 'css' )
                    });

                    console.log( filepath );

                    parser.parse( data, function( err, tree ) {
                        if( err )
                            return next( err );

                        var css = tree.toCSS();
                        res.set( 'Content-Type', 'text/css' );
                        res.send( css );
                        lessCache.set( filepath, css );
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
        route: route
    }
}
