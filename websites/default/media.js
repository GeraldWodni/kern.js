// upload and manage media files
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var async   = require("async");
var util    = require("util");
var rmrf    = require("rmrf");
var multer  = require("multer");
var _       = require("underscore");

module.exports = {
    setup: function( k ) {

        /* options */
        const setupOpts = k.setupOpts || {};
        const view      = setupOpts.view || "admin/media";

        /* protection filters, TODO: allow overwrite per user-permission */
        const filterCache = {}
        function hierarchyFilters(req) {
            if( req.kern.website in filterCache ) {
                console.log( "CACHE:".bold.red, filterCache[ req.kern.website ] );
                return filterCache[ req.kern.website ];
            }

            const dirHideFilters = req.kern.getWebsiteConfig( "media.dirHideFilters", [] )
                .map( s => new RegExp( s.slice(0, -1), s.slice(-1) ) );

            return filterCache[ req.kern.website ] = {
                dirShowFilters:  [ /^\/images$/g, /^\/images\/.*/g, /^\/media$/g, /^\/media\/.*/g, /^\/files$/g, /^\/files\/.*/g ],
                dirHideFilters,
                fileShowFilters: [ /.*/g ],
                lockWebsite: true
            };
        };


        function sanitizePath( req, res, directoryPrefix ) {
            /* get link or compose of prefix and name */
            var link;
            if( req.postman.exists("link") )
                link = req.postman.link("link");
            else {
                var filename = req.postman.filename("name");
                var prefix = req.postman.link("prefix");
                link = path.join( prefix, filename );
            }

            /* get real paths */
            var websiteRoot = k.hierarchyRoot( req.kern.website );
            var filepath = path.normalize( path.join( websiteRoot, link ) );

            /* ensure same root */
            if( filepath.indexOf( path.join( websiteRoot, directoryPrefix ) ) != 0 ) {
                res.status( 403 ).send({success:false, cracker: true});
                return null;
            }

            return filepath;
        }

        k.router.post("/*", function( req, res, next ) {
            console.log( "POST" );
            var filename = req.params[0];
            req.kern.uploadedFiles = [];

            k.postman( req, res, { onFile: (field, file, name ) => {
                var name = k.filters.filename( name );
                if( name == "" ) {
                    file.on("data", ()=>{});
                    file.on("end", ()=>{});
                    return console.log( "Ignoring empty file" );
                }
                var filepath = path.join( "/", filename, k.filters.filename( name ) );
                if( k.hierarchy.checkDirname( req.kern.website, path.dirname( filepath ), hierarchyFilters(req) ) != null ) {
                    file.pipe( k.hierarchy.createWriteStream( req.kern.website, filepath ) );
                    req.kern.uploadedFiles.push( {
                        name: path.basename( filepath ),
                        extension: path.extname( filepath ),
                        link: filepath
                    });
                }
            }}, () => {
                var name     = req.postman.text("name");
                var filepath = path.join( "/", filename, k.filters.filename( name ) );
                console.log( "FILEPATH:", filepath.bold.red );

                if( req.postman.exists( "create-dir" ) ) {
                    console.log( "CD-FILEPATH:", filepath.bold.red, req.kern.website, hierarchyFilters(req) );
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters(req) );
                    if( filepath == null )
                        return k.httpStatus( req, res, 403 );
                    console.log( "CREATE-DIR", filepath );
                    fs.mkdir( filepath, function( err ) {
                        if( err ) return next( err );
                        renderAll( req, res, next );
                    });
                }
                else if( req.postman.exists( "delete-dir" ) ) {
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters(req) );
                    rmrf( filepath );
                    res.redirect( 301, path.dirname( path.join( "/admin/media", req.path ) ) );
                }
                else if( req.postman.exists( "delete-file" ) ) {
                    filepath = path.join( filepath, req.postman.filename( "delete-file" ) );
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters(req) );
                    fs.unlink( filepath, ( err ) => {
                        if( err ) return next( err );
                        renderAll( req, res, next );
                    });
                }
                else if( req.postman.exists( "upload-file" ) ) {
                    console.log("UPLOAD!".bold.yellow);
                    if( req.postman.exists( "ajax-upload" ) )
                        k.jade.renderToString( req, res, "fileUploads", { files: req.kern.uploadedFiles }, {}, function( err, html ) {
                            if( err )
                                return res.status(500).json( { error: true, message: err.toString() } );
                            res.status(200).json( { "success": true, uploadedFiles: req.kern.uploadedFiles, html: html } );
                        });
                    else
                        renderAll( req, res, next );
                }
                else {
                    console.log("Unknown POST-Action".bold.red);
                    return next( new Error( "Unknown POST-action" ) );
                }
            });
        });

        /* upload */
        /* TODO: fix for new multer-API */
        //k.router.use("/upload/*", multer({
        //    /* change target directory */
        //    changeDest: function _upload_changeDest( dest, req, res ) {
        //        var pathname = req.params[0];
        //        if( pathname.indexOf( "files/" ) != 0 ) {
        //            res.status( 403 ).send({success:false, cracker: true});
        //            return false;
        //        }
        //        return k.hierarchy.lookupFile( req.kern.website, pathname )
        //    },
        //    /* rename special chars */
        //    rename: function _upload_rename( fieldname, filename, req, res ) {
        //        return k.filters.renameFile( filename );
        //    }
        //}));

        /* render directory tree & files */
        function renderAll( req, res, next, values ) {
            k.hierarchy.readHierarchyTree( req.kern.website, "/", _.extend( {}, hierarchyFilters(req), {
                prefix: "/"
            }),
            async function( err, tree ) {
                if( err ) return next( err );
                //console.log( "TREE", tree );

                var currentPath = req.path;
                var node = tree;

                /* get files in current folder */
                if( currentPath != "/" ) {
                    try {
                        req.path.substr(1).split("/").forEach( ( part ) => {
                            if( !node || !node.dirs || !node.dirs[ part ] )
                                throw new Error( "Unknown Path" );
                            node = node.dirs[ part ];
                        });
                    } catch( err ) {
                        return next( err );
                    }
                }

                var currentFiles = [];
                node.files.forEach( function( file ) {
                    console.log( file );
                    file.extension = path.extname( file.name );
                    //file.link = path.join( "/media", file.link );
                    currentFiles.push( file );
                });

                const reqValues = setupOpts.reqValues || k.reg("admin").pValues;

                k.jade.render( req, res, view, reqValues( req, _.extend( {
                    tree: tree,
                    dirOptions: setupOpts.dirOptions,
                    currentPath: currentPath,
                    currentFiles: currentFiles
                }, await values ) ) );
            });
        }

        /* uploader expects json */
        k.router.post( "/upload/*", function( req, res, next ) {
            res.send( { success: false } );
        });

        k.router.get( "/*", function( req, res, next ) {
            renderAll( req, res, next );
        });
    }
};
