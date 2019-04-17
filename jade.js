// jade caching and rendering
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var jade    = require("jade");
var fs      = require("fs");
var path    = require("path");
var os      = require("os");
var moment  = require("moment");
var marked  = require("marked");
var _       = require("underscore");

module.exports = function _jade( k, opts ) {

    var jadeCache = {};

    /* TODO: make cache Website-aware! (login.jade:flink vs. login.jade:echo) */
    function renderJade( req, res, filename, locals, opts, callback ) {

        opts = opts || {};
        /* allow website override */
        var website = req.kern.website;
        if( opts.website )
            website = opts.website;

        console.log( "Render: ".grey, website.green, filename.cyan );

        /* compile template */
        var filepath = k.hierarchy.lookupFile( website, path.join( k.kernOpts.viewFolder, filename + '.jade' ) );
        if( !filepath ) {
            var message = "Unable to locate view " + filename + " in " + website;
            res.status(500).end( message );
            throw new Error( message.bold.red );
        }

        moment.fn.sqlFormat = function() {
            return this.format( "YYYY-MM-DD HH:mm:ss" );
        }

        var _filename = path.parse(filepath).name;
        var _bodyClass = req.baseUrl.replace( /^.*\//, '' );
        if( _filename == "login" || req.baseUrl == "/admin" )
            _bodyClass = _filename;

        locals = _.extend( locals || {}, {
            __: req.locales.__,
            _n: req.locales._n,
            _date: function( d ) { return moment( d ).format( req.locales.__( "date-format-moment" ) ); },
            __locale: req.locales,
            _: _,
            _filename: _filename,
            _bodyClass: _bodyClass,
            _baseUrlPath: req.baseUrl,
            _originalUrl: req.originalUrl.replace(/\?.*$/, ''),
            _loggedInUsername: req.session ? req.session.loggedInUsername : null,
            moment: moment,
            marked: marked,
            hostname: os.hostname()
        });

        var cachePath = req.kern.website + "--" + filepath;
        if( cachePath in jadeCache ) {
            console.log( "Jade Cachehit ".grey, filename.cyan, website.grey );
            return callback( null, jadeCache[ cachePath ]( locals ) );
        }

        _.extend( opts, {
            filename: filepath,
            kernWebsite: website,
        } );
        _.defaults( opts, {
            pretty: k.siteConfig.get( website, "jadePrettyPrint", true )
        } );

        fs.readFile( filepath, 'utf8', function( err, data ) {
            if( err ) {
                console.log( err );
                return callback( err );
            }

            /* store dependencies */
            var dependencies = [ filepath ];
            /* override jade's resolvePath to use kern-hierarchy */
            jade.Parser.prototype.resolvePath = function (filename, purpose) {
                var callerFile = this.filename;
                var viewsDir = path.sep + 'views' + path.sep;
                var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( viewsDir ) + viewsDir.length ) );

                /* only append jade to non-suffixed includes */
                if( filename.indexOf(".") < 2 )
                    filename = filename + ".jade";

                var file = k.hierarchy.lookupFileThrow( this.options.kernWebsite, path.join( k.kernOpts.viewFolder, path.join( callerDir, filename ) ) );
                dependencies.push( file );
                return file;
            };

            /* compile (synced) */
            var compiledJade = jade.compile( data, opts );

            /* store in cache */
            if( k.kernOpts.cacheJade ) {
                jadeCache[ cachePath ] = compiledJade;

                dependencies = _.uniq( dependencies );

                /* remove from cache on dependency change */
                var watchers = [];
                dependencies.forEach( function( filename ) {
                    var watcher = fs.watch( filename, function() {
                        console.log( "Jade Changed".grey, filepath.yellow, website.grey );
                        delete jadeCache[ cachePath ];

                        /* close all watchers for root file */
                        watchers.forEach( function( watcher ) { watcher.close() } );
                    });
                    watchers.push( watcher );
                });
            }

            var html = compiledJade( locals );
            console.log( "Jade Rendered ".grey, filename.green, website.grey );
            callback( null, html );
        });
    };

    function renderAndSend( req, res, filename, locals, opts ) {
        renderJade( req, res, filename, locals, opts, function( err, html ) {
            if( err )
                res.send( "ERROR: " + err );
            else
                res.send( html );
        });
    }

    return {
        render: renderAndSend,
        renderToString: renderJade
    }
}
