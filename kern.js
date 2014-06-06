var cluster = require("cluster");
//var hub = require("clusterhub");
var os = require("os");
var http = require("http");
var _ = require("underscore");

/* default value for kern instances */
var defaults = {
    port: 3000
    // processCount: specify the number of worker-processes to create
};

/* main export */
var Kern = function( opts ) {
    
    opts = _.extend( defaults, opts );
    var status = {
        workerId: cluster.isMaster ? 0 : cluster.worker.id
    };

    function debug() {
        console.log.apply( this, arguments );
    };

    function worker() {
        http.createServer( function( req, res ) {
            res.writeHead( 200, { 'Content-Type': 'text/plain' } );
            res.end( "Hello, here is kern.js [" + status.workerId + "]" );
            debug( "GET, " + status.workerId );
        }).listen( opts.port );
    }

    return {
        debug: debug,
        worker: worker,
        status: status,
        run: function() {

            if( cluster.isMaster ) {
                /* form workers */
                var processCount = opts.processCount || os.cpus().length;
                debug( "Master, starting " + processCount + " workers" );
                for( var i = 0; i < processCount; i++ )
                    cluster.fork();

            } else {
                /* worker */
                debug( "Worker on Port " + opts.port + ", id:" + status.workerId );
                worker();
            }
        }
    };
};

module.exports = Kern;

