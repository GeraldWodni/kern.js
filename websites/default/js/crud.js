$(function(){
    $(".crud-search input").keyup( function() {
        var search = $(this).val();

        $(this).closest(".crud-list").find(".crud-item").each(function( index, item ) {
            var $item = $(item);
            var visibility = $item.text().search( new RegExp( search, "i" ) ) >= 0;

            if( $item.is(":visible") != visibility )
                if( visibility )
                    $item.show();
                else
                    $item.hide();
        });
    });

    $(".crud-search .crud-show-all").click( function() {
        var $list = $(this).closest(".crud-list");
        $list.find(".crud-search input").val("");
        $list.find(".crud-item").show();
    });

    $(".crud-search .crud-expand i.glyphicon-chevron-left").hide();

    $(".crud-search .crud-expand").click( function(){
        var $items = $(this).closest(".crud-items");
        $items.toggleClass("col-sm-4", 600);
        $(".crud-search .crud-expand i.glyphicon").toggle();
    });
});
