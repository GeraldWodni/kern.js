// upload and manage media files
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var async   = require("async");
var util    = require("util");
var _       = require("underscore");

module.exports = {
    setup: function( k ) {

        function readTree( dirpath, callback ) {
            var tree = { dirs: {}, files: [] };

            var treeQueue = async.queue( function( task, next ) {

                fs.readdir( task.dirpath, function( err, filenames ) {
                    if( err )
                        return next( err );

                    console.log( "DIR:".yellow, task.dirpath, "FILES:", filenames );

                    async.mapSeries( filenames, function( filename, d ) {
                        var filepath = path.join( task.dirpath, filename );
                        console.log( err, filepath ); 
                        fs.stat( filepath, function( err, stat ) {
                            if( err ) {
                                console.log( "ERROR-INDIDID".red.bold, err );
                                return d( err );
                            }

                            if( stat.isDirectory() ) {
                                var newTree = { dirs: {}, files: [] };
                                task.tree.dirs[ filename ] = newTree;
                                console.log( "spawn DIR".yellow, filepath );
                                treeQueue.push( { dirpath: filepath, tree: newTree } );
                            }
                            else {
                                task.tree.files.push( path.basename( filepath ) );
                                console.log( "file".magenta, filepath );
                            }
                            d();
                        });
                    }, next );
                });
            });

            treeQueue.drain = function( err ) {
                console.log( "DRAIN".bold.green, err, tree );
                callback( err, tree );
            };
            treeQueue.push( { dirpath: dirpath, tree: tree } );
        }

        k.router.get( "/", function( req, res, next ) {
            var testPath = path.join( __dirname, "../../test" );
            readTree( testPath, function( err, tree ) {
                if( err )
                    console.log( "ERROR".bold.red, err );
                console.log( util.inspect( tree, { colors: true, depth: null } ) );
            });
            k.jade.render( req, res, "admin/media", k.reg("admin").values( req, {} ) );
        });
    }
};
