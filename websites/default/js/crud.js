$(function(){
    $(".crud-search input").keyup( function() {
            /* replace all whitespace by singe space */
        var search = $(this).val().replace(/\s+/g, ' ');
        var searchId = null;

        if( search.indexOf( "id:" ) == 0 ) {
            /* search for id */
            searchId = search.substring( 3 );
            search = "\/edit\/" + searchId + "($|\\?)";
        }
        else {
            /* merge into non-consuming regex, (?=.*<expr>) */
            search = _.reduce( search.split(" "), function( memo, word ) {
                if( word.length > 0 )
                    return memo + "(?=.*" + word + ")";
                else
                    return memo;
            },"");

            search = "^" + search + ".*$";
        }

        var regExp = new RegExp( search, "i" );

        $(this).closest(".crud-list").find(".crud-item").each(function( index, item ) {
            var $item = $(item);
            var visibility;
            
            if( searchId )
                visibility = $item.find("a.btn").attr("href").search( regExp ) >= 0;
            else
                visibility = $item.text().replace(/[\n\r]/g, " ").search( regExp ) >= 0;

            if( true || $item.is(":visible") != visibility )
                if( visibility )
                    $item.show();
                else
                    $item.hide();
        });
    });

    $(".crud-search .crud-show-all").click( function() {
        var $list = $(this).closest(".crud-list");
        $list.find(".crud-search input").val("").trigger("keyup");
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

    /* ajax list */
    $(".crud-list[data-crud-ajax]").each(function( index, ul ) {
        var $ul = $(ul);
        var item = { name: "hallo" };
        var template = $("#listTemplate").html();
        var editUin = $(".deleteWrapper button[name='delete']");

        $.get( $ul.attr("data-crud-ajax"), function( data ) {
            console.log("Crud-Ajax:", editUin, data.length );
            var i = 0;

            function addItem() {
                var html = template.replace( /\$\{([a-zA-Z0-9]+)\}/g, function( match, key ) {
                    return data[i][key];
                });
                if( editUin )
                    html = html.replace( /class="/, 'class="hidden ' );
                ul.insertAdjacentHTML( "beforeend", html );
                return ++i < data.length;
            }

            function addItems() {
                for( var j = 0; j < 42; j++ )
                    if( !addItem() ) {
                        function showAll() {
                            $ul.find(".crud-loading").remove();
                            $ul.find(".list-group-item.hidden").removeClass("hidden");
                            $ul.find(".crud-search input").trigger("keyup");
                        }

                        /* not expanded, just show */
                        if($(".crud-items").hasClass("col-sm-4"))
                            showAll();
                        /* expanded, bind button */
                        else
                            $ul.find(".crud-loading").removeClass("loading").find("button").click( showAll );

                        $ul.trigger( "crudAjaxDone" );
                        return;
                    }
                window.requestAnimationFrame( function() {
                    /* extra delay to give other scripting a chance */
                    window.requestAnimationFrame( addItems );
                });
            }

            window.requestAnimationFrame( addItems );
        });
    });

});
