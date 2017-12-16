$(function() {
    var $overlay = $("#album-overlay");
    var $a = null; /* last clicked preview link */

    /* load image of current a */
    function loadImage() {
        $overlay.css( "background-image", "url(" + $a.attr("data-album-image") + ")" );
    }

    $(".album a").click(function(evt) {
        evt.preventDefault();
        $a = $(this);

        loadImage();
        $overlay.css( "display", "block" );
    });

    $overlay.find(".prev").click( function(evt) {
        evt.preventDefault();
        var $prevA = $a.closest("li").prev("li").find("a");
        if( $prevA.length == 1 )
            $a = $prevA;
        else
            /* wrap around */
            $a = $a.closest("ul").find("li").last().find("a");
        loadImage();
    });

    $overlay.find(".next").click( function(evt) {
        evt.preventDefault();
        var $nextA = $a.closest("li").next("li").find("a");
        if( $nextA.length == 1 )
            $a = $nextA;
        else
            /* wrap around */
            $a = $a.closest("ul").find("li:eq(0)").find("a");
        loadImage();
    });

    $overlay.find(".close").click( function(evt) {
        evt.preventDefault();
        $overlay.css( "display", "none" );
    });
});
