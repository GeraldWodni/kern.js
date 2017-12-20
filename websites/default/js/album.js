$(function() {
    var $overlay = $("#album-overlay");
    var $btnPrev = $overlay.find(".prev");
    var $btnNext = $overlay.find(".next");
    var $btnClose= $overlay.find(".close");
    var $btnDownload = $overlay.find(".download");
    var $a = null; /* last clicked preview link */

    var preLoadImg = null; /* preLoad handle, only one and global for easy garbage collection */

    function preLoad( $preA ) {
        var preLoadImg = new Image();
        preLoadImg.src = $preA.attr("data-album-image");
    }

    /* load image of current a */
    function loadImage( $btn ) {
        var url = $a.attr("data-album-image");

        /* download button target */
        $btnDownload.attr( "href", $a.attr("data-album-download") );

        /* TODO: show loading dail instead of chevron */
        var img = new Image();
        img.src = url;
        /* not loaded: display wait-spinner */
        if( img.naturalWidth === 0 ) {
            $btn.addClass("loading");
            img.onload = function() {
                $overlay.css( "background-image", "url(" + url + ")" );
                $btn.removeClass("loading");
            }
        }
        /* already loaded: just display */
        else
            $overlay.css( "background-image", "url(" + url + ")" );
    }

    $(".album a").click(function(evt) {
        evt.preventDefault();
        $a = $(this);

        loadImage( $btnNext.add( $btnPrev ) );
        $overlay.css( "display", "block" );
        preLoad( nextLink( $a ) );
    });

    function prevLink( $current ) {
        var $prev = $current.closest("li").prev("li").find("a");
        if( $prev.length == 1 )
            return $prev;
        else
            /* wrap around */
            return $current.closest("ul").find("li").last().find("a");
    }

    function nextLink( $current ) {
        var $next = $current.closest("li").next("li").find("a");
        if( $next.length == 1 )
            return $next;
        else
            /* wrap around */
            return $current.closest("ul").find("li:eq(0)").find("a");
    }

    $btnPrev.click( function(evt) {
        evt.preventDefault();
        $a = prevLink( $a );
        loadImage( $btnPrev );
        preLoad( prevLink( $a ) );
    });

    $btnNext.click( function(evt) {
        evt.preventDefault();
        $a = nextLink( $a );
        loadImage( $btnNext );
        preLoad( nextLink( $a ) );
    });

    $btnClose.click( function(evt) {
        evt.preventDefault();
        $overlay.css( "display", "none" );
    });
});
