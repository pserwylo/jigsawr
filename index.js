function selectStaticImage( imagePath ) {
	setupJigsaw();
	showImageBySrc( imagePath );
}

function init( config ) {
	if ( config != null ) {
		if ( config.hasOwnProperty( 'source' ) ) {
			if ( config.source == "static" ) {
				initStatic( config.images );
			} else {
				throw new Error( "Unknown image source: '" + config.source + "'" );
			}
		}
	}
}

function initStatic( images ) {
	if ( typeof images == 'undefined' || !( images instanceof Array ) ) {
		throw new Error( "Expected an array of static images" );
	} else {
		var ulTag = $( '<ul>').attr( 'id', 'staticImages' );
		for ( var i = 0; i < images.length; i ++ ) {
			var image = images[ i ];
			var liTag = $( '<li><a onclick="selectStaticImage( \'' + image.image + '\' );"><img src="' + image.thumbnail + '" /></a></li>' );
			ulTag.append( liTag );
		}
		$( 'form').append( ulTag );
		$( 'form input:submit' ).hide();
		$( 'form' ).get( 0 ).className = 'static';
	}
}

function showImageBySrc( src ) {
	var im = $('<img>').attr('src', src);
	imElt = im.get(0);
	var isLoaded = false;
	im.load(function () {
		if (!isLoaded) {
			showJigsaw(src, imElt.width, imElt.height);
			isLoaded = true;
		}
	});
	if (imElt.complete) {
		im.trigger('load');
	}
}

function setupJigsaw() {
	$( '#f' ).addClass( 'l' );
	var em = $('#a a').height(); // SO TEMPTING to just write 13 here and be done with it.
	jigWd = $(document).width();
	jigHt = $(document).height() - 6 * em;
}

// Called once we know the image and its dimensions.
function showJigsaw(src, wd, ht) {
	recentSrc = src;
	if (3 * wd < jigWd && 2 * ht < jigHt) {
		ht *= .5 * jigWd / wd;
		wd = jigWd * .5;
	}
	if (wd > jigWd) {
		ht *= jigWd / wd;
		wd = jigWd;
	}
	if (ht > jigHt) {
		wd *= jigHt / ht;
		ht = jigHt;
	}
	var n = $('#d').val();
	var args = {
		u: src,
		wd: wd,
		ht: ht,
		nh: Math.ceil(Math.pow(n * wd / ht, .5)),
		nv: Math.ceil(Math.pow(n * ht / wd, .5))
	};
	var embed = $('<embed>').attr({
		src: 'jigsaw.svg' + escapeArgs(args),
		type: 'image/svg+xml',
		width: jigWd,
		height: jigHt
	});
	$('#x').empty().append(embed);
	$('body').addClass('j');
	$('#f').removeClass('l');
}

function escapeArgs(args) {
	var ss = [];
	for (var i in args) {
		ss.push(escape(i) + '=' + escape(args[i]));
	}
	if (ss.length) {
		return '?' + ss.join('&');
	}
}

var jigHt, jigWd, recentSrc;

$(document).ready(function () {

	$.ajax({
		url: "jigsaw-config.json",
		dataType: "json",
		success: function( data ) {
			init( data );
		},
		error: function( response, error, exception ) {
			console.log( "No jigsaw-config.json defined..." );
			init( null );
		}
	});

    // If you host your own version of this app, you MUST change the API key.
    var apiKey = 'Flickr API key goes here';
    var flickrCall = function (meth, args, func) {
        $.extend(args, {
            method: 'flickr.' + meth,
            api_key: apiKey,
            format: 'json'
        });
        return $.ajax({
            url: 'http://api.flickr.com/services/rest/',
            data: args,
            dataType: 'jsonp',
            jsonp: 'jsoncallback',
            success: func
        })
    };

    // User has clicked on the Jigsaw button.
    $('#f').submit(function (evt) {
        setupJigsaw();
        if ($(this).hasClass('u')) {
            // User has specified picture URL directly.
            // We must loads the image to discover its dimensions.
            showImageBySrc( $('#u').val() );
        } else {
            // User has supplied Flickr tags; use API to find image src and dimens.
            var tags = $('#t').val();
            var args = {
                tags: tags.split().join(','),
                license: '1,2,4,5,7', // Licences that permit modified works.
                sort: 'interestingness-desc',
                content_type: 1, // Still images only
                media: 'photos',
                per_page: 25,
                extras: 'owner_name'
            };
            flickrCall('photos.search', args, function (data) {
                // We have a lost of photos. Choose one at random.
                var photoIndex = Math.floor(Math.random() * data.photos.photo.length);
                var photo = data.photos.photo[photoIndex];
                
                // Now to find the size of the photo that fits best.
                flickrCall('photos.getSizes', {photo_id: photo.id}, function (data) {
                    // Loop over sizes to get best fit.
                    var prev;
                    for (var i = 0; i < data.sizes.size.length; ++i) {
                        var size = data.sizes.size[i];
                        if (size.width > jigWd || size.height > jigHt) {
                            break;
                        }
                        prev = size;
                    }
                    size = prev;
            
                    var pElt = $('<p>');
                    var aElt = $('<a>')
                        .attr('href', 'http://www.flickr.com/photos/' + photo.owner + '/' + photo.id)
                        .text(photo.title + ' by ' + photo.ownername)
                        .appendTo(pElt);
                    $('#c').empty().append(pElt);
                    
                    showJigsaw(size.source, size.width, size.height);
                });
            });                
        }
        evt.preventDefault();
    });
    
    // This supplies the mechanism for switching between modes.
    $('form a').click(function (evt) {
        var which = this.parentNode.id == 'dt' ? 'u' : 't';
        this.parentNode.parentNode.className = which;
        if (which == 'u' && recentSrc && $('#u').val() == '') {
            $('#u').val(recentSrc);
        }
    });
    
    // While we’re at it, let’s check the query string.
    if (location.search) {
        var args = {};
        var kvs = location.search.substr(1).split('&');
        for (var i in kvs) {
            var kv = kvs[i];
            var p = kv.indexOf('=');
            args[unescape(kv.slice(0, p))] = unescape(kv.slice(p + 1));
        }
        for (var i in {d:1, u:1, t:1}) {
            $('#' + i).val(args[i]);
        }
        if (args.u) {
            $('#f').get(0).className = 'u';
        }
        if (args.j) {
            $('#f').submit();
        }
    }
});
