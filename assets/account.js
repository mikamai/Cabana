jQuery(function($){
	Login = {
		bind: function(){
			$('.js-recoverToggle').on('click', Login.recover.show);
			$('.js-recoverCancel').on('click', Login.recover.hide);
		},
		recover: {
			show: function(e){
				e.preventDefault();

				$('.js-loginForm').hide();
				$('.js-recoverForm').show();
			},
			hide: function(e){
				e.preventDefault();

				$('.js-loginForm').show();
				$('.js-recoverForm').hide();
			}
		}
	}

  Login.bind();
});

