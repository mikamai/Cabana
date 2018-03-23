jQuery(function($){
	MobileZoom = {
		init: function(){
			Reqs.pannZoom();
			
			$('.product-image-img').on('click', function(){
				var image_url = $(this).closest('.product-image').attr('data-bg-src') || $(this).closest('.product-image').attr('data-image');
				MobileZoom.image(image_url);
			});
		},
		image: function(url){
			var modal = $('.mobile-zoom-overlay'),
				modal_img = new Image();

			modal_img.src = url;
			modal.append(modal_img);

			$(modal_img).load(function(){
				var $img = $(this),
					img_height = $img.height(),
					img_position = (($(window).innerHeight() - img_height)/2);

				$img.css('top', img_position);
				modal.addClass('is-visible');
				$img.addClass('fade-in');
				$img.panzoom();

				// var data = 'window: '+$(window).height()+', img: '+img_height+', pos: '+img_position;
				// alert(data);
			});

			$('.js-MobileZoom-close').on('click', function(){
				MobileZoom.hide(modal);
			});
		},
		hide: function(modal){
			modal.addClass('is-hiding');
			setTimeout(function(){
				modal.removeClass('is-hiding is-visible');
				modal.find('img').panzoom('destroy').remove(); // kill zoom and remove <img>
			}, 300);
		}
	}

	MobileZoom.init();
});