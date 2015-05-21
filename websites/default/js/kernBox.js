/* imageBox using bootstrap dialog, GPLv3 */
/* (c)copyright 2014 by Gerald Wodni */

$.fn.kernBox = function ( opts ) {

    var $triggers = this;

    opts = $.extend( { padding: 20, ratio: 0.9, wrap: true, src: "src", originalSrc: "src", minWidth: 600, responsiveXS: 768, useHammer: true }, opts );

    var targetModal = $("#" + opts.modal);
    var $prev = targetModal.find(".prev");
    var $next = targetModal.find(".next");
    var mc = null;

    function loadImage( src, originalSrc, done ) {
    	console.log( "loadImage", src, originalSrc );

        var headerHeight = targetModal.find(".modal-header").outerHeight() + targetModal.find(".modal-footer").outerHeight();

        var maxW = targetModal.width() * opts.ratio;
        var maxH = targetModal.height() * opts.ratio - headerHeight;
        var padding = opts.padding;

	var responsiveMode = $(window).width() < opts.responsiveXS;
        var title = src.substr(src.lastIndexOf("/") + 1);

        var image = new Image();
        image.onload = function() {
            var w = this.width;
            var h = this.height;
            var iw, ih;

            if( maxW/maxH > w/h ) {
                ih = maxH - padding * 2;
                iw = ih * w / h;
            }
            else {
                iw = maxW - padding * 2;
                ih = iw * h / w;
            }

	    if( responsiveMode ){
	    	maxW = $(window).width() * 0.9;

	    	if( iw > maxW ) {
	    		console.log( "RESPMODE!");
			iw = maxW - padding * 2;
			ih = iw * h / w;
		}
	    }

            image.width = iw;
            image.height = ih;

	    targetModal.find(".cover-image").height( ih ).css("line-height", ih + "px");

            targetModal.find(".modal-content").animate( {
                width: Math.max( iw + padding * 2, responsiveMode ? 0 : opts.minWidth ),
                height: ih + padding * 2 + headerHeight
            }, { queue: false } );

            targetModal.find(".modal-dialog").animate( {
                width: Math.max( iw + padding * 3, responsiveMode ? 0 : opts.minWidth )
            }, { queue: false } );
            $prev.animate( {
                height: ih,
                "line-height": ih
            }, { queue: false } );
            $next.animate( {
                height: ih,
                "line-height": ih
            }, { queue: false } );

            if( iw + padding * 2 < opts.minWidth )
                $prev.add( $next ).addClass( "invert" );
            else
                $prev.add( $next ).removeClass( "invert" );

            targetModal.find(".modal-body img").remove();
            targetModal.find(".modal-body").append( image );

            targetModal.find(".modal-title").text(title);
            if( typeof done === "function" )
                done( image );
        };
        image.src = src;
	$(".download").attr("href", originalSrc).attr("download", title );
    }

    function indexOf( $element ) {
        var matchedIndex = -1;

        $triggers.each( function( index, element ) {
            if( $element.is( element ) )
                matchedIndex = index;
        });

        return matchedIndex;
    }

    function move( $trigger, forward ) {
        var index = indexOf( $trigger );
        var moveIndex = - 1;

        if( !forward ) {
            if( index - 1 >= 0 )
                moveIndex = index - 1;
            else if( opts.wrap )
                moveIndex = $triggers.length - 1;
        }
        else {
            if( index + 1 < $triggers.length )
                moveIndex = index + 1;
            else if( opts.wrap )
                moveIndex = 0;
        }

        if( moveIndex >= 0 )
            fireTrigger( $triggers.eq( moveIndex ) );
    }

    function fireTrigger( $trigger ) {

        if( !mc && opts.useHammer ) {
            mc = new Hammer.Manager( targetModal.get(0), {
                recognizers: [[Hammer.Swipe, { direction: Hammer.DIRECTION_HORIZONTAL }]]
            });
        }

        if( $trigger.length == 0 )
            return;

        if( typeof opts.change === "function" )
            opts.change( $trigger, targetModal );

        $triggers.removeClass("selected");
        $trigger.addClass("selected");

        targetModal.modal("show");

        var src = $trigger.attr(opts.src);
	var originalSrc = $trigger.attr(opts.originalSrc);
    	console.log( "originalSrc", opts.originalSrc, originalSrc );
        targetModal.find(".modal-title").text("Loading...");
        loadImage( src, originalSrc, function( image ) {
            var $image = $(image);
            $image.unbind().click(function(e) {
                var offset = $image.offset();
                var x = e.clientX - offset.left;
                move( $trigger, x >= image.width / 2 );
            });

            $prev.unbind().click(function(){ move( $trigger, false ); } );
            $next.unbind().click(function(){ move( $trigger, true ); } );

            $(document).unbind("keydown").keydown( function(evt) {
                /* only catch keys on opened modal */
                if(!targetModal.hasClass("in"))
                    return;

                if( evt.which == 27 ) {
                    targetModal.modal("hide");
                    evt.preventDefault();
                }
                else if( evt.which == 37 || evt.which == 38 ) {
                    move( $trigger, false );
                    evt.preventDefault();
                }
                else if( evt.which == 39 || evt.which == 40 ) {
                    move( $trigger, true );
                    evt.preventDefault();
                }
            });

            /* update swipe events */
            if( opts.useHammer ) {
                mc.off("swipeleft");
                mc.on("swipeleft", function( evt ) { move( $trigger, false ); });
                mc.off("swiperight");
                mc.on("swiperight", function( evt ) { move( $trigger, true ); });
            }
        });
    };

    return this.each( function() {
        var $this = $(this);
        $this.click( function(evt) {
            evt.preventDefault();
            fireTrigger( $this );
        });
    });
};

