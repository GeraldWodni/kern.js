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

    $(".crud-search .btn").click( function() {
        var $list = $(this).closest(".crud-list");
        $list.find(".crud-search input").val("");
        $list.find(".crud-item").show();
    });
});
