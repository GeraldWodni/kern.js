const file = document.querySelector("input[type='file']");
const imagesPreview = document.querySelector("#images");
file.addEventListener( "change", evt => {
    imagesPreview.innerHTML = "";
    for(let file of evt.target.files) {
        const objectUrl = URL.createObjectURL( file );
        if( file.type.indexOf("image") == 0 )
            imagesPreview.insertAdjacentHTML( 'beforeend', `<img src="${objectUrl}" alt="${file.name}"/>` );
        else
            imagesPreview.insertAdjacentHTML( 'beforeend', `<object data="${objectUrl}" type="${file.type}" alt="${file.name}"/>` );
    }
});
