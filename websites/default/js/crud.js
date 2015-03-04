$(function(){
    $(".crud-search input").keyup( function() {
    	/* replace all whitespace by singe space */
        var search = $(this).val().replace(/\s+/g, ' ');
	/* merge into non-consuming regex, (?=.*<expr>) */
	search = _.reduce( search.split(" "), function( memo, word ) {
            if( word.length > 0 )
                return memo + "(?=.*" + word + ")";
            else
                return memo;
        },"");

        search = "^" + search + ".*$";

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

    if($(".crud-items").hasClass("col-sm-4"))
        $(".crud-search .crud-expand i.glyphicon-chevron-left").hide();
    else
        $(".crud-search .crud-expand i.glyphicon-chevron-right").hide();

    $(".crud-search .crud-expand").click( function(){
        $(this).closest(".crud-items").toggleClass("col-sm-4", 600);
        $(this).closest(".crud-items").siblings(".crud-fields").toggleClass("col-sm-8", 600);
        $(".crud-search .crud-expand i.glyphicon").toggle();
    });
});
