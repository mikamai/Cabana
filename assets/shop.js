;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());
/*!
 * Flickity PACKAGED v1.0.2
 * Touch, responsive, flickable galleries
 *
 * Licensed GPLv3 for open source use
 * or Flickity Commercial License for commercial use
 *
 * http://flickity.metafizzy.co
 * Copyright 2015 Metafizzy
 */

!function(t){function e(){}function i(t){function i(e){e.prototype.option||(e.prototype.option=function(e){t.isPlainObject(e)&&(this.options=t.extend(!0,this.options,e))})}function o(e,i){t.fn[e]=function(o){if("string"==typeof o){for(var s=n.call(arguments,1),a=0,l=this.length;l>a;a++){var c=this[a],h=t.data(c,e);if(h)if(t.isFunction(h[o])&&"_"!==o.charAt(0)){var d=h[o].apply(h,s);if(void 0!==d)return d}else r("no such method '"+o+"' for "+e+" instance");else r("cannot call methods on "+e+" prior to initialization; attempted to call '"+o+"'")}return this}return this.each(function(){var n=t.data(this,e);n?(n.option(o),n._init()):(n=new i(this,o),t.data(this,e,n))})}}if(t){var r="undefined"==typeof console?e:function(t){console.error(t)};return t.bridget=function(t,e){i(e),o(t,e)},t.bridget}}var n=Array.prototype.slice;"function"==typeof define&&define.amd?define("jquery-bridget/jquery.bridget",["jquery"],i):i("object"==typeof exports?require("jquery"):t.jQuery)}(window),function(t){function e(t){return new RegExp("(^|\\s+)"+t+"(\\s+|$)")}function i(t,e){var i=n(t,e)?r:o;i(t,e)}var n,o,r;"classList"in document.documentElement?(n=function(t,e){return t.classList.contains(e)},o=function(t,e){t.classList.add(e)},r=function(t,e){t.classList.remove(e)}):(n=function(t,i){return e(i).test(t.className)},o=function(t,e){n(t,e)||(t.className=t.className+" "+e)},r=function(t,i){t.className=t.className.replace(e(i)," ")});var s={hasClass:n,addClass:o,removeClass:r,toggleClass:i,has:n,add:o,remove:r,toggle:i};"function"==typeof define&&define.amd?define("classie/classie",s):"object"==typeof exports?module.exports=s:t.classie=s}(window),function(){function t(){}function e(t,e){for(var i=t.length;i--;)if(t[i].listener===e)return i;return-1}function i(t){return function(){return this[t].apply(this,arguments)}}var n=t.prototype,o=this,r=o.EventEmitter;n.getListeners=function(t){var e,i,n=this._getEvents();if(t instanceof RegExp){e={};for(i in n)n.hasOwnProperty(i)&&t.test(i)&&(e[i]=n[i])}else e=n[t]||(n[t]=[]);return e},n.flattenListeners=function(t){var e,i=[];for(e=0;e<t.length;e+=1)i.push(t[e].listener);return i},n.getListenersAsObject=function(t){var e,i=this.getListeners(t);return i instanceof Array&&(e={},e[t]=i),e||i},n.addListener=function(t,i){var n,o=this.getListenersAsObject(t),r="object"==typeof i;for(n in o)o.hasOwnProperty(n)&&-1===e(o[n],i)&&o[n].push(r?i:{listener:i,once:!1});return this},n.on=i("addListener"),n.addOnceListener=function(t,e){return this.addListener(t,{listener:e,once:!0})},n.once=i("addOnceListener"),n.defineEvent=function(t){return this.getListeners(t),this},n.defineEvents=function(t){for(var e=0;e<t.length;e+=1)this.defineEvent(t[e]);return this},n.removeListener=function(t,i){var n,o,r=this.getListenersAsObject(t);for(o in r)r.hasOwnProperty(o)&&(n=e(r[o],i),-1!==n&&r[o].splice(n,1));return this},n.off=i("removeListener"),n.addListeners=function(t,e){return this.manipulateListeners(!1,t,e)},n.removeListeners=function(t,e){return this.manipulateListeners(!0,t,e)},n.manipulateListeners=function(t,e,i){var n,o,r=t?this.removeListener:this.addListener,s=t?this.removeListeners:this.addListeners;if("object"!=typeof e||e instanceof RegExp)for(n=i.length;n--;)r.call(this,e,i[n]);else for(n in e)e.hasOwnProperty(n)&&(o=e[n])&&("function"==typeof o?r.call(this,n,o):s.call(this,n,o));return this},n.removeEvent=function(t){var e,i=typeof t,n=this._getEvents();if("string"===i)delete n[t];else if(t instanceof RegExp)for(e in n)n.hasOwnProperty(e)&&t.test(e)&&delete n[e];else delete this._events;return this},n.removeAllListeners=i("removeEvent"),n.emitEvent=function(t,e){var i,n,o,r,s=this.getListenersAsObject(t);for(o in s)if(s.hasOwnProperty(o))for(n=s[o].length;n--;)i=s[o][n],i.once===!0&&this.removeListener(t,i.listener),r=i.listener.apply(this,e||[]),r===this._getOnceReturnValue()&&this.removeListener(t,i.listener);return this},n.trigger=i("emitEvent"),n.emit=function(t){var e=Array.prototype.slice.call(arguments,1);return this.emitEvent(t,e)},n.setOnceReturnValue=function(t){return this._onceReturnValue=t,this},n._getOnceReturnValue=function(){return this.hasOwnProperty("_onceReturnValue")?this._onceReturnValue:!0},n._getEvents=function(){return this._events||(this._events={})},t.noConflict=function(){return o.EventEmitter=r,t},"function"==typeof define&&define.amd?define("eventEmitter/EventEmitter",[],function(){return t}):"object"==typeof module&&module.exports?module.exports=t:o.EventEmitter=t}.call(this),function(t){function e(e){var i=t.event;return i.target=i.target||i.srcElement||e,i}var i=document.documentElement,n=function(){};i.addEventListener?n=function(t,e,i){t.addEventListener(e,i,!1)}:i.attachEvent&&(n=function(t,i,n){t[i+n]=n.handleEvent?function(){var i=e(t);n.handleEvent.call(n,i)}:function(){var i=e(t);n.call(t,i)},t.attachEvent("on"+i,t[i+n])});var o=function(){};i.removeEventListener?o=function(t,e,i){t.removeEventListener(e,i,!1)}:i.detachEvent&&(o=function(t,e,i){t.detachEvent("on"+e,t[e+i]);try{delete t[e+i]}catch(n){t[e+i]=void 0}});var r={bind:n,unbind:o};"function"==typeof define&&define.amd?define("eventie/eventie",r):"object"==typeof exports?module.exports=r:t.eventie=r}(window),function(t){function e(t){if(t){if("string"==typeof n[t])return t;t=t.charAt(0).toUpperCase()+t.slice(1);for(var e,o=0,r=i.length;r>o;o++)if(e=i[o]+t,"string"==typeof n[e])return e}}var i="Webkit Moz ms Ms O".split(" "),n=document.documentElement.style;"function"==typeof define&&define.amd?define("get-style-property/get-style-property",[],function(){return e}):"object"==typeof exports?module.exports=e:t.getStyleProperty=e}(window),function(t){function e(t){var e=parseFloat(t),i=-1===t.indexOf("%")&&!isNaN(e);return i&&e}function i(){}function n(){for(var t={width:0,height:0,innerWidth:0,innerHeight:0,outerWidth:0,outerHeight:0},e=0,i=s.length;i>e;e++){var n=s[e];t[n]=0}return t}function o(i){function o(){if(!p){p=!0;var n=t.getComputedStyle;if(c=function(){var t=n?function(t){return n(t,null)}:function(t){return t.currentStyle};return function(e){var i=t(e);return i||r("Style returned "+i+". Are you running this code in a hidden iframe on Firefox? See http://bit.ly/getsizebug1"),i}}(),h=i("boxSizing")){var o=document.createElement("div");o.style.width="200px",o.style.padding="1px 2px 3px 4px",o.style.borderStyle="solid",o.style.borderWidth="1px 2px 3px 4px",o.style[h]="border-box";var s=document.body||document.documentElement;s.appendChild(o);var a=c(o);d=200===e(a.width),s.removeChild(o)}}}function a(t){if(o(),"string"==typeof t&&(t=document.querySelector(t)),t&&"object"==typeof t&&t.nodeType){var i=c(t);if("none"===i.display)return n();var r={};r.width=t.offsetWidth,r.height=t.offsetHeight;for(var a=r.isBorderBox=!(!h||!i[h]||"border-box"!==i[h]),p=0,u=s.length;u>p;p++){var f=s[p],v=i[f];v=l(t,v);var y=parseFloat(v);r[f]=isNaN(y)?0:y}var g=r.paddingLeft+r.paddingRight,m=r.paddingTop+r.paddingBottom,b=r.marginLeft+r.marginRight,x=r.marginTop+r.marginBottom,S=r.borderLeftWidth+r.borderRightWidth,C=r.borderTopWidth+r.borderBottomWidth,w=a&&d,E=e(i.width);E!==!1&&(r.width=E+(w?0:g+S));var P=e(i.height);return P!==!1&&(r.height=P+(w?0:m+C)),r.innerWidth=r.width-(g+S),r.innerHeight=r.height-(m+C),r.outerWidth=r.width+b,r.outerHeight=r.height+x,r}}function l(e,i){if(t.getComputedStyle||-1===i.indexOf("%"))return i;var n=e.style,o=n.left,r=e.runtimeStyle,s=r&&r.left;return s&&(r.left=e.currentStyle.left),n.left=i,i=n.pixelLeft,n.left=o,s&&(r.left=s),i}var c,h,d,p=!1;return a}var r="undefined"==typeof console?i:function(t){console.error(t)},s=["paddingLeft","paddingRight","paddingTop","paddingBottom","marginLeft","marginRight","marginTop","marginBottom","borderLeftWidth","borderRightWidth","borderTopWidth","borderBottomWidth"];"function"==typeof define&&define.amd?define("get-size/get-size",["get-style-property/get-style-property"],o):"object"==typeof exports?module.exports=o(require("desandro-get-style-property")):t.getSize=o(t.getStyleProperty)}(window),function(t){function e(t){"function"==typeof t&&(e.isReady?t():s.push(t))}function i(t){var i="readystatechange"===t.type&&"complete"!==r.readyState;e.isReady||i||n()}function n(){e.isReady=!0;for(var t=0,i=s.length;i>t;t++){var n=s[t];n()}}function o(o){return"complete"===r.readyState?n():(o.bind(r,"DOMContentLoaded",i),o.bind(r,"readystatechange",i),o.bind(t,"load",i)),e}var r=t.document,s=[];e.isReady=!1,"function"==typeof define&&define.amd?define("doc-ready/doc-ready",["eventie/eventie"],o):"object"==typeof exports?module.exports=o(require("eventie")):t.docReady=o(t.eventie)}(window),function(t){function e(t,e){return t[s](e)}function i(t){if(!t.parentNode){var e=document.createDocumentFragment();e.appendChild(t)}}function n(t,e){i(t);for(var n=t.parentNode.querySelectorAll(e),o=0,r=n.length;r>o;o++)if(n[o]===t)return!0;return!1}function o(t,n){return i(t),e(t,n)}var r,s=function(){if(t.matches)return"matches";if(t.matchesSelector)return"matchesSelector";for(var e=["webkit","moz","ms","o"],i=0,n=e.length;n>i;i++){var o=e[i],r=o+"MatchesSelector";if(t[r])return r}}();if(s){var a=document.createElement("div"),l=e(a,"div");r=l?e:o}else r=n;"function"==typeof define&&define.amd?define("matches-selector/matches-selector",[],function(){return r}):"object"==typeof exports?module.exports=r:window.matchesSelector=r}(Element.prototype),function(t,e){"function"==typeof define&&define.amd?define("fizzy-ui-utils/utils",["doc-ready/doc-ready","matches-selector/matches-selector"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("doc-ready"),require("desandro-matches-selector")):t.fizzyUIUtils=e(t,t.docReady,t.matchesSelector)}(window,function(t,e,i){var n={};n.extend=function(t,e){for(var i in e)t[i]=e[i];return t},n.modulo=function(t,e){return(t%e+e)%e};var o=Object.prototype.toString;n.isArray=function(t){return"[object Array]"==o.call(t)},n.makeArray=function(t){var e=[];if(n.isArray(t))e=t;else if(t&&"number"==typeof t.length)for(var i=0,o=t.length;o>i;i++)e.push(t[i]);else e.push(t);return e},n.indexOf=Array.prototype.indexOf?function(t,e){return t.indexOf(e)}:function(t,e){for(var i=0,n=t.length;n>i;i++)if(t[i]===e)return i;return-1},n.removeFrom=function(t,e){var i=n.indexOf(t,e);-1!=i&&t.splice(i,1)},n.isElement="function"==typeof HTMLElement||"object"==typeof HTMLElement?function(t){return t instanceof HTMLElement}:function(t){return t&&"object"==typeof t&&1==t.nodeType&&"string"==typeof t.nodeName},n.setText=function(){function t(t,i){e=e||(void 0!==document.documentElement.textContent?"textContent":"innerText"),t[e]=i}var e;return t}(),n.getParent=function(t,e){for(;t!=document.body;)if(t=t.parentNode,i(t,e))return t},n.getQueryElement=function(t){return"string"==typeof t?document.querySelector(t):t},n.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},n.filterFindElements=function(t,e){t=n.makeArray(t);for(var o=[],r=0,s=t.length;s>r;r++){var a=t[r];if(n.isElement(a))if(e){i(a,e)&&o.push(a);for(var l=a.querySelectorAll(e),c=0,h=l.length;h>c;c++)o.push(l[c])}else o.push(a)}return o},n.debounceMethod=function(t,e,i){var n=t.prototype[e],o=e+"Timeout";t.prototype[e]=function(){var t=this[o];t&&clearTimeout(t);var e=arguments,r=this;this[o]=setTimeout(function(){n.apply(r,e),delete r[o]},i||100)}},n.toDashed=function(t){return t.replace(/(.)([A-Z])/g,function(t,e,i){return e+"-"+i}).toLowerCase()};var r=t.console;return n.htmlInit=function(i,o){e(function(){for(var e=n.toDashed(o),s=document.querySelectorAll(".js-"+e),a="data-"+e+"-options",l=0,c=s.length;c>l;l++){var h,d=s[l],p=d.getAttribute(a);try{h=p&&JSON.parse(p)}catch(u){r&&r.error("Error parsing "+a+" on "+d.nodeName.toLowerCase()+(d.id?"#"+d.id:"")+": "+u);continue}var f=new i(d,h),v=t.jQuery;v&&v.data(d,o,f)}})},n}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/cell",["get-size/get-size"],function(i){return e(t,i)}):"object"==typeof exports?module.exports=e(t,require("get-size")):(t.Flickity=t.Flickity||{},t.Flickity.Cell=e(t,t.getSize))}(window,function(t,e){function i(t,e){this.element=t,this.parent=e,this.create()}var n="attachEvent"in t;return i.prototype.create=function(){this.element.style.position="absolute",n&&this.element.setAttribute("unselectable","on"),this.x=0,this.shift=0},i.prototype.destroy=function(){this.element.style.position="";var t=this.parent.originSide;this.element.style[t]=""},i.prototype.getSize=function(){this.size=e(this.element)},i.prototype.setPosition=function(t){this.x=t,this.setDefaultTarget(),this.renderPosition(t)},i.prototype.setDefaultTarget=function(){var t="left"==this.parent.originSide?"marginLeft":"marginRight";this.target=this.x+this.size[t]+this.size.width*this.parent.cellAlign},i.prototype.renderPosition=function(t){var e=this.parent.originSide;this.element.style[e]=this.parent.getPositionValue(t)},i.prototype.wrapShift=function(t){this.shift=t,this.renderPosition(this.x+this.parent.slideableWidth*t)},i.prototype.remove=function(){this.element.parentNode.removeChild(this.element)},i}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/animate",["get-style-property/get-style-property","fizzy-ui-utils/utils"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("desandro-get-style-property"),require("fizzy-ui-utils")):(t.Flickity=t.Flickity||{},t.Flickity.animatePrototype=e(t,t.getStyleProperty,t.fizzyUIUtils))}(window,function(t,e,i){for(var n,o=0,r="webkit moz ms o".split(" "),s=t.requestAnimationFrame,a=t.cancelAnimationFrame,l=0;l<r.length&&(!s||!a);l++)n=r[l],s=s||t[n+"RequestAnimationFrame"],a=a||t[n+"CancelAnimationFrame"]||t[n+"CancelRequestAnimationFrame"];s&&a||(s=function(e){var i=(new Date).getTime(),n=Math.max(0,16-(i-o)),r=t.setTimeout(function(){e(i+n)},n);return o=i+n,r},a=function(e){t.clearTimeout(e)});var c={};c.startAnimation=function(){this.isAnimating||(this.isAnimating=!0,this.restingFrames=0,this.animate())},c.animate=function(){this.applySelectedAttraction();var t=this.x;if(this.integratePhysics(),this.positionSlider(),this.settle(t),this.isAnimating){var e=this;s(function(){e.animate()})}};var h=e("transform"),d=!!e("perspective");return c.positionSlider=function(){var t=this.x;this.options.wrapAround&&this.cells.length>1&&(t=i.modulo(t,this.slideableWidth),t-=this.slideableWidth,this.shiftWrapCells(t)),t+=this.cursorPosition,t=this.options.rightToLeft&&h?-t:t;var e=this.getPositionValue(t);h?this.slider.style[h]=d&&this.isAnimating?"translate3d("+e+",0,0)":"translateX("+e+")":this.slider.style[this.originSide]=e},c.positionSliderAtSelected=function(){if(this.cells.length){var t=this.cells[this.selectedIndex];this.x=-t.target,this.positionSlider()}},c.getPositionValue=function(t){return this.options.percentPosition?.01*Math.round(t/this.size.innerWidth*1e4)+"%":Math.round(t)+"px"},c.settle=function(t){this.isPointerDown||Math.round(100*this.x)!=Math.round(100*t)||this.restingFrames++,this.restingFrames>2&&(this.isAnimating=!1,delete this.isFreeScrolling,d&&this.positionSlider(),this.dispatchEvent("settle"))},c.shiftWrapCells=function(t){var e=this.cursorPosition+t;this._shiftCells(this.beforeShiftCells,e,-1);var i=this.size.innerWidth-(t+this.slideableWidth+this.cursorPosition);this._shiftCells(this.afterShiftCells,i,1)},c._shiftCells=function(t,e,i){for(var n=0,o=t.length;o>n;n++){var r=t[n],s=e>0?i:0;r.wrapShift(s),e-=r.size.outerWidth}},c._unshiftCells=function(t){if(t&&t.length)for(var e=0,i=t.length;i>e;e++)t[e].wrapShift(0)},c.integratePhysics=function(){this.velocity+=this.accel,this.x+=this.velocity,this.velocity*=this.getFrictionFactor(),this.accel=0},c.applyForce=function(t){this.accel+=t},c.getFrictionFactor=function(){return 1-this.options[this.isFreeScrolling?"freeScrollFriction":"friction"]},c.getRestingPosition=function(){return this.x+this.velocity/(1-this.getFrictionFactor())},c.applySelectedAttraction=function(){var t=this.cells.length;if(!this.isPointerDown&&!this.isFreeScrolling&&t){var e=this.cells[this.selectedIndex],i=this.options.wrapAround&&t>1?this.slideableWidth*Math.floor(this.selectedIndex/t):0,n=-1*(e.target+i)-this.x,o=n*this.options.selectedAttraction;this.applyForce(o)}},c}),function(t,e){if("function"==typeof define&&define.amd)define("flickity/js/flickity",["classie/classie","eventEmitter/EventEmitter","eventie/eventie","get-size/get-size","fizzy-ui-utils/utils","./cell","./animate"],function(i,n,o,r,s,a,l){return e(t,i,n,o,r,s,a,l)});else if("object"==typeof exports)module.exports=e(t,require("desandro-classie"),require("wolfy87-eventemitter"),require("eventie"),require("get-size"),require("fizzy-ui-utils"),require("./cell"),require("./animate"));else{var i=t.Flickity;t.Flickity=e(t,t.classie,t.EventEmitter,t.eventie,t.getSize,t.fizzyUIUtils,i.Cell,i.animatePrototype)}}(window,function(t,e,i,n,o,r,s,a){function l(t,e){for(t=r.makeArray(t);t.length;)e.appendChild(t.shift())}function c(t,e){var i=r.getQueryElement(t);return i?(this.element=i,h&&(this.$element=h(this.element)),this.options=r.extend({},this.constructor.defaults),this.option(e),void this._create()):void(p&&p.error("Bad element for Flickity: "+(i||t)))}var h=t.jQuery,d=t.getComputedStyle,p=t.console,u=0,f={};c.defaults={accessibility:!0,cellAlign:"center",freeScrollFriction:.075,friction:.28,percentPosition:!0,resize:!0,selectedAttraction:.025,setGallerySize:!0},c.createMethods=[],r.extend(c.prototype,i.prototype),c.prototype._create=function(){var e=this.guid=++u;this.element.flickityGUID=e,f[e]=this,this.selectedIndex=this.options.initialIndex||0,this.restingFrames=0,this.x=0,this.velocity=0,this.accel=0,this.originSide=this.options.rightToLeft?"right":"left",this.viewport=document.createElement("div"),this.viewport.className="flickity-viewport",c.setUnselectable(this.viewport),this._createSlider(),(this.options.resize||this.options.watchCSS)&&(n.bind(t,"resize",this),this.isResizeBound=!0);for(var i=0,o=c.createMethods.length;o>i;i++){var r=c.createMethods[i];this[r]()}this.options.watchCSS?this.watchCSS():this.activate()},c.prototype.option=function(t){r.extend(this.options,t)},c.prototype.activate=function(){if(!this.isActive){this.isActive=!0,e.add(this.element,"flickity-enabled"),this.options.rightToLeft&&e.add(this.element,"flickity-rtl");var t=this._filterFindCellElements(this.element.children);l(t,this.slider),this.viewport.appendChild(this.slider),this.element.appendChild(this.viewport),this.getSize(),this.reloadCells(),this.options.accessibility&&(this.element.tabIndex=0,n.bind(this.element,"keydown",this)),this.emit("activate"),this.positionSliderAtSelected(),this.select(this.selectedIndex)}},c.prototype._createSlider=function(){var t=document.createElement("div");t.className="flickity-slider",t.style[this.originSide]=0,this.slider=t},c.prototype._filterFindCellElements=function(t){return r.filterFindElements(t,this.options.cellSelector)},c.prototype.reloadCells=function(){this.cells=this._makeCells(this.slider.children),this.positionCells(),this._getWrapShiftCells(),this.setGallerySize()},c.prototype._makeCells=function(t){for(var e=this._filterFindCellElements(t),i=[],n=0,o=e.length;o>n;n++){var r=e[n],a=new s(r,this);i.push(a)}return i},c.prototype.getLastCell=function(){return this.cells[this.cells.length-1]},c.prototype.positionCells=function(){this._sizeCells(this.cells),this._positionCells(0)},c.prototype._positionCells=function(t){this.maxCellHeight=t?this.maxCellHeight||0:0;var e=0;if(t>0){var i=this.cells[t-1];e=i.x+i.size.outerWidth}for(var n,o=this.cells.length,r=t;o>r;r++)n=this.cells[r],n.setPosition(e),e+=n.size.outerWidth,this.maxCellHeight=Math.max(n.size.outerHeight,this.maxCellHeight);this.slideableWidth=e,this._containCells()},c.prototype._sizeCells=function(t){for(var e=0,i=t.length;i>e;e++){var n=t[e];n.getSize()}},c.prototype._init=c.prototype.reposition=function(){this.positionCells(),this.positionSliderAtSelected()},c.prototype.getSize=function(){this.size=o(this.element),this.setCellAlign(),this.cursorPosition=this.size.innerWidth*this.cellAlign};var v={center:{left:.5,right:.5},left:{left:0,right:1},right:{right:0,left:1}};c.prototype.setCellAlign=function(){var t=v[this.options.cellAlign];this.cellAlign=t?t[this.originSide]:this.options.cellAlign},c.prototype.setGallerySize=function(){this.options.setGallerySize&&(this.viewport.style.height=this.maxCellHeight+"px")},c.prototype._getWrapShiftCells=function(){if(this.options.wrapAround){this._unshiftCells(this.beforeShiftCells),this._unshiftCells(this.afterShiftCells);var t=this.cursorPosition,e=this.cells.length-1;this.beforeShiftCells=this._getGapCells(t,e,-1),t=this.size.innerWidth-this.cursorPosition,this.afterShiftCells=this._getGapCells(t,0,1)}},c.prototype._getGapCells=function(t,e,i){for(var n=[];t>0;){var o=this.cells[e];if(!o)break;n.push(o),e+=i,t-=o.size.outerWidth}return n},c.prototype._containCells=function(){if(this.options.contain&&!this.options.wrapAround&&this.cells.length)for(var t=this.options.rightToLeft?"marginRight":"marginLeft",e=this.options.rightToLeft?"marginLeft":"marginRight",i=this.cells[0].size[t],n=this.getLastCell(),o=this.slideableWidth-n.size[e],r=o-this.size.innerWidth*(1-this.cellAlign),s=o<this.size.innerWidth,a=0,l=this.cells.length;l>a;a++){var c=this.cells[a];c.setDefaultTarget(),s?c.target=o*this.cellAlign:(c.target=Math.max(c.target,this.cursorPosition+i),c.target=Math.min(c.target,r))}},c.prototype.dispatchEvent=function(t,e,i){var n=[e].concat(i);if(this.emitEvent(t,n),h&&this.$element)if(e){var o=h.Event(e);o.type=t,this.$element.trigger(o,i)}else this.$element.trigger(t,i)},c.prototype.select=function(t,e){if(this.isActive){var i=this.cells.length;this.options.wrapAround&&i>1&&(0>t?this.x-=this.slideableWidth:t>=i&&(this.x+=this.slideableWidth)),(this.options.wrapAround||e)&&(t=r.modulo(t,i)),this.cells[t]&&(this.selectedIndex=t,this.setSelectedCell(),this.startAnimation(),this.dispatchEvent("cellSelect"))}},c.prototype.previous=function(t){this.select(this.selectedIndex-1,t)},c.prototype.next=function(t){this.select(this.selectedIndex+1,t)},c.prototype.setSelectedCell=function(){this._removeSelectedCellClass(),this.selectedCell=this.cells[this.selectedIndex],this.selectedElement=this.selectedCell.element,e.add(this.selectedElement,"is-selected")},c.prototype._removeSelectedCellClass=function(){this.selectedCell&&e.remove(this.selectedCell.element,"is-selected")},c.prototype.getCell=function(t){for(var e=0,i=this.cells.length;i>e;e++){var n=this.cells[e];if(n.element==t)return n}},c.prototype.getCells=function(t){t=r.makeArray(t);for(var e=[],i=0,n=t.length;n>i;i++){var o=t[i],s=this.getCell(o);s&&e.push(s)}return e},c.prototype.getCellElements=function(){for(var t=[],e=0,i=this.cells.length;i>e;e++)t.push(this.cells[e].element);return t},c.prototype.getParentCell=function(t){var e=this.getCell(t);return e?e:(t=r.getParent(t,".flickity-slider > *"),this.getCell(t))},c.prototype.uiChange=function(){this.emit("uiChange")},c.prototype.childUIPointerDown=function(t){this.emitEvent("childUIPointerDown",[t])},c.prototype.onresize=function(){this.watchCSS(),this.resize()},r.debounceMethod(c,"onresize",150),c.prototype.resize=function(){this.isActive&&(this.getSize(),this.options.wrapAround&&(this.x=r.modulo(this.x,this.slideableWidth)),this.positionCells(),this._getWrapShiftCells(),this.setGallerySize(),this.positionSliderAtSelected())};var y=c.supportsConditionalCSS=function(){var t;return function(){if(void 0!==t)return t;if(!d)return void(t=!1);var e=document.createElement("style"),i=document.createTextNode('body:after { content: "foo"; display: none; }');e.appendChild(i),document.head.appendChild(e);var n=d(document.body,":after").content;return t=-1!=n.indexOf("foo"),document.head.removeChild(e),t}}();c.prototype.watchCSS=function(){var t=this.options.watchCSS;if(t){var e=y();if(!e){var i="fallbackOn"==t?"activate":"deactivate";return void this[i]()}var n=d(this.element,":after").content;-1!=n.indexOf("flickity")?this.activate():this.deactivate()}},c.prototype.onkeydown=function(t){if(this.options.accessibility&&(!document.activeElement||document.activeElement==this.element))if(37==t.keyCode){var e=this.options.rightToLeft?"next":"previous";this.uiChange(),this[e]()}else if(39==t.keyCode){var i=this.options.rightToLeft?"previous":"next";this.uiChange(),this[i]()}},c.prototype.deactivate=function(){if(this.isActive){e.remove(this.element,"flickity-enabled"),e.remove(this.element,"flickity-rtl");for(var t=0,i=this.cells.length;i>t;t++){var o=this.cells[t];o.destroy()}this._removeSelectedCellClass(),this.element.removeChild(this.viewport),l(this.slider.children,this.element),this.options.accessibility&&(this.element.removeAttribute("tabIndex"),n.unbind(this.element,"keydown",this)),this.isActive=!1,this.emit("deactivate")}},c.prototype.destroy=function(){this.deactivate(),this.isResizeBound&&n.unbind(t,"resize",this),this.emit("destroy"),h&&this.$element&&h.removeData(this.element,"flickity"),delete this.element.flickityGUID,delete f[this.guid]},r.extend(c.prototype,a);var g="attachEvent"in t;return c.setUnselectable=function(t){g&&t.setAttribute("unselectable","on")},c.data=function(t){t=r.getQueryElement(t);var e=t&&t.flickityGUID;return e&&f[e]},r.htmlInit(c,"flickity"),h&&h.bridget&&h.bridget("flickity",c),c.Cell=s,c}),function(t,e){"function"==typeof define&&define.amd?define("unipointer/unipointer",["eventEmitter/EventEmitter","eventie/eventie"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("wolfy87-eventemitter"),require("eventie")):t.Unipointer=e(t,t.EventEmitter,t.eventie)}(window,function(t,e,i){function n(){}function o(){}o.prototype=new e,o.prototype.bindStartEvent=function(t){this._bindStartEvent(t,!0)},o.prototype.unbindStartEvent=function(t){this._bindStartEvent(t,!1)},o.prototype._bindStartEvent=function(e,n){n=void 0===n?!0:!!n;var o=n?"bind":"unbind";t.navigator.pointerEnabled?i[o](e,"pointerdown",this):t.navigator.msPointerEnabled?i[o](e,"MSPointerDown",this):(i[o](e,"mousedown",this),i[o](e,"touchstart",this))},o.prototype.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},o.prototype.getTouch=function(t){for(var e=0,i=t.length;i>e;e++){var n=t[e];if(n.identifier==this.pointerIdentifier)return n}},o.prototype.onmousedown=function(t){var e=t.button;e&&0!==e&&1!==e||this._pointerDown(t,t)},o.prototype.ontouchstart=function(t){this._pointerDown(t,t.changedTouches[0])},o.prototype.onMSPointerDown=o.prototype.onpointerdown=function(t){this._pointerDown(t,t)},o.prototype._pointerDown=function(t,e){this.isPointerDown||(this.isPointerDown=!0,this.pointerIdentifier=void 0!==e.pointerId?e.pointerId:e.identifier,this.pointerDown(t,e))},o.prototype.pointerDown=function(t,e){this._bindPostStartEvents(t),this.emitEvent("pointerDown",[t,e])};var r={mousedown:["mousemove","mouseup"],touchstart:["touchmove","touchend","touchcancel"],pointerdown:["pointermove","pointerup","pointercancel"],MSPointerDown:["MSPointerMove","MSPointerUp","MSPointerCancel"]};return o.prototype._bindPostStartEvents=function(e){if(e){for(var n=r[e.type],o=e.preventDefault?t:document,s=0,a=n.length;a>s;s++){var l=n[s];i.bind(o,l,this)}this._boundPointerEvents={events:n,node:o}}},o.prototype._unbindPostStartEvents=function(){var t=this._boundPointerEvents;if(t&&t.events){for(var e=0,n=t.events.length;n>e;e++){var o=t.events[e];i.unbind(t.node,o,this)}delete this._boundPointerEvents}},o.prototype.onmousemove=function(t){this._pointerMove(t,t)},o.prototype.onMSPointerMove=o.prototype.onpointermove=function(t){t.pointerId==this.pointerIdentifier&&this._pointerMove(t,t)},o.prototype.ontouchmove=function(t){var e=this.getTouch(t.changedTouches);e&&this._pointerMove(t,e)},o.prototype._pointerMove=function(t,e){this.pointerMove(t,e)},o.prototype.pointerMove=function(t,e){this.emitEvent("pointerMove",[t,e])},o.prototype.onmouseup=function(t){this._pointerUp(t,t)},o.prototype.onMSPointerUp=o.prototype.onpointerup=function(t){t.pointerId==this.pointerIdentifier&&this._pointerUp(t,t)},o.prototype.ontouchend=function(t){var e=this.getTouch(t.changedTouches);e&&this._pointerUp(t,e)},o.prototype._pointerUp=function(t,e){this._pointerDone(),this.pointerUp(t,e)},o.prototype.pointerUp=function(t,e){this.emitEvent("pointerUp",[t,e])},o.prototype._pointerDone=function(){this.isPointerDown=!1,delete this.pointerIdentifier,this._unbindPostStartEvents(),this.pointerDone()},o.prototype.pointerDone=n,o.prototype.onMSPointerCancel=o.prototype.onpointercancel=function(t){t.pointerId==this.pointerIdentifier&&this._pointerCancel(t,t)},o.prototype.ontouchcancel=function(t){var e=this.getTouch(t.changedTouches);e&&this._pointerCancel(t,e)},o.prototype._pointerCancel=function(t,e){this._pointerDone(),this.pointerCancel(t,e)},o.prototype.pointerCancel=function(t,e){this.emitEvent("pointerCancel",[t,e])},o.getPointerPoint=function(t){return{x:void 0!==t.pageX?t.pageX:t.clientX,y:void 0!==t.pageY?t.pageY:t.clientY}},o}),function(t,e){"function"==typeof define&&define.amd?define("unidragger/unidragger",["eventie/eventie","unipointer/unipointer"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("eventie"),require("unipointer")):t.Unidragger=e(t,t.eventie,t.Unipointer)}(window,function(t,e,i){function n(){}function o(t){t.preventDefault?t.preventDefault():t.returnValue=!1}function r(){}function s(){return!1}r.prototype=new i,r.prototype.bindHandles=function(){this._bindHandles(!0)},r.prototype.unbindHandles=function(){this._bindHandles(!1)};var a=t.navigator;r.prototype._bindHandles=function(t){t=void 0===t?!0:!!t;var i;i=a.pointerEnabled?function(e){e.style.touchAction=t?"none":""}:a.msPointerEnabled?function(e){e.style.msTouchAction=t?"none":""}:function(){t&&c(s)};for(var n=t?"bind":"unbind",o=0,r=this.handles.length;r>o;o++){var s=this.handles[o];this._bindStartEvent(s,t),i(s),e[n](s,"click",this)}};var l="attachEvent"in document.documentElement,c=l?function(t){"IMG"==t.nodeName&&(t.ondragstart=s);for(var e=t.querySelectorAll("img"),i=0,n=e.length;n>i;i++){var o=e[i];o.ondragstart=s}}:n;return r.prototype.pointerDown=function(t,e){this._dragPointerDown(t,e);var i=document.activeElement;i&&i.blur&&i.blur(),this._bindPostStartEvents(t),this.emitEvent("pointerDown",[t,e])},r.prototype._dragPointerDown=function(t,e){this.pointerDownPoint=i.getPointerPoint(e);var n="touchstart"==t.type,r=t.target.nodeName;n||"SELECT"==r||o(t)},r.prototype.pointerMove=function(t,e){var i=this._dragPointerMove(t,e);this.emitEvent("pointerMove",[t,e,i]),this._dragMove(t,e,i)},r.prototype._dragPointerMove=function(t,e){var n=i.getPointerPoint(e),o={x:n.x-this.pointerDownPoint.x,y:n.y-this.pointerDownPoint.y};return!this.isDragging&&this.hasDragStarted(o)&&this._dragStart(t,e),o},r.prototype.hasDragStarted=function(t){return Math.abs(t.x)>3||Math.abs(t.y)>3},r.prototype.pointerUp=function(t,e){this.emitEvent("pointerUp",[t,e]),this._dragPointerUp(t,e)},r.prototype._dragPointerUp=function(t,e){this.isDragging?this._dragEnd(t,e):this._staticClick(t,e)},r.prototype._dragStart=function(t,e){this.isDragging=!0,this.dragStartPoint=r.getPointerPoint(e),this.isPreventingClicks=!0,this.dragStart(t,e)},r.prototype.dragStart=function(t,e){this.emitEvent("dragStart",[t,e])},r.prototype._dragMove=function(t,e,i){this.isDragging&&this.dragMove(t,e,i)},r.prototype.dragMove=function(t,e,i){o(t),this.emitEvent("dragMove",[t,e,i])},r.prototype._dragEnd=function(t,e){this.isDragging=!1;var i=this;setTimeout(function(){delete i.isPreventingClicks}),this.dragEnd(t,e)},r.prototype.dragEnd=function(t,e){this.emitEvent("dragEnd",[t,e])},r.prototype.onclick=function(t){this.isPreventingClicks&&o(t)},r.prototype._staticClick=function(t,e){var i=t.target.nodeName;("INPUT"==i||"TEXTAREA"==i)&&t.target.focus(),this.staticClick(t,e)},r.prototype.staticClick=function(t,e){this.emitEvent("staticClick",[t,e])},r.getPointerPoint=function(t){return{x:void 0!==t.pageX?t.pageX:t.clientX,y:void 0!==t.pageY?t.pageY:t.clientY}
},r.getPointerPoint=i.getPointerPoint,r}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/drag",["classie/classie","eventie/eventie","./flickity","unidragger/unidragger","fizzy-ui-utils/utils"],function(i,n,o,r,s){return e(t,i,n,o,r,s)}):"object"==typeof exports?module.exports=e(t,require("desandro-classie"),require("eventie"),require("./flickity"),require("unidragger"),require("fizzy-ui-utils")):(t.Flickity=t.Flickity||{},t.Flickity.dragPrototype=e(t,t.classie,t.eventie,t.Flickity,t.Unidragger,t.fizzyUIUtils))}(window,function(t,e,i,n,o,r){function s(t){t.preventDefault?t.preventDefault():t.returnValue=!1}function a(e){var i=o.getPointerPoint(e);return i.y-t.pageYOffset}r.extend(n.defaults,{draggable:!0,touchVerticalScroll:!0}),n.createMethods.push("_createDrag");var l={};r.extend(l,o.prototype),l._createDrag=function(){this.on("activate",this.bindDrag),this.on("uiChange",this._uiChangeDrag),this.on("childUIPointerDown",this._childUIPointerDownDrag),this.on("deactivate",this.unbindDrag)},l.bindDrag=function(){this.options.draggable&&!this.isDragBound&&(e.add(this.element,"is-draggable"),this.handles=[this.viewport],this.bindHandles(),this.isDragBound=!0)},l.unbindDrag=function(){this.isDragBound&&(e.remove(this.element,"is-draggable"),this.unbindHandles(),delete this.isDragBound)},l._uiChangeDrag=function(){delete this.isFreeScrolling},l._childUIPointerDownDrag=function(t){s(t),this.pointerDownFocus(t)},l.pointerDown=function(t,i){this._dragPointerDown(t,i);var n=document.activeElement;n&&n.blur&&n!=this.element&&n!=document.body&&n.blur(),this.pointerDownFocus(t),this.velocity=0,e.add(this.viewport,"is-pointer-down"),this._bindPostStartEvents(t),this.dispatchEvent("pointerDown",t,[i])};var c={touchstart:!0,MSPointerDown:!0},h={INPUT:!0,SELECT:!0};l.pointerDownFocus=function(t){!this.options.accessibility||c[t.type]||h[t.target.nodeName]||this.element.focus()},l.pointerMove=function(t,e){var i=this._dragPointerMove(t,e);this.touchVerticalScrollMove(t,e,i),this._dragMove(t,e,i),this.dispatchEvent("pointerMove",t,[e,i])},l.hasDragStarted=function(t){return!this.isTouchScrolling&&Math.abs(t.x)>3},l.pointerUp=function(t,i){delete this.isTouchScrolling,e.remove(this.viewport,"is-pointer-down"),this.dispatchEvent("pointerUp",t,[i]),this._dragPointerUp(t,i)};var d={touchmove:!0,MSPointerMove:!0};return l.touchVerticalScrollMove=function(e,i,n){var o=this.options.touchVerticalScroll,r="withDrag"==o?!o:this.isDragging||!o;!r&&d[e.type]&&!this.isTouchScrolling&&Math.abs(n.y)>10&&(this.startScrollY=t.pageYOffset,this.pointerWindowStartY=a(i),this.isTouchScrolling=!0)},l.dragStart=function(t,e){this.dragStartPosition=this.x,this.startAnimation(),this.dispatchEvent("dragStart",t,[e])},l.dragMove=function(t,e,i){s(t),this.previousDragX=this.x;var n=i.x,o=this.options.rightToLeft?-1:1;if(this.x=this.dragStartPosition+n*o,!this.options.wrapAround&&this.cells.length){var r=Math.max(-this.cells[0].target,this.dragStartPosition);this.x=this.x>r?.5*(this.x-r)+r:this.x;var a=Math.min(-this.getLastCell().target,this.dragStartPosition);this.x=this.x<a?.5*(this.x-a)+a:this.x}this.previousDragMoveTime=this.dragMoveTime,this.dragMoveTime=new Date,this.dispatchEvent("dragMove",t,[e,i])},l.dragEnd=function(t,e){this.dragEndFlick(),this.options.freeScroll&&(this.isFreeScrolling=!0);var i=this.dragEndRestingSelect();if(this.options.freeScroll&&!this.options.wrapAround){var n=this.getRestingPosition();this.isFreeScrolling=-n>this.cells[0].target&&-n<this.getLastCell().target}else this.options.freeScroll||i!=this.selectedIndex||(i+=this.dragEndBoostSelect());this.select(i),this.dispatchEvent("dragEnd",t,[e])},l.dragEndFlick=function(){if(isFinite(this.previousDragX)){var t=this.dragMoveTime-this.previousDragMoveTime;if(t){t/=1e3/60;var e=this.x-this.previousDragX;this.velocity=e/t}delete this.previousDragX}},l.dragEndRestingSelect=function(){var t=this.getRestingPosition(),e=Math.abs(this.getCellDistance(-t,this.selectedIndex)),i=this._getClosestResting(t,e,1),n=this._getClosestResting(t,e,-1),o=i.distance<n.distance?i.index:n.index;return this.options.contain&&!this.options.wrapAround&&(o=Math.abs(o-this.selectedIndex)<=1?this.selectedIndex:o),o},l._getClosestResting=function(t,e,i){for(var n=this.selectedIndex,o=1/0,r=this.options.contain&&!this.options.wrapAround?function(t,e){return e>=t}:function(t,e){return e>t};r(e,o)&&(n+=i,o=e,e=this.getCellDistance(-t,n),null!==e);)e=Math.abs(e);return{distance:o,index:n-i}},l.getCellDistance=function(t,e){var i=this.cells.length,n=this.options.wrapAround&&i>1,o=n?r.modulo(e,i):e,s=this.cells[o];if(!s)return null;var a=n?this.slideableWidth*Math.floor(e/i):0;return t-(s.target+a)},l.dragEndBoostSelect=function(){var t=this.getCellDistance(-this.x,this.selectedIndex);return t>0&&this.velocity<-1?1:0>t&&this.velocity>1?-1:0},l.staticClick=function(t,e){var i=this.getParentCell(t.target),n=i&&i.element,o=i&&r.indexOf(this.cells,i);this.dispatchEvent("staticClick",t,[e,n,o])},r.extend(n.prototype,l),n}),function(t,e){"function"==typeof define&&define.amd?define("tap-listener/tap-listener",["unipointer/unipointer"],function(i){return e(t,i)}):"object"==typeof exports?module.exports=e(t,require("unipointer")):t.TapListener=e(t,t.Unipointer)}(window,function(t,e){function i(t){t.preventDefault?t.preventDefault():t.returnValue=!1}function n(t){this.bindTap(t)}n.prototype=new e,n.prototype.bindTap=function(t){t&&(this.unbindTap(),this.tapElement=t,this._bindStartEvent(t,!0))},n.prototype.unbindTap=function(){this.tapElement&&(this._bindStartEvent(this.tapElement,!0),delete this.tapElement)};var o=n.prototype.pointerDown;n.prototype.pointerDown=function(t){"touchstart"==t.type&&i(t),o.apply(this,arguments)};var r=void 0!==t.pageYOffset;return n.prototype.pointerUp=function(i,n){var o=e.getPointerPoint(n),s=this.tapElement.getBoundingClientRect(),a=r?t.pageXOffset:document.body.scrollLeft,l=r?t.pageYOffset:document.body.scrollTop,c=o.x>=s.left+a&&o.x<=s.right+a&&o.y>=s.top+l&&o.y<=s.bottom+l;c&&this.emitEvent("tap",[i,n])},n.prototype.destroy=function(){this.pointerDone(),this.unbindTap()},n}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/prev-next-button",["eventie/eventie","./flickity","tap-listener/tap-listener","fizzy-ui-utils/utils"],function(i,n,o,r){return e(t,i,n,o,r)}):"object"==typeof exports?module.exports=e(t,require("eventie"),require("./flickity"),require("tap-listener"),require("fizzy-ui-utils")):(t.Flickity=t.Flickity||{},t.Flickity.PrevNextButton=e(t,t.eventie,t.Flickity,t.TapListener,t.fizzyUIUtils))}(window,function(t,e,i,n,o){function r(t,e){this.direction=t,this.parent=e,this._create()}var s="http://www.w3.org/2000/svg",a=function(){function t(){if(void 0!==e)return e;var t=document.createElement("div");return t.innerHTML="<svg/>",e=(t.firstChild&&t.firstChild.namespaceURI)==s}var e;return t}();return r.prototype=new n,r.prototype._create=function(){this.isEnabled=!0,this.isPrevious=-1==this.direction;var t=this.parent.options.rightToLeft?1:-1;this.isLeft=this.direction==t;var e=this.element=document.createElement("button");if(e.className="flickity-prev-next-button",e.className+=this.isPrevious?" previous":" next",e.setAttribute("type","button"),i.setUnselectable(e),a()){var n=this.createSVG();e.appendChild(n)}else this.setArrowText(),e.className+=" no-svg";var o=this;this.onCellSelect=function(){o.update()},this.parent.on("cellSelect",this.onCellSelect),this.on("tap",this.onTap),this.on("pointerDown",function(t,e){o.parent.childUIPointerDown(e)})},r.prototype.activate=function(){this.update(),this.bindTap(this.element),e.bind(this.element,"click",this),this.parent.element.appendChild(this.element)},r.prototype.deactivate=function(){this.parent.element.removeChild(this.element),n.prototype.destroy.call(this),e.unbind(this.element,"click",this)},r.prototype.createSVG=function(){var t=document.createElementNS(s,"svg");t.setAttribute("viewBox","0 0 100 100");var e=document.createElementNS(s,"path");e.setAttribute("d","M 50,0 L 60,10 L 20,50 L 60,90 L 50,100 L 0,50 Z"),e.setAttribute("class","arrow");var i=this.isLeft?"translate(15,0)":"translate(85,100) rotate(180)";return e.setAttribute("transform",i),t.appendChild(e),t},r.prototype.setArrowText=function(){var t=this.parent.options,e=this.isLeft?t.leftArrowText:t.rightArrowText;o.setText(this.element,e)},r.prototype.onTap=function(){if(this.isEnabled){this.parent.uiChange();var t=this.isPrevious?"previous":"next";this.parent[t]()}},r.prototype.handleEvent=o.handleEvent,r.prototype.onclick=function(){var t=document.activeElement;t&&t==this.element&&this.onTap()},r.prototype.enable=function(){this.isEnabled||(this.element.disabled=!1,this.isEnabled=!0)},r.prototype.disable=function(){this.isEnabled&&(this.element.disabled=!0,this.isEnabled=!1)},r.prototype.update=function(){var t=this.parent.cells;if(this.parent.options.wrapAround&&t.length>1)return void this.enable();var e=t.length?t.length-1:0,i=this.isPrevious?0:e,n=this.parent.selectedIndex==i?"disable":"enable";this[n]()},r.prototype.destroy=function(){this.deactivate()},o.extend(i.defaults,{prevNextButtons:!0,leftArrowText:"‹",rightArrowText:"›"}),i.createMethods.push("_createPrevNextButtons"),i.prototype._createPrevNextButtons=function(){this.options.prevNextButtons&&(this.prevButton=new r(-1,this),this.nextButton=new r(1,this),this.on("activate",this.activatePrevNextButtons))},i.prototype.activatePrevNextButtons=function(){this.prevButton.activate(),this.nextButton.activate(),this.on("deactivate",this.deactivatePrevNextButtons)},i.prototype.deactivatePrevNextButtons=function(){this.prevButton.deactivate(),this.nextButton.deactivate(),this.off("deactivate",this.deactivatePrevNextButtons)},i.PrevNextButton=r,r}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/page-dots",["eventie/eventie","./flickity","tap-listener/tap-listener","fizzy-ui-utils/utils"],function(i,n,o,r){return e(t,i,n,o,r)}):"object"==typeof exports?module.exports=e(t,require("eventie"),require("./flickity"),require("tap-listener"),require("fizzy-ui-utils")):(t.Flickity=t.Flickity||{},t.Flickity.PageDots=e(t,t.eventie,t.Flickity,t.TapListener,t.fizzyUIUtils))}(window,function(t,e,i,n,o){function r(t){this.parent=t,this._create()}return r.prototype=new n,r.prototype._create=function(){this.holder=document.createElement("ol"),this.holder.className="flickity-page-dots",i.setUnselectable(this.holder),this.dots=[];var t=this;this.onCellSelect=function(){t.updateSelected()},this.parent.on("cellSelect",this.onCellSelect),this.on("tap",this.onTap),this.on("pointerDown",function(e,i){t.parent.childUIPointerDown(i)})},r.prototype.activate=function(){this.setDots(),this.updateSelected(),this.bindTap(this.holder),this.parent.element.appendChild(this.holder)},r.prototype.deactivate=function(){this.parent.element.removeChild(this.holder),n.prototype.destroy.call(this)},r.prototype.setDots=function(){var t=this.parent.cells.length-this.dots.length;t>0?this.addDots(t):0>t&&this.removeDots(-t)},r.prototype.addDots=function(t){for(var e=document.createDocumentFragment(),i=[];t;){var n=document.createElement("li");n.className="dot",e.appendChild(n),i.push(n),t--}this.holder.appendChild(e),this.dots=this.dots.concat(i)},r.prototype.removeDots=function(t){for(var e=this.dots.splice(this.dots.length-t,t),i=0,n=e.length;n>i;i++){var o=e[i];this.holder.removeChild(o)}},r.prototype.updateSelected=function(){this.selectedDot&&(this.selectedDot.className="dot"),this.dots.length&&(this.selectedDot=this.dots[this.parent.selectedIndex],this.selectedDot.className="dot is-selected")},r.prototype.onTap=function(t){var e=t.target;if("LI"==e.nodeName){this.parent.uiChange();var i=o.indexOf(this.dots,e);this.parent.select(i)}},r.prototype.destroy=function(){this.deactivate()},i.PageDots=r,o.extend(i.defaults,{pageDots:!0}),i.createMethods.push("_createPageDots"),i.prototype._createPageDots=function(){this.options.pageDots&&(this.pageDots=new r(this),this.on("activate",this.activatePageDots),this.on("cellAddedRemoved",this.onCellAddedRemovedPageDots),this.on("deactivate",this.deactivatePageDots))},i.prototype.activatePageDots=function(){this.pageDots.activate()},i.prototype.onCellAddedRemovedPageDots=function(){this.pageDots.setDots()},i.prototype.deactivatePageDots=function(){this.pageDots.deactivate()},i.PageDots=r,r}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/player",["eventEmitter/EventEmitter","eventie/eventie","./flickity"],function(t,i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(require("wolfy87-eventemitter"),require("eventie"),require("./flickity")):(t.Flickity=t.Flickity||{},t.Flickity.Player=e(t.EventEmitter,t.eventie,t.Flickity))}(window,function(t,e,i){function n(t){if(this.isPlaying=!1,this.parent=t,r){var e=this;this.onVisibilityChange=function(){e.visibilityChange()}}}var o,r;return"hidden"in document?(o="hidden",r="visibilitychange"):"webkitHidden"in document&&(o="webkitHidden",r="webkitvisibilitychange"),n.prototype=new t,n.prototype.play=function(){this.isPlaying=!0,delete this.isPaused,r&&document.addEventListener(r,this.onVisibilityChange,!1),this.tick()},n.prototype.tick=function(){if(this.isPlaying&&!this.isPaused){this.tickTime=new Date;var t=this.parent.options.autoPlay;t="number"==typeof t?t:3e3;var e=this;this.timeout=setTimeout(function(){e.parent.next(!0),e.tick()},t)}},n.prototype.stop=function(){this.isPlaying=!1,delete this.isPaused,this.clear(),r&&document.removeEventListener(r,this.onVisibilityChange,!1)},n.prototype.clear=function(){clearTimeout(this.timeout)},n.prototype.pause=function(){this.isPlaying&&(this.isPaused=!0,this.clear())},n.prototype.unpause=function(){this.isPaused&&this.play()},n.prototype.visibilityChange=function(){var t=document[o];this[t?"pause":"unpause"]()},i.createMethods.push("_createPlayer"),i.prototype._createPlayer=function(){this.player=new n(this),this.on("activate",this.activatePlayer),this.on("uiChange",this.stopPlayer),this.on("pointerDown",this.stopPlayer),this.on("deactivate",this.deactivatePlayer)},i.prototype.activatePlayer=function(){this.options.autoPlay&&(this.player.play(),e.bind(this.element,"mouseenter",this),this.isMouseenterBound=!0)},i.prototype.stopPlayer=function(){this.player.stop()},i.prototype.deactivatePlayer=function(){this.player.stop(),this.isMouseenterBound&&(e.unbind(this.element,"mouseenter",this),delete this.isMouseenterBound)},i.prototype.onmouseenter=function(){this.player.pause(),e.bind(this.element,"mouseleave",this)},i.prototype.onmouseleave=function(){this.player.unpause(),e.unbind(this.element,"mouseleave",this)},i.Player=n,n}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/add-remove-cell",["./flickity","fizzy-ui-utils/utils"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("./flickity"),require("fizzy-ui-utils")):(t.Flickity=t.Flickity||{},t.Flickity=e(t,t.Flickity,t.fizzyUIUtils))}(window,function(t,e,i){function n(t){for(var e=document.createDocumentFragment(),i=0,n=t.length;n>i;i++){var o=t[i];e.appendChild(o.element)}return e}return e.prototype.insert=function(t,e){var i=this._makeCells(t);if(i&&i.length){var o=this.cells.length;e=void 0===e?o:e;var r=n(i),s=e==o;if(s)this.slider.appendChild(r);else{var a=this.cells[e].element;this.slider.insertBefore(r,a)}if(0===e)this.cells=i.concat(this.cells);else if(s)this.cells=this.cells.concat(i);else{var l=this.cells.splice(e,o-e);this.cells=this.cells.concat(i).concat(l)}this._sizeCells(i);var c=e>this.selectedIndex?0:i.length;this._cellAddedRemoved(e,c)}},e.prototype.append=function(t){this.insert(t,this.cells.length)},e.prototype.prepend=function(t){this.insert(t,0)},e.prototype.remove=function(t){var e,n,o,r=this.getCells(t),s=0;for(e=0,n=r.length;n>e;e++){o=r[e];var a=i.indexOf(this.cells,o)<this.selectedIndex;s-=a?1:0}for(e=0,n=r.length;n>e;e++)o=r[e],o.remove(),i.removeFrom(this.cells,o);r.length&&this._cellAddedRemoved(0,s)},e.prototype._cellAddedRemoved=function(t,e){e=e||0,this.selectedIndex+=e,this.selectedIndex=Math.max(0,Math.min(this.cells.length-1,this.selectedIndex)),this.emitEvent("cellAddedRemoved",[t,e]),this.cellChange(t)},e.prototype.cellSizeChange=function(t){var e=this.getCell(t);if(e){e.getSize();var n=i.indexOf(this.cells,e);this.cellChange(n)}},e.prototype.cellChange=function(t){t=t||0,this._positionCells(t),this._getWrapShiftCells(),this.setGallerySize(),this.options.freeScroll?this.positionSlider():(this.positionSliderAtSelected(),this.select(this.selectedIndex))},e}),function(t,e){"function"==typeof define&&define.amd?define("flickity/js/index",["./flickity","./drag","./prev-next-button","./page-dots","./player","./add-remove-cell"],e):"object"==typeof exports&&(module.exports=e(require("./flickity"),require("./drag"),require("./prev-next-button"),require("./page-dots"),require("./player"),require("./add-remove-cell")))}(window,function(t){return t}),function(t,e){"function"==typeof define&&define.amd?define("flickity-as-nav-for/as-nav-for",["classie/classie","flickity/js/index","fizzy-ui-utils/utils"],function(i,n,o){return e(t,i,n,o)}):"object"==typeof exports?module.exports=e(t,require("desandro-classie"),require("flickity"),require("fizzy-ui-utils")):t.Flickity=e(t,t.classie,t.Flickity,t.fizzyUIUtils)}(window,function(t,e,i,n){return i.createMethods.push("_createAsNavFor"),i.prototype._createAsNavFor=function(){this.on("activate",this.activateAsNavFor),this.on("deactivate",this.deactivateAsNavFor),this.on("destroy",this.destroyAsNavFor);var t=this.options.asNavFor;if(t){var e=this;setTimeout(function(){e.setNavCompanion(t)})}},i.prototype.setNavCompanion=function(t){t=n.getQueryElement(t);var e=i.data(t);if(e&&e!=this){this.navCompanion=e;var o=this;this.onNavCompanionSelect=function(){o.navCompanionSelect()},e.on("cellSelect",this.onNavCompanionSelect),this.on("staticClick",this.onNavStaticClick),this.navCompanionSelect()}},i.prototype.navCompanionSelect=function(){if(this.navCompanion){var t=this.navCompanion.selectedIndex;this.select(t),this.removeNavSelectedElement(),this.selectedIndex==t&&(this.navSelectedElement=this.cells[t].element,e.add(this.navSelectedElement,"is-nav-selected"))}},i.prototype.activateAsNavFor=function(){this.navCompanionSelect()},i.prototype.removeNavSelectedElement=function(){this.navSelectedElement&&(e.remove(this.navSelectedElement,"is-nav-selected"),delete this.navSelectedElement)},i.prototype.onNavStaticClick=function(t,e,i,n){"number"==typeof n&&this.navCompanion.select(n)},i.prototype.deactivateAsNavFor=function(){this.removeNavSelectedElement()},i.prototype.destroyAsNavFor=function(){this.navCompanion&&(this.navCompanion.off("cellSelect",this.onNavCompanionSelect),this.off("staticClick",this.onNavStaticClick),delete this.navCompanion)},i}),function(t,e){"function"==typeof define&&define.amd?define("imagesloaded/imagesloaded",["eventEmitter/EventEmitter","eventie/eventie"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("wolfy87-eventemitter"),require("eventie")):t.imagesLoaded=e(t,t.EventEmitter,t.eventie)}(window,function(t,e,i){function n(t,e){for(var i in e)t[i]=e[i];return t}function o(t){return"[object Array]"===p.call(t)}function r(t){var e=[];if(o(t))e=t;else if("number"==typeof t.length)for(var i=0,n=t.length;n>i;i++)e.push(t[i]);else e.push(t);return e}function s(t,e,i){if(!(this instanceof s))return new s(t,e);"string"==typeof t&&(t=document.querySelectorAll(t)),this.elements=r(t),this.options=n({},this.options),"function"==typeof e?i=e:n(this.options,e),i&&this.on("always",i),this.getImages(),c&&(this.jqDeferred=new c.Deferred);var o=this;setTimeout(function(){o.check()})}function a(t){this.img=t}function l(t){this.src=t,u[t]=this}var c=t.jQuery,h=t.console,d="undefined"!=typeof h,p=Object.prototype.toString;s.prototype=new e,s.prototype.options={},s.prototype.getImages=function(){this.images=[];for(var t=0,e=this.elements.length;e>t;t++){var i=this.elements[t];"IMG"===i.nodeName&&this.addImage(i);var n=i.nodeType;if(n&&(1===n||9===n||11===n))for(var o=i.querySelectorAll("img"),r=0,s=o.length;s>r;r++){var a=o[r];this.addImage(a)}}},s.prototype.addImage=function(t){var e=new a(t);this.images.push(e)},s.prototype.check=function(){function t(t,o){return e.options.debug&&d&&h.log("confirm",t,o),e.progress(t),i++,i===n&&e.complete(),!0}var e=this,i=0,n=this.images.length;if(this.hasAnyBroken=!1,!n)return void this.complete();for(var o=0;n>o;o++){var r=this.images[o];r.on("confirm",t),r.check()}},s.prototype.progress=function(t){this.hasAnyBroken=this.hasAnyBroken||!t.isLoaded;var e=this;setTimeout(function(){e.emit("progress",e,t),e.jqDeferred&&e.jqDeferred.notify&&e.jqDeferred.notify(e,t)})},s.prototype.complete=function(){var t=this.hasAnyBroken?"fail":"done";this.isComplete=!0;var e=this;setTimeout(function(){if(e.emit(t,e),e.emit("always",e),e.jqDeferred){var i=e.hasAnyBroken?"reject":"resolve";e.jqDeferred[i](e)}})},c&&(c.fn.imagesLoaded=function(t,e){var i=new s(this,t,e);return i.jqDeferred.promise(c(this))}),a.prototype=new e,a.prototype.check=function(){var t=u[this.img.src]||new l(this.img.src);if(t.isConfirmed)return void this.confirm(t.isLoaded,"cached was confirmed");if(this.img.complete&&void 0!==this.img.naturalWidth)return void this.confirm(0!==this.img.naturalWidth,"naturalWidth");var e=this;t.on("confirm",function(t,i){return e.confirm(t.isLoaded,i),!0}),t.check()},a.prototype.confirm=function(t,e){this.isLoaded=t,this.emit("confirm",this,e)};var u={};return l.prototype=new e,l.prototype.check=function(){if(!this.isChecked){var t=new Image;i.bind(t,"load",this),i.bind(t,"error",this),t.src=this.src,this.isChecked=!0}},l.prototype.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},l.prototype.onload=function(t){this.confirm(!0,"onload"),this.unbindProxyEvents(t)},l.prototype.onerror=function(t){this.confirm(!1,"onerror"),this.unbindProxyEvents(t)},l.prototype.confirm=function(t,e){this.isConfirmed=!0,this.isLoaded=t,this.emit("confirm",this,e)},l.prototype.unbindProxyEvents=function(t){i.unbind(t.target,"load",this),i.unbind(t.target,"error",this)},s}),function(t,e){"function"==typeof define&&define.amd?define(["flickity/js/index","imagesloaded/imagesloaded"],function(i,n){return e(t,i,n)}):"object"==typeof exports?module.exports=e(t,require("flickity"),require("imagesloaded")):t.Flickity=e(t,t.Flickity,t.imagesLoaded)}(window,function(t,e,i){return e.createMethods.push("_createImagesLoaded"),e.prototype._createImagesLoaded=function(){this.on("activate",this.imagesLoaded)},e.prototype.imagesLoaded=function(){function t(t,i){var n=e.getParentCell(i.img);e.cellSizeChange(n&&n.element)}if(this.options.imagesLoaded){var e=this;i(this.slider).on("progress",t)}},e});
/*
 Version: 1.5.3
  Author: Ken Wheeler
 Website: http://kenwheeler.github.io
    Repo: http://github.com/kenwheeler/slick
 */
/* global window, document, define, jQuery, setInterval, clearInterval */
!function(a){"use strict";"function"==typeof define&&define.amd?define(["jquery"],a):"undefined"!=typeof exports?module.exports=a(require("jquery")):a(jQuery)}(function(a){"use strict";var b=window.Slick||{};b=function(){function c(c,d){var f,g,h,e=this;if(e.defaults={accessibility:!0,adaptiveHeight:!1,appendArrows:a(c),appendDots:a(c),arrows:!0,asNavFor:null,prevArrow:'<button type="button" data-role="none" class="slick-prev" aria-label="previous">Previous</button>',nextArrow:'<button type="button" data-role="none" class="slick-next" aria-label="next">Next</button>',autoplay:!1,autoplaySpeed:3e3,centerMode:!1,centerPadding:"50px",cssEase:"ease",customPaging:function(a,b){return'<button type="button" data-role="none">'+(b+1)+"</button>"},dots:!1,dotsClass:"slick-dots",draggable:!0,easing:"linear",edgeFriction:.35,fade:!1,focusOnSelect:!1,infinite:!0,initialSlide:0,lazyLoad:"ondemand",mobileFirst:!1,pauseOnHover:!0,pauseOnDotsHover:!1,respondTo:"window",responsive:null,rows:1,rtl:!1,slide:"",slidesPerRow:1,slidesToShow:1,slidesToScroll:1,speed:500,swipe:!0,swipeToSlide:!1,touchMove:!0,touchThreshold:5,useCSS:!0,variableWidth:!1,vertical:!1,verticalSwiping:!1,waitForAnimate:!0},e.initials={animating:!1,dragging:!1,autoPlayTimer:null,currentDirection:0,currentLeft:null,currentSlide:0,direction:1,$dots:null,listWidth:null,listHeight:null,loadIndex:0,$nextArrow:null,$prevArrow:null,slideCount:null,slideWidth:null,$slideTrack:null,$slides:null,sliding:!1,slideOffset:0,swipeLeft:null,$list:null,touchObject:{},transformsEnabled:!1,unslicked:!1},a.extend(e,e.initials),e.activeBreakpoint=null,e.animType=null,e.animProp=null,e.breakpoints=[],e.breakpointSettings=[],e.cssTransitions=!1,e.hidden="hidden",e.paused=!1,e.positionProp=null,e.respondTo=null,e.rowCount=1,e.shouldClick=!0,e.$slider=a(c),e.$slidesCache=null,e.transformType=null,e.transitionType=null,e.visibilityChange="visibilitychange",e.windowWidth=0,e.windowTimer=null,f=a(c).data("slick")||{},e.options=a.extend({},e.defaults,f,d),e.currentSlide=e.options.initialSlide,e.originalSettings=e.options,g=e.options.responsive||null,g&&g.length>-1){e.respondTo=e.options.respondTo||"window";for(h in g)g.hasOwnProperty(h)&&(e.breakpoints.push(g[h].breakpoint),e.breakpointSettings[g[h].breakpoint]=g[h].settings);e.breakpoints.sort(function(a,b){return e.options.mobileFirst===!0?a-b:b-a})}"undefined"!=typeof document.mozHidden?(e.hidden="mozHidden",e.visibilityChange="mozvisibilitychange"):"undefined"!=typeof document.webkitHidden&&(e.hidden="webkitHidden",e.visibilityChange="webkitvisibilitychange"),e.autoPlay=a.proxy(e.autoPlay,e),e.autoPlayClear=a.proxy(e.autoPlayClear,e),e.changeSlide=a.proxy(e.changeSlide,e),e.clickHandler=a.proxy(e.clickHandler,e),e.selectHandler=a.proxy(e.selectHandler,e),e.setPosition=a.proxy(e.setPosition,e),e.swipeHandler=a.proxy(e.swipeHandler,e),e.dragHandler=a.proxy(e.dragHandler,e),e.keyHandler=a.proxy(e.keyHandler,e),e.autoPlayIterator=a.proxy(e.autoPlayIterator,e),e.instanceUid=b++,e.htmlExpr=/^(?:\s*(<[\w\W]+>)[^>]*)$/,e.init(!0),e.checkResponsive(!0)}var b=0;return c}(),b.prototype.addSlide=b.prototype.slickAdd=function(b,c,d){var e=this;if("boolean"==typeof c)d=c,c=null;else if(0>c||c>=e.slideCount)return!1;e.unload(),"number"==typeof c?0===c&&0===e.$slides.length?a(b).appendTo(e.$slideTrack):d?a(b).insertBefore(e.$slides.eq(c)):a(b).insertAfter(e.$slides.eq(c)):d===!0?a(b).prependTo(e.$slideTrack):a(b).appendTo(e.$slideTrack),e.$slides=e.$slideTrack.children(this.options.slide),e.$slideTrack.children(this.options.slide).detach(),e.$slideTrack.append(e.$slides),e.$slides.each(function(b,c){a(c).attr("data-slick-index",b)}),e.$slidesCache=e.$slides,e.reinit()},b.prototype.animateHeight=function(){var a=this;if(1===a.options.slidesToShow&&a.options.adaptiveHeight===!0&&a.options.vertical===!1){var b=a.$slides.eq(a.currentSlide).outerHeight(!0);a.$list.animate({height:b},a.options.speed)}},b.prototype.animateSlide=function(b,c){var d={},e=this;e.animateHeight(),e.options.rtl===!0&&e.options.vertical===!1&&(b=-b),e.transformsEnabled===!1?e.options.vertical===!1?e.$slideTrack.animate({left:b},e.options.speed,e.options.easing,c):e.$slideTrack.animate({top:b},e.options.speed,e.options.easing,c):e.cssTransitions===!1?(e.options.rtl===!0&&(e.currentLeft=-e.currentLeft),a({animStart:e.currentLeft}).animate({animStart:b},{duration:e.options.speed,easing:e.options.easing,step:function(a){a=Math.ceil(a),e.options.vertical===!1?(d[e.animType]="translate("+a+"px, 0px)",e.$slideTrack.css(d)):(d[e.animType]="translate(0px,"+a+"px)",e.$slideTrack.css(d))},complete:function(){c&&c.call()}})):(e.applyTransition(),b=Math.ceil(b),d[e.animType]=e.options.vertical===!1?"translate3d("+b+"px, 0px, 0px)":"translate3d(0px,"+b+"px, 0px)",e.$slideTrack.css(d),c&&setTimeout(function(){e.disableTransition(),c.call()},e.options.speed))},b.prototype.asNavFor=function(b){var c=this,d=c.options.asNavFor;d&&null!==d&&(d=a(d).not(c.$slider)),null!==d&&"object"==typeof d&&d.each(function(){var c=a(this).slick("getSlick");c.unslicked||c.slideHandler(b,!0)})},b.prototype.applyTransition=function(a){var b=this,c={};c[b.transitionType]=b.options.fade===!1?b.transformType+" "+b.options.speed+"ms "+b.options.cssEase:"opacity "+b.options.speed+"ms "+b.options.cssEase,b.options.fade===!1?b.$slideTrack.css(c):b.$slides.eq(a).css(c)},b.prototype.autoPlay=function(){var a=this;a.autoPlayTimer&&clearInterval(a.autoPlayTimer),a.slideCount>a.options.slidesToShow&&a.paused!==!0&&(a.autoPlayTimer=setInterval(a.autoPlayIterator,a.options.autoplaySpeed))},b.prototype.autoPlayClear=function(){var a=this;a.autoPlayTimer&&clearInterval(a.autoPlayTimer)},b.prototype.autoPlayIterator=function(){var a=this;a.options.infinite===!1?1===a.direction?(a.currentSlide+1===a.slideCount-1&&(a.direction=0),a.slideHandler(a.currentSlide+a.options.slidesToScroll)):(0===a.currentSlide-1&&(a.direction=1),a.slideHandler(a.currentSlide-a.options.slidesToScroll)):a.slideHandler(a.currentSlide+a.options.slidesToScroll)},b.prototype.buildArrows=function(){var b=this;b.options.arrows===!0&&b.slideCount>b.options.slidesToShow&&(b.$prevArrow=a(b.options.prevArrow),b.$nextArrow=a(b.options.nextArrow),b.htmlExpr.test(b.options.prevArrow)&&b.$prevArrow.appendTo(b.options.appendArrows),b.htmlExpr.test(b.options.nextArrow)&&b.$nextArrow.appendTo(b.options.appendArrows),b.options.infinite!==!0&&b.$prevArrow.addClass("slick-disabled"))},b.prototype.buildDots=function(){var c,d,b=this;if(b.options.dots===!0&&b.slideCount>b.options.slidesToShow){for(d='<ul class="'+b.options.dotsClass+'">',c=0;c<=b.getDotCount();c+=1)d+="<li>"+b.options.customPaging.call(this,b,c)+"</li>";d+="</ul>",b.$dots=a(d).appendTo(b.options.appendDots),b.$dots.find("li").first().addClass("slick-active").attr("aria-hidden","false")}},b.prototype.buildOut=function(){var b=this;b.$slides=b.$slider.children(":not(.slick-cloned)").addClass("slick-slide"),b.slideCount=b.$slides.length,b.$slides.each(function(b,c){a(c).attr("data-slick-index",b)}),b.$slidesCache=b.$slides,b.$slider.addClass("slick-slider"),b.$slideTrack=0===b.slideCount?a('<div class="slick-track"/>').appendTo(b.$slider):b.$slides.wrapAll('<div class="slick-track"/>').parent(),b.$list=b.$slideTrack.wrap('<div aria-live="polite" class="slick-list"/>').parent(),b.$slideTrack.css("opacity",0),(b.options.centerMode===!0||b.options.swipeToSlide===!0)&&(b.options.slidesToScroll=1),a("img[data-lazy]",b.$slider).not("[src]").addClass("slick-loading"),b.setupInfinite(),b.buildArrows(),b.buildDots(),b.updateDots(),b.options.accessibility===!0&&b.$list.prop("tabIndex",0),b.setSlideClasses("number"==typeof this.currentSlide?this.currentSlide:0),b.options.draggable===!0&&b.$list.addClass("draggable")},b.prototype.buildRows=function(){var b,c,d,e,f,g,h,a=this;if(e=document.createDocumentFragment(),g=a.$slider.children(),a.options.rows>1){for(h=a.options.slidesPerRow*a.options.rows,f=Math.ceil(g.length/h),b=0;f>b;b++){var i=document.createElement("div");for(c=0;c<a.options.rows;c++){var j=document.createElement("div");for(d=0;d<a.options.slidesPerRow;d++){var k=b*h+(c*a.options.slidesPerRow+d);g.get(k)&&j.appendChild(g.get(k))}i.appendChild(j)}e.appendChild(i)}a.$slider.html(e),a.$slider.children().children().children().width(100/a.options.slidesPerRow+"%").css({display:"inline-block"})}},b.prototype.checkResponsive=function(b){var d,e,f,c=this,g=!1,h=c.$slider.width(),i=window.innerWidth||a(window).width();if("window"===c.respondTo?f=i:"slider"===c.respondTo?f=h:"min"===c.respondTo&&(f=Math.min(i,h)),c.originalSettings.responsive&&c.originalSettings.responsive.length>-1&&null!==c.originalSettings.responsive){e=null;for(d in c.breakpoints)c.breakpoints.hasOwnProperty(d)&&(c.originalSettings.mobileFirst===!1?f<c.breakpoints[d]&&(e=c.breakpoints[d]):f>c.breakpoints[d]&&(e=c.breakpoints[d]));null!==e?null!==c.activeBreakpoint?e!==c.activeBreakpoint&&(c.activeBreakpoint=e,"unslick"===c.breakpointSettings[e]?c.unslick(e):(c.options=a.extend({},c.originalSettings,c.breakpointSettings[e]),b===!0&&(c.currentSlide=c.options.initialSlide),c.refresh()),g=e):(c.activeBreakpoint=e,"unslick"===c.breakpointSettings[e]?c.unslick(e):(c.options=a.extend({},c.originalSettings,c.breakpointSettings[e]),b===!0?c.currentSlide=c.options.initialSlide:c.refresh()),g=e):null!==c.activeBreakpoint&&(c.activeBreakpoint=null,c.options=c.originalSettings,b===!0&&(c.currentSlide=c.options.initialSlide),c.refresh(),g=e),b||g===!1||c.$slider.trigger("breakpoint",[c,g])}},b.prototype.changeSlide=function(b,c){var f,g,h,d=this,e=a(b.target);switch(e.is("a")&&b.preventDefault(),e.is("li")||(e=e.closest("li")),h=0!==d.slideCount%d.options.slidesToScroll,f=h?0:(d.slideCount-d.currentSlide)%d.options.slidesToScroll,b.data.message){case"previous":g=0===f?d.options.slidesToScroll:d.options.slidesToShow-f,d.slideCount>d.options.slidesToShow&&d.slideHandler(d.currentSlide-g,!1,c);break;case"next":g=0===f?d.options.slidesToScroll:f,d.slideCount>d.options.slidesToShow&&d.slideHandler(d.currentSlide+g,!1,c);break;case"index":var i=0===b.data.index?0:b.data.index||e.index()*d.options.slidesToScroll;d.slideHandler(d.checkNavigable(i),!1,c),e.children().trigger("focus");break;default:return}},b.prototype.checkNavigable=function(a){var c,d,b=this;if(c=b.getNavigableIndexes(),d=0,a>c[c.length-1])a=c[c.length-1];else for(var e in c){if(a<c[e]){a=d;break}d=c[e]}return a},b.prototype.cleanUpEvents=function(){var b=this;b.options.dots===!0&&b.slideCount>b.options.slidesToShow&&a("li",b.$dots).off("click.slick",b.changeSlide),b.options.dots===!0&&b.options.pauseOnDotsHover===!0&&b.options.autoplay===!0&&a("li",b.$dots).off("mouseenter.slick",a.proxy(b.setPaused,b,!0)).off("mouseleave.slick",a.proxy(b.setPaused,b,!1)),b.options.arrows===!0&&b.slideCount>b.options.slidesToShow&&(b.$prevArrow&&b.$prevArrow.off("click.slick",b.changeSlide),b.$nextArrow&&b.$nextArrow.off("click.slick",b.changeSlide)),b.$list.off("touchstart.slick mousedown.slick",b.swipeHandler),b.$list.off("touchmove.slick mousemove.slick",b.swipeHandler),b.$list.off("touchend.slick mouseup.slick",b.swipeHandler),b.$list.off("touchcancel.slick mouseleave.slick",b.swipeHandler),b.$list.off("click.slick",b.clickHandler),a(document).off(b.visibilityChange,b.visibility),b.$list.off("mouseenter.slick",a.proxy(b.setPaused,b,!0)),b.$list.off("mouseleave.slick",a.proxy(b.setPaused,b,!1)),b.options.accessibility===!0&&b.$list.off("keydown.slick",b.keyHandler),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().off("click.slick",b.selectHandler),a(window).off("orientationchange.slick.slick-"+b.instanceUid,b.orientationChange),a(window).off("resize.slick.slick-"+b.instanceUid,b.resize),a("[draggable!=true]",b.$slideTrack).off("dragstart",b.preventDefault),a(window).off("load.slick.slick-"+b.instanceUid,b.setPosition),a(document).off("ready.slick.slick-"+b.instanceUid,b.setPosition)},b.prototype.cleanUpRows=function(){var b,a=this;a.options.rows>1&&(b=a.$slides.children().children(),b.removeAttr("style"),a.$slider.html(b))},b.prototype.clickHandler=function(a){var b=this;b.shouldClick===!1&&(a.stopImmediatePropagation(),a.stopPropagation(),a.preventDefault())},b.prototype.destroy=function(){var b=this;b.autoPlayClear(),b.touchObject={},b.cleanUpEvents(),a(".slick-cloned",b.$slider).detach(),b.$dots&&b.$dots.remove(),b.$prevArrow&&"object"!=typeof b.options.prevArrow&&b.$prevArrow.remove(),b.$nextArrow&&"object"!=typeof b.options.nextArrow&&b.$nextArrow.remove(),b.$slides&&(b.$slides.removeClass("slick-slide slick-active slick-center slick-visible").removeAttr("aria-hidden").removeAttr("data-slick-index").css({position:"",left:"",top:"",zIndex:"",opacity:"",width:""}),b.$slideTrack.children(this.options.slide).detach(),b.$slideTrack.detach(),b.$list.detach(),b.$slider.append(b.$slides)),b.cleanUpRows(),b.$slider.removeClass("slick-slider"),b.$slider.removeClass("slick-initialized"),b.unslicked=!0},b.prototype.disableTransition=function(a){var b=this,c={};c[b.transitionType]="",b.options.fade===!1?b.$slideTrack.css(c):b.$slides.eq(a).css(c)},b.prototype.fadeSlide=function(a,b){var c=this;c.cssTransitions===!1?(c.$slides.eq(a).css({zIndex:1e3}),c.$slides.eq(a).animate({opacity:1},c.options.speed,c.options.easing,b)):(c.applyTransition(a),c.$slides.eq(a).css({opacity:1,zIndex:1e3}),b&&setTimeout(function(){c.disableTransition(a),b.call()},c.options.speed))},b.prototype.filterSlides=b.prototype.slickFilter=function(a){var b=this;null!==a&&(b.unload(),b.$slideTrack.children(this.options.slide).detach(),b.$slidesCache.filter(a).appendTo(b.$slideTrack),b.reinit())},b.prototype.getCurrent=b.prototype.slickCurrentSlide=function(){var a=this;return a.currentSlide},b.prototype.getDotCount=function(){var a=this,b=0,c=0,d=0;if(a.options.infinite===!0)for(;b<a.slideCount;)++d,b=c+a.options.slidesToShow,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;else if(a.options.centerMode===!0)d=a.slideCount;else for(;b<a.slideCount;)++d,b=c+a.options.slidesToShow,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;return d-1},b.prototype.getLeft=function(a){var c,d,f,b=this,e=0;return b.slideOffset=0,d=b.$slides.first().outerHeight(),b.options.infinite===!0?(b.slideCount>b.options.slidesToShow&&(b.slideOffset=-1*b.slideWidth*b.options.slidesToShow,e=-1*d*b.options.slidesToShow),0!==b.slideCount%b.options.slidesToScroll&&a+b.options.slidesToScroll>b.slideCount&&b.slideCount>b.options.slidesToShow&&(a>b.slideCount?(b.slideOffset=-1*(b.options.slidesToShow-(a-b.slideCount))*b.slideWidth,e=-1*(b.options.slidesToShow-(a-b.slideCount))*d):(b.slideOffset=-1*b.slideCount%b.options.slidesToScroll*b.slideWidth,e=-1*b.slideCount%b.options.slidesToScroll*d))):a+b.options.slidesToShow>b.slideCount&&(b.slideOffset=(a+b.options.slidesToShow-b.slideCount)*b.slideWidth,e=(a+b.options.slidesToShow-b.slideCount)*d),b.slideCount<=b.options.slidesToShow&&(b.slideOffset=0,e=0),b.options.centerMode===!0&&b.options.infinite===!0?b.slideOffset+=b.slideWidth*Math.floor(b.options.slidesToShow/2)-b.slideWidth:b.options.centerMode===!0&&(b.slideOffset=0,b.slideOffset+=b.slideWidth*Math.floor(b.options.slidesToShow/2)),c=b.options.vertical===!1?-1*a*b.slideWidth+b.slideOffset:-1*a*d+e,b.options.variableWidth===!0&&(f=b.slideCount<=b.options.slidesToShow||b.options.infinite===!1?b.$slideTrack.children(".slick-slide").eq(a):b.$slideTrack.children(".slick-slide").eq(a+b.options.slidesToShow),c=f[0]?-1*f[0].offsetLeft:0,b.options.centerMode===!0&&(f=b.options.infinite===!1?b.$slideTrack.children(".slick-slide").eq(a):b.$slideTrack.children(".slick-slide").eq(a+b.options.slidesToShow+1),c=f[0]?-1*f[0].offsetLeft:0,c+=(b.$list.width()-f.outerWidth())/2)),c},b.prototype.getOption=b.prototype.slickGetOption=function(a){var b=this;return b.options[a]},b.prototype.getNavigableIndexes=function(){var e,a=this,b=0,c=0,d=[];for(a.options.infinite===!1?e=a.slideCount:(b=-1*a.options.slidesToScroll,c=-1*a.options.slidesToScroll,e=2*a.slideCount);e>b;)d.push(b),b=c+a.options.slidesToScroll,c+=a.options.slidesToScroll<=a.options.slidesToShow?a.options.slidesToScroll:a.options.slidesToShow;return d},b.prototype.getSlick=function(){return this},b.prototype.getSlideCount=function(){var c,d,e,b=this;return e=b.options.centerMode===!0?b.slideWidth*Math.floor(b.options.slidesToShow/2):0,b.options.swipeToSlide===!0?(b.$slideTrack.find(".slick-slide").each(function(c,f){return f.offsetLeft-e+a(f).outerWidth()/2>-1*b.swipeLeft?(d=f,!1):void 0}),c=Math.abs(a(d).attr("data-slick-index")-b.currentSlide)||1):b.options.slidesToScroll},b.prototype.goTo=b.prototype.slickGoTo=function(a,b){var c=this;c.changeSlide({data:{message:"index",index:parseInt(a)}},b)},b.prototype.init=function(b){var c=this;a(c.$slider).hasClass("slick-initialized")||(a(c.$slider).addClass("slick-initialized"),c.buildRows(),c.buildOut(),c.setProps(),c.startLoad(),c.loadSlider(),c.initializeEvents(),c.updateArrows(),c.updateDots()),b&&c.$slider.trigger("init",[c])},b.prototype.initArrowEvents=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.on("click.slick",{message:"previous"},a.changeSlide),a.$nextArrow.on("click.slick",{message:"next"},a.changeSlide))},b.prototype.initDotEvents=function(){var b=this;b.options.dots===!0&&b.slideCount>b.options.slidesToShow&&a("li",b.$dots).on("click.slick",{message:"index"},b.changeSlide),b.options.dots===!0&&b.options.pauseOnDotsHover===!0&&b.options.autoplay===!0&&a("li",b.$dots).on("mouseenter.slick",a.proxy(b.setPaused,b,!0)).on("mouseleave.slick",a.proxy(b.setPaused,b,!1))},b.prototype.initializeEvents=function(){var b=this;b.initArrowEvents(),b.initDotEvents(),b.$list.on("touchstart.slick mousedown.slick",{action:"start"},b.swipeHandler),b.$list.on("touchmove.slick mousemove.slick",{action:"move"},b.swipeHandler),b.$list.on("touchend.slick mouseup.slick",{action:"end"},b.swipeHandler),b.$list.on("touchcancel.slick mouseleave.slick",{action:"end"},b.swipeHandler),b.$list.on("click.slick",b.clickHandler),a(document).on(b.visibilityChange,a.proxy(b.visibility,b)),b.$list.on("mouseenter.slick",a.proxy(b.setPaused,b,!0)),b.$list.on("mouseleave.slick",a.proxy(b.setPaused,b,!1)),b.options.accessibility===!0&&b.$list.on("keydown.slick",b.keyHandler),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().on("click.slick",b.selectHandler),a(window).on("orientationchange.slick.slick-"+b.instanceUid,a.proxy(b.orientationChange,b)),a(window).on("resize.slick.slick-"+b.instanceUid,a.proxy(b.resize,b)),a("[draggable!=true]",b.$slideTrack).on("dragstart",b.preventDefault),a(window).on("load.slick.slick-"+b.instanceUid,b.setPosition),a(document).on("ready.slick.slick-"+b.instanceUid,b.setPosition)},b.prototype.initUI=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.show(),a.$nextArrow.show()),a.options.dots===!0&&a.slideCount>a.options.slidesToShow&&a.$dots.show(),a.options.autoplay===!0&&a.autoPlay()},b.prototype.keyHandler=function(a){var b=this;37===a.keyCode&&b.options.accessibility===!0?b.changeSlide({data:{message:"previous"}}):39===a.keyCode&&b.options.accessibility===!0&&b.changeSlide({data:{message:"next"}})},b.prototype.lazyLoad=function(){function g(b){a("img[data-lazy]",b).each(function(){var b=a(this),c=a(this).attr("data-lazy"),d=document.createElement("img");d.onload=function(){b.animate({opacity:1},200)},d.src=c,b.css({opacity:0}).attr("src",c).removeAttr("data-lazy").removeClass("slick-loading")})}var c,d,e,f,b=this;b.options.centerMode===!0?b.options.infinite===!0?(e=b.currentSlide+(b.options.slidesToShow/2+1),f=e+b.options.slidesToShow+2):(e=Math.max(0,b.currentSlide-(b.options.slidesToShow/2+1)),f=2+(b.options.slidesToShow/2+1)+b.currentSlide):(e=b.options.infinite?b.options.slidesToShow+b.currentSlide:b.currentSlide,f=e+b.options.slidesToShow,b.options.fade===!0&&(e>0&&e--,f<=b.slideCount&&f++)),c=b.$slider.find(".slick-slide").slice(e,f),g(c),b.slideCount<=b.options.slidesToShow?(d=b.$slider.find(".slick-slide"),g(d)):b.currentSlide>=b.slideCount-b.options.slidesToShow?(d=b.$slider.find(".slick-cloned").slice(0,b.options.slidesToShow),g(d)):0===b.currentSlide&&(d=b.$slider.find(".slick-cloned").slice(-1*b.options.slidesToShow),g(d))},b.prototype.loadSlider=function(){var a=this;a.setPosition(),a.$slideTrack.css({opacity:1}),a.$slider.removeClass("slick-loading"),a.initUI(),"progressive"===a.options.lazyLoad&&a.progressiveLazyLoad()},b.prototype.next=b.prototype.slickNext=function(){var a=this;a.changeSlide({data:{message:"next"}})},b.prototype.orientationChange=function(){var a=this;a.checkResponsive(),a.setPosition()},b.prototype.pause=b.prototype.slickPause=function(){var a=this;a.autoPlayClear(),a.paused=!0},b.prototype.play=b.prototype.slickPlay=function(){var a=this;a.paused=!1,a.autoPlay()},b.prototype.postSlide=function(a){var b=this;b.$slider.trigger("afterChange",[b,a]),b.animating=!1,b.setPosition(),b.swipeLeft=null,b.options.autoplay===!0&&b.paused===!1&&b.autoPlay()},b.prototype.prev=b.prototype.slickPrev=function(){var a=this;a.changeSlide({data:{message:"previous"}})},b.prototype.preventDefault=function(a){a.preventDefault()},b.prototype.progressiveLazyLoad=function(){var c,d,b=this;c=a("img[data-lazy]",b.$slider).length,c>0&&(d=a("img[data-lazy]",b.$slider).first(),d.attr("src",d.attr("data-lazy")).removeClass("slick-loading").load(function(){d.removeAttr("data-lazy"),b.progressiveLazyLoad(),b.options.adaptiveHeight===!0&&b.setPosition()}).error(function(){d.removeAttr("data-lazy"),b.progressiveLazyLoad()}))},b.prototype.refresh=function(){var b=this,c=b.currentSlide;b.destroy(),a.extend(b,b.initials),b.init(),b.changeSlide({data:{message:"index",index:c}},!1)},b.prototype.reinit=function(){var b=this;b.$slides=b.$slideTrack.children(b.options.slide).addClass("slick-slide"),b.slideCount=b.$slides.length,b.currentSlide>=b.slideCount&&0!==b.currentSlide&&(b.currentSlide=b.currentSlide-b.options.slidesToScroll),b.slideCount<=b.options.slidesToShow&&(b.currentSlide=0),b.setProps(),b.setupInfinite(),b.buildArrows(),b.updateArrows(),b.initArrowEvents(),b.buildDots(),b.updateDots(),b.initDotEvents(),b.options.focusOnSelect===!0&&a(b.$slideTrack).children().on("click.slick",b.selectHandler),b.setSlideClasses(0),b.setPosition(),b.$slider.trigger("reInit",[b])},b.prototype.resize=function(){var b=this;a(window).width()!==b.windowWidth&&(clearTimeout(b.windowDelay),b.windowDelay=window.setTimeout(function(){b.windowWidth=a(window).width(),b.checkResponsive(),b.setPosition()},50))},b.prototype.removeSlide=b.prototype.slickRemove=function(a,b,c){var d=this;return"boolean"==typeof a?(b=a,a=b===!0?0:d.slideCount-1):a=b===!0?--a:a,d.slideCount<1||0>a||a>d.slideCount-1?!1:(d.unload(),c===!0?d.$slideTrack.children().remove():d.$slideTrack.children(this.options.slide).eq(a).remove(),d.$slides=d.$slideTrack.children(this.options.slide),d.$slideTrack.children(this.options.slide).detach(),d.$slideTrack.append(d.$slides),d.$slidesCache=d.$slides,d.reinit(),void 0)},b.prototype.setCSS=function(a){var d,e,b=this,c={};b.options.rtl===!0&&(a=-a),d="left"==b.positionProp?Math.ceil(a)+"px":"0px",e="top"==b.positionProp?Math.ceil(a)+"px":"0px",c[b.positionProp]=a,b.transformsEnabled===!1?b.$slideTrack.css(c):(c={},b.cssTransitions===!1?(c[b.animType]="translate("+d+", "+e+")",b.$slideTrack.css(c)):(c[b.animType]="translate3d("+d+", "+e+", 0px)",b.$slideTrack.css(c)))},b.prototype.setDimensions=function(){var a=this;a.options.vertical===!1?a.options.centerMode===!0&&a.$list.css({padding:"0px "+a.options.centerPadding}):(a.$list.height(a.$slides.first().outerHeight(!0)*a.options.slidesToShow),a.options.centerMode===!0&&a.$list.css({padding:a.options.centerPadding+" 0px"})),a.listWidth=a.$list.width(),a.listHeight=a.$list.height(),a.options.vertical===!1&&a.options.variableWidth===!1?(a.slideWidth=Math.ceil(a.listWidth/a.options.slidesToShow),a.$slideTrack.width(Math.ceil(a.slideWidth*a.$slideTrack.children(".slick-slide").length))):a.options.variableWidth===!0?a.$slideTrack.width(5e3*a.slideCount):(a.slideWidth=Math.ceil(a.listWidth),a.$slideTrack.height(Math.ceil(a.$slides.first().outerHeight(!0)*a.$slideTrack.children(".slick-slide").length)));var b=a.$slides.first().outerWidth(!0)-a.$slides.first().width();a.options.variableWidth===!1&&a.$slideTrack.children(".slick-slide").width(a.slideWidth-b)},b.prototype.setFade=function(){var c,b=this;b.$slides.each(function(d,e){c=-1*b.slideWidth*d,b.options.rtl===!0?a(e).css({position:"relative",right:c,top:0,zIndex:800,opacity:0}):a(e).css({position:"relative",left:c,top:0,zIndex:800,opacity:0})}),b.$slides.eq(b.currentSlide).css({zIndex:900,opacity:1})},b.prototype.setHeight=function(){var a=this;if(1===a.options.slidesToShow&&a.options.adaptiveHeight===!0&&a.options.vertical===!1){var b=a.$slides.eq(a.currentSlide).outerHeight(!0);a.$list.css("height",b)}},b.prototype.setOption=b.prototype.slickSetOption=function(a,b,c){var d=this;d.options[a]=b,c===!0&&(d.unload(),d.reinit())},b.prototype.setPosition=function(){var a=this;a.setDimensions(),a.setHeight(),a.options.fade===!1?a.setCSS(a.getLeft(a.currentSlide)):a.setFade(),a.$slider.trigger("setPosition",[a])},b.prototype.setProps=function(){var a=this,b=document.body.style;a.positionProp=a.options.vertical===!0?"top":"left","top"===a.positionProp?a.$slider.addClass("slick-vertical"):a.$slider.removeClass("slick-vertical"),(void 0!==b.WebkitTransition||void 0!==b.MozTransition||void 0!==b.msTransition)&&a.options.useCSS===!0&&(a.cssTransitions=!0),void 0!==b.OTransform&&(a.animType="OTransform",a.transformType="-o-transform",a.transitionType="OTransition",void 0===b.perspectiveProperty&&void 0===b.webkitPerspective&&(a.animType=!1)),void 0!==b.MozTransform&&(a.animType="MozTransform",a.transformType="-moz-transform",a.transitionType="MozTransition",void 0===b.perspectiveProperty&&void 0===b.MozPerspective&&(a.animType=!1)),void 0!==b.webkitTransform&&(a.animType="webkitTransform",a.transformType="-webkit-transform",a.transitionType="webkitTransition",void 0===b.perspectiveProperty&&void 0===b.webkitPerspective&&(a.animType=!1)),void 0!==b.msTransform&&(a.animType="msTransform",a.transformType="-ms-transform",a.transitionType="msTransition",void 0===b.msTransform&&(a.animType=!1)),void 0!==b.transform&&a.animType!==!1&&(a.animType="transform",a.transformType="transform",a.transitionType="transition"),a.transformsEnabled=null!==a.animType&&a.animType!==!1},b.prototype.setSlideClasses=function(a){var c,d,e,f,b=this;b.$slider.find(".slick-slide").removeClass("slick-active").attr("aria-hidden","true").removeClass("slick-center"),d=b.$slider.find(".slick-slide"),b.options.centerMode===!0?(c=Math.floor(b.options.slidesToShow/2),b.options.infinite===!0&&(a>=c&&a<=b.slideCount-1-c?b.$slides.slice(a-c,a+c+1).addClass("slick-active").attr("aria-hidden","false"):(e=b.options.slidesToShow+a,d.slice(e-c+1,e+c+2).addClass("slick-active").attr("aria-hidden","false")),0===a?d.eq(d.length-1-b.options.slidesToShow).addClass("slick-center"):a===b.slideCount-1&&d.eq(b.options.slidesToShow).addClass("slick-center")),b.$slides.eq(a).addClass("slick-center")):a>=0&&a<=b.slideCount-b.options.slidesToShow?b.$slides.slice(a,a+b.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"):d.length<=b.options.slidesToShow?d.addClass("slick-active").attr("aria-hidden","false"):(f=b.slideCount%b.options.slidesToShow,e=b.options.infinite===!0?b.options.slidesToShow+a:a,b.options.slidesToShow==b.options.slidesToScroll&&b.slideCount-a<b.options.slidesToShow?d.slice(e-(b.options.slidesToShow-f),e+f).addClass("slick-active").attr("aria-hidden","false"):d.slice(e,e+b.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false")),"ondemand"===b.options.lazyLoad&&b.lazyLoad()},b.prototype.setupInfinite=function(){var c,d,e,b=this;if(b.options.fade===!0&&(b.options.centerMode=!1),b.options.infinite===!0&&b.options.fade===!1&&(d=null,b.slideCount>b.options.slidesToShow)){for(e=b.options.centerMode===!0?b.options.slidesToShow+1:b.options.slidesToShow,c=b.slideCount;c>b.slideCount-e;c-=1)d=c-1,a(b.$slides[d]).clone(!0).attr("id","").attr("data-slick-index",d-b.slideCount).prependTo(b.$slideTrack).addClass("slick-cloned");for(c=0;e>c;c+=1)d=c,a(b.$slides[d]).clone(!0).attr("id","").attr("data-slick-index",d+b.slideCount).appendTo(b.$slideTrack).addClass("slick-cloned");b.$slideTrack.find(".slick-cloned").find("[id]").each(function(){a(this).attr("id","")})}},b.prototype.setPaused=function(a){var b=this;b.options.autoplay===!0&&b.options.pauseOnHover===!0&&(b.paused=a,a?b.autoPlayClear():b.autoPlay())},b.prototype.selectHandler=function(b){var c=this,d=a(b.target).is(".slick-slide")?a(b.target):a(b.target).parents(".slick-slide"),e=parseInt(d.attr("data-slick-index"));return e||(e=0),c.slideCount<=c.options.slidesToShow?(c.$slider.find(".slick-slide").removeClass("slick-active").attr("aria-hidden","true"),c.$slides.eq(e).addClass("slick-active").attr("aria-hidden","false"),c.options.centerMode===!0&&(c.$slider.find(".slick-slide").removeClass("slick-center"),c.$slides.eq(e).addClass("slick-center")),c.asNavFor(e),void 0):(c.slideHandler(e),void 0)},b.prototype.slideHandler=function(a,b,c){var d,e,f,g,h=null,i=this;return b=b||!1,i.animating===!0&&i.options.waitForAnimate===!0||i.options.fade===!0&&i.currentSlide===a||i.slideCount<=i.options.slidesToShow?void 0:(b===!1&&i.asNavFor(a),d=a,h=i.getLeft(d),g=i.getLeft(i.currentSlide),i.currentLeft=null===i.swipeLeft?g:i.swipeLeft,i.options.infinite===!1&&i.options.centerMode===!1&&(0>a||a>i.getDotCount()*i.options.slidesToScroll)?(i.options.fade===!1&&(d=i.currentSlide,c!==!0?i.animateSlide(g,function(){i.postSlide(d)}):i.postSlide(d)),void 0):i.options.infinite===!1&&i.options.centerMode===!0&&(0>a||a>i.slideCount-i.options.slidesToScroll)?(i.options.fade===!1&&(d=i.currentSlide,c!==!0?i.animateSlide(g,function(){i.postSlide(d)}):i.postSlide(d)),void 0):(i.options.autoplay===!0&&clearInterval(i.autoPlayTimer),e=0>d?0!==i.slideCount%i.options.slidesToScroll?i.slideCount-i.slideCount%i.options.slidesToScroll:i.slideCount+d:d>=i.slideCount?0!==i.slideCount%i.options.slidesToScroll?0:d-i.slideCount:d,i.animating=!0,i.$slider.trigger("beforeChange",[i,i.currentSlide,e]),f=i.currentSlide,i.currentSlide=e,i.setSlideClasses(i.currentSlide),i.updateDots(),i.updateArrows(),i.options.fade===!0?(c!==!0?i.fadeSlide(e,function(){i.postSlide(e)}):i.postSlide(e),i.animateHeight(),void 0):(c!==!0?i.animateSlide(h,function(){i.postSlide(e)}):i.postSlide(e),void 0)))},b.prototype.startLoad=function(){var a=this;a.options.arrows===!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.hide(),a.$nextArrow.hide()),a.options.dots===!0&&a.slideCount>a.options.slidesToShow&&a.$dots.hide(),a.$slider.addClass("slick-loading")},b.prototype.swipeDirection=function(){var a,b,c,d,e=this;return a=e.touchObject.startX-e.touchObject.curX,b=e.touchObject.startY-e.touchObject.curY,c=Math.atan2(b,a),d=Math.round(180*c/Math.PI),0>d&&(d=360-Math.abs(d)),45>=d&&d>=0?e.options.rtl===!1?"left":"right":360>=d&&d>=315?e.options.rtl===!1?"left":"right":d>=135&&225>=d?e.options.rtl===!1?"right":"left":e.options.verticalSwiping===!0?d>=35&&135>=d?"left":"right":"vertical"},b.prototype.swipeEnd=function(){var c,b=this;if(b.dragging=!1,b.shouldClick=b.touchObject.swipeLength>10?!1:!0,void 0===b.touchObject.curX)return!1;if(b.touchObject.edgeHit===!0&&b.$slider.trigger("edge",[b,b.swipeDirection()]),b.touchObject.swipeLength>=b.touchObject.minSwipe)switch(b.swipeDirection()){case"left":c=b.options.swipeToSlide?b.checkNavigable(b.currentSlide+b.getSlideCount()):b.currentSlide+b.getSlideCount(),b.slideHandler(c),b.currentDirection=0,b.touchObject={},b.$slider.trigger("swipe",[b,"left"]);break;case"right":c=b.options.swipeToSlide?b.checkNavigable(b.currentSlide-b.getSlideCount()):b.currentSlide-b.getSlideCount(),b.slideHandler(c),b.currentDirection=1,b.touchObject={},b.$slider.trigger("swipe",[b,"right"])
}else b.touchObject.startX!==b.touchObject.curX&&(b.slideHandler(b.currentSlide),b.touchObject={})},b.prototype.swipeHandler=function(a){var b=this;if(!(b.options.swipe===!1||"ontouchend"in document&&b.options.swipe===!1||b.options.draggable===!1&&-1!==a.type.indexOf("mouse")))switch(b.touchObject.fingerCount=a.originalEvent&&void 0!==a.originalEvent.touches?a.originalEvent.touches.length:1,b.touchObject.minSwipe=b.listWidth/b.options.touchThreshold,b.options.verticalSwiping===!0&&(b.touchObject.minSwipe=b.listHeight/b.options.touchThreshold),a.data.action){case"start":b.swipeStart(a);break;case"move":b.swipeMove(a);break;case"end":b.swipeEnd(a)}},b.prototype.swipeMove=function(a){var d,e,f,g,h,b=this;return h=void 0!==a.originalEvent?a.originalEvent.touches:null,!b.dragging||h&&1!==h.length?!1:(d=b.getLeft(b.currentSlide),b.touchObject.curX=void 0!==h?h[0].pageX:a.clientX,b.touchObject.curY=void 0!==h?h[0].pageY:a.clientY,b.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(b.touchObject.curX-b.touchObject.startX,2))),b.options.verticalSwiping===!0&&(b.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(b.touchObject.curY-b.touchObject.startY,2)))),e=b.swipeDirection(),"vertical"!==e?(void 0!==a.originalEvent&&b.touchObject.swipeLength>4&&a.preventDefault(),g=(b.options.rtl===!1?1:-1)*(b.touchObject.curX>b.touchObject.startX?1:-1),b.options.verticalSwiping===!0&&(g=b.touchObject.curY>b.touchObject.startY?1:-1),f=b.touchObject.swipeLength,b.touchObject.edgeHit=!1,b.options.infinite===!1&&(0===b.currentSlide&&"right"===e||b.currentSlide>=b.getDotCount()&&"left"===e)&&(f=b.touchObject.swipeLength*b.options.edgeFriction,b.touchObject.edgeHit=!0),b.swipeLeft=b.options.vertical===!1?d+f*g:d+f*(b.$list.height()/b.listWidth)*g,b.options.verticalSwiping===!0&&(b.swipeLeft=d+f*g),b.options.fade===!0||b.options.touchMove===!1?!1:b.animating===!0?(b.swipeLeft=null,!1):(b.setCSS(b.swipeLeft),void 0)):void 0)},b.prototype.swipeStart=function(a){var c,b=this;return 1!==b.touchObject.fingerCount||b.slideCount<=b.options.slidesToShow?(b.touchObject={},!1):(void 0!==a.originalEvent&&void 0!==a.originalEvent.touches&&(c=a.originalEvent.touches[0]),b.touchObject.startX=b.touchObject.curX=void 0!==c?c.pageX:a.clientX,b.touchObject.startY=b.touchObject.curY=void 0!==c?c.pageY:a.clientY,b.dragging=!0,void 0)},b.prototype.unfilterSlides=b.prototype.slickUnfilter=function(){var a=this;null!==a.$slidesCache&&(a.unload(),a.$slideTrack.children(this.options.slide).detach(),a.$slidesCache.appendTo(a.$slideTrack),a.reinit())},b.prototype.unload=function(){var b=this;a(".slick-cloned",b.$slider).remove(),b.$dots&&b.$dots.remove(),b.$prevArrow&&"object"!=typeof b.options.prevArrow&&b.$prevArrow.remove(),b.$nextArrow&&"object"!=typeof b.options.nextArrow&&b.$nextArrow.remove(),b.$slides.removeClass("slick-slide slick-active slick-visible").attr("aria-hidden","true").css("width","")},b.prototype.unslick=function(a){var b=this;b.$slider.trigger("unslick",[b,a]),b.destroy()},b.prototype.updateArrows=function(){var b,a=this;b=Math.floor(a.options.slidesToShow/2),a.options.arrows===!0&&a.options.infinite!==!0&&a.slideCount>a.options.slidesToShow&&(a.$prevArrow.removeClass("slick-disabled"),a.$nextArrow.removeClass("slick-disabled"),0===a.currentSlide?(a.$prevArrow.addClass("slick-disabled"),a.$nextArrow.removeClass("slick-disabled")):a.currentSlide>=a.slideCount-a.options.slidesToShow&&a.options.centerMode===!1?(a.$nextArrow.addClass("slick-disabled"),a.$prevArrow.removeClass("slick-disabled")):a.currentSlide>=a.slideCount-1&&a.options.centerMode===!0&&(a.$nextArrow.addClass("slick-disabled"),a.$prevArrow.removeClass("slick-disabled")))},b.prototype.updateDots=function(){var a=this;null!==a.$dots&&(a.$dots.find("li").removeClass("slick-active").attr("aria-hidden","true"),a.$dots.find("li").eq(Math.floor(a.currentSlide/a.options.slidesToScroll)).addClass("slick-active").attr("aria-hidden","false"))},b.prototype.visibility=function(){var a=this;document[a.hidden]?(a.paused=!0,a.autoPlayClear()):a.options.autoplay===!0&&(a.paused=!1,a.autoPlay())},a.fn.slick=function(){var g,a=this,c=arguments[0],d=Array.prototype.slice.call(arguments,1),e=a.length,f=0;for(f;e>f;f++)if("object"==typeof c||"undefined"==typeof c?a[f].slick=new b(a[f],c):g=a[f].slick[c].apply(a[f].slick,d),"undefined"!=typeof g)return g;return a}});
jQuery( function ($) {
	var Sections = {
		init: function() {
			$( document )
				.on( 'shopify:section:load', this._onSectionLoad )
				.on( 'shopify:section:unload', this._onSectionUnload )
				.on( 'shopify:section:select', this._onSectionSelect )
				.on( 'shopify:section:deselect', this._onSectionDeselect )
				.on( 'shopify:block:select', this._onBlockSelect )
				.on( 'shopify:block:deselect', this._onBlockDeselect );
		},

		/**
		 * A section has been added or re-rendered.
		 */
		_onSectionLoad: function( e ) {
			var section = e.target.children[ 0 ].getAttribute( 'data-section-type' ) || false;
			if (section == false){
				var section = e.target.children[ 1 ].getAttribute( 'data-section-type' ) || false;
			}

	    	Site.images.loadBackgrounds();

			switch( section ) {
				case 'header':
					_loadHeader( e.target );
					break;
				case 'instagram':
					_loadInstagram( e.target );
					break;
				case 'gallery':
					_loadGallery( e.target );
					break;
				case 'slideshow':
					_loadHero( e.target );
					break;
				case 'collection-grid':
					_loadCollectionGrid( e.target );
					break;
				case 'collection-template':
					_loadCollectionTemplate( e.target );
					break;
				case 'product-template':
					_loadProductTemplate( e.target );
					break;
				case 'featured-blog':
					_loadFeaturedBlog( e.target );
					break;
				case 'search-template':
					_loadSearchTemplate( e.target );
					break;
				
			}

			function _loadHeader( t ) {
				var btn = $( '.js-menuToggle' );
				var page = $( 'body, html' );
				var content = $( '.bodyWrap' );
				var header = $( e.target.children[ 0 ] );

				var resetHeader = function() {
					page.removeClass( 'nav--is-visible' );
					content.removeAttr( 'style' );
					$('.siteAlert').css('transform','none');
				}

				var setHeaderPosition = function() {
	    			var promo = $('.js-siteAlert');
	    			var promoHeight = promo.outerHeight();

					if ( promo.length ){
						header.addClass( 'alert--is-visible shift--alert' );

						$( window ).scroll(function(){
							( $( window ).scrollTop() >= promoHeight ) ? header.removeClass( 'shift--alert' ) : header.addClass( 'shift--alert' );
						});
					}
				}

				resetHeader();

				setHeaderPosition();

				Site.nav.init();

				var firstChild = $('body').find('#shopify-section-top-bar');

				if(firstChild.length){

					var header = $('.site-header');

					header.addClass('alert--is-visible');

					header.addClass('shift--alert');

					$(window).scroll(function(){
						var height = firstChild.innerHeight();
						if ($(window).scrollTop() >= height) {
							header.removeClass('shift--alert');
						} else {
							header.addClass('shift--alert');
						}
					});

				};

				$('.header-fix-cont-inner').css('opacity','1');

				Cart.init();

			}

			function _loadInstagram( t ) {
				Insta.init();
			}

			function _loadFeaturedBlog( t ) {
				var blogSlider = $(t).find('.blogModule-slider');
				var options = JSON.parse( blogSlider.data( 'slick' ).replace(/'/g, '"') );
				blogSlider.slick( options );

			}

			function _loadGallery( t ) {	

					var slider, options;

					slider = $( t ).find( '.js-slider' );
					options = JSON.parse( slider.data( 'slick' ).replace(/'/g, '"') );
					
					slider.slick( options );

			}

			function _loadHero( t ) {
					var hero, options;

					hero = $( t ).find( '.js-hero-slider' );
					options = JSON.parse( hero.data( 'slick' ).replace(/'/g, '"') );
					hero.slick( options );
					$( t ).find('.slide-content').css('opacity','1');
			}

			function _loadCollectionGrid( t ) {
					var collectionGrid = $( t );
					var collectionSlider = collectionGrid.find( '.js-collection-slider' );
					var options = {};

					if ( collectionSlider.find('.js-slide').length > 1 ) {
						var collectionBlock = collectionGrid.find( '.js-collection' ),
							collectionSelector = collectionGrid.find( '.js-collection-selector' );

			            options = JSON.parse( collectionSlider.data( 'slick' ).replace(/'/g, '"') );
			            collectionSlider.slick( options );

						// Click the collection title to change the slide
						collectionBlock.each(function(){
							var $this = $(this),
								index = $this.index();

							$this.on('click', function(){
								collectionSlider.slick( 'slickGoTo', index );

								collectionSelector.val(index);

								// Remove .is-active class from all .collection elements
								collectionBlock.removeClass('is-active');

								// Add .is-active to $this
								if ($this.hasClass('is-active')) {
									$this.removeClass('is-active');
								} else {
									$this.addClass('is-active');
								}

								// hide open quickViews
								QuickView.hide();
							});
						});

						collectionSelector.bind('change',function(event) {
							var index = collectionSelector.val();
							collectionSlider.slick( 'slickGoTo', index );
							collectionBlock.removeClass('is-active');
							collectionBlock.eq(index).addClass('is-active');
							QuickView.hide();
						});

						var cancelHide = false;

						$('html, body').on('quickView:show', function(){
							cancelHide = true;
							collectionSlider.find('.slick-list').addClass('slick-list--quickview-open');
						});

						$('html, body').on('quickView:hide', function(){
							cancelHide = false;

							setTimeout(function(){
								if(!cancelHide) {
									collectionSlider.slick('setPosition');
									collectionSlider.find('.slick-list').removeClass('slick-list--quickview-open');
								}
							},1000);
						});
					}
			}

			function _loadCollectionTemplate( t ) {
				Collection.init();
				Site.sliders.init();
			}

			function _loadSearchTemplate( t ) {
				Search.init();
			}

			function _loadProductTemplate( t ) {
				var productTemplate = $( t );
				var update = true;
				var product = JSON.parse(document.getElementById('product-json').innerHTML);

				Product.init( update );

				Site.sliders.init();

				/**
				 * Reinitialize variant dropdown.
				 */
				new Shopify.OptionSelectors('product-select', {
					product: product,
					onVariantSelected: selectCallback
				});

			    manageOptions( product );

			    function manageOptions( obj ){
			      if (obj['options'].length === 1 && obj['variants'].length > 1){
			        for (i = 0; i < obj['options'].length; i++) {
			          $('#product-select-option-'+[i]).closest('.selector-wrapper').prepend('<span class="selectArrow"></span><label>'+obj['options'][0]+'</label>');
			        }
			      } else if (obj['options'].length > 1){
			        for (i = 0; i < obj['options'].length; i++) {
			          $('#product-select-option-'+[i]).closest('.selector-wrapper').prepend('<span class="selectArrow"></span>');
			        }
			      } else if (obj['options'].length === 1 && obj['variants'].length === 1){
			        $('#product-select-option-0').closest('.productForm-block').hide(); // hide wrapper
			      }
			    }
			}
		},

		/**
		 * A section has been deleted or is being re-rendered.
		 */
		_onSectionUnload: function( e ) {
			var section = e.target.children[ 0 ].getAttribute( 'data-section-type' ) || false;

			switch( section ) {
				case 'instagram':
					_unloadInstagram( e.target );
					break;
				case 'gallery':
					_unloadGallery( e.target );
					break;
				case 'slideshow':
					_unloadHero( e.target );
					break;
			}

			function _unloadInstagram( t ) {
				var slider = $( t ).find( '.js-instafeed' );

				slider.slick( 'unslick' );
			}

			function _unloadGallery( t ) {
				var slider = $( t ).find( '.js-slider' );

				slider.slick( 'unslick' );
			}

			function _unloadHero( t ) {
				var hero = $( t ).find( '.js-hero-slider' );

				hero.slick( 'unslick' );
			} 
		},

		/**
		 * User has selected the section in the sidebar.
		 */
		_onSectionSelect: function( e ) {

			var section = e.target.children[ 0 ].getAttribute( 'data-section-type' ) || false;
			switch( section ) {
				case 'header':
					_selectHeader( e.target );
					break;
				case 'gallery':
					_loadGallery( e.target );
					break;
				case 'slideshow':
					_loadHero (e.target);
			}

			function _selectHeader( t ) {
				Site.nav.show();
				$('.header-fix-cont-inner').css('opacity','1');
			}

			function _loadGallery( t ) {
					var slider, options;

					slider = $( t ).find( '.js-slider' );
					options = JSON.parse( slider.data( 'slick' ).replace(/'/g, '"') );
					
					slider.slick( options );
			}


			function _loadHero( t ) {

					var hero, options;

					hero = $( t ).find( '.js-hero-slider' );
					options = JSON.parse( hero.data( 'slick' ).replace(/'/g, '"') );
					
					hero.slick( options );
			}
		},

		/**
		 * User has selected the section in the sidebar.
		 */
		_onSectionDeselect: function( e ) {
			var section = e.target.children[ 0 ].getAttribute( 'data-section-type' ) || false;

			switch( section ) {
				case 'header':
					_deselectHeader( e.target );
					break;
			}

			function _deselectHeader( t ) {
				Site.nav.hide();
			}
		},

		/**
		 * User has selected the block in the sidebar.
		 */
		_onBlockSelect: function( e ) {
			var block = e.target.getAttribute( 'data-block' ) || false;

			switch( block ) {
				case 'slide':
					_selectBlockSlide( e.target );
			}

			function _selectBlockSlide( t ) {
				var slider, index;

				slider = $( t ).parents( '.slick-slider' );
				index = $( t ).attr( 'data-slick-index' );

				slider.slick( 'slickGoTo', index );
				slider.slick('slickPause');
			}

		},

				/**
		 * User has DEselected the block in the sidebar.
		 */
		_onBlockDeselect: function( e ) {
			var block = e.target.getAttribute( 'data-block' ) || false;

			switch( block ) {
				case 'slide':
					_deselectBlockSlide( e.target );
			}

			function _deselectBlockSlide( t ) {
				var slider, index;

				slider = $( t ).parents( '.slick-slider' );
				index = $( t ).attr( 'data-slick-index' );
				slider.slick('slickPlay')
			}

		}
	}

	var s;
	window.Site = {
		settings: {
			b: $('body'),
			w: $(window),
			d: $(document)
		},

		init: function(){
			s = this.settings;

			this.general();
			this.header();
			this.nav.init();
			this.sliders.init();
			this.images.loadBackgrounds();
			this.addresses.init();
			this.webkitSizing();
			this.keyboardAccessible();

			if ($('.js-siteAlert').length){
				this.promo.init();
			}
			if (this.getQueryParameter('customer_posted') == "true") {
				$('body').addClass('signUp-posted');
				s.d.scrollTop( s.d.height() - s.w.height() );
			}
		},

		/*
		 * General Bindings
		 */
		general: function(){
			// Fast click
			FastClick.attach(document.body);

			// Social sharing links
			s.b.on('click', '.share-link', function(event) {

				event.preventDefault();

				var el = $(this),
					popup = el.attr('data-network'),
					link = el.attr('href'),
					w = 700,
					h = 400;

				switch (popup) {
					case 'twitter':
						h = 300;
						break;
					case 'googleplus':
						w = 500;
						break;
				}

				window.open(link, popup, 'width=' + w + ', height=' + h);

			});

			s.spinner = $('#Spinner').html();

		},

		getQueryParameter: function(name) {
		    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
		    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		        results = regex.exec(location.search);
		    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
		},

		keyboardAccessible: function(){
			s.w.mousedown(function(event) {
				s.b.addClass("no-outline");
			});
			s.w.keyup(function(event) {
				if ( event.keyCode === 9 ) {
					s.b.removeClass("no-outline");
				}
			});
		},

		webkitSizing: function(){
			if (Modernizr.touch){
				var ww = $(window).outerWidth();
				var nw = Site.nav.getWidth();

				$('html, body').css({'max-width': ww});
				// Size offcanvas nav
				$('.nav-container').css({'width': nw});
				// Size header
				$('.site-header').css({'width': ww});

				$(window).resize(function(){
					var ww = $(window).outerWidth();
					var nw = Site.nav.getWidth();

					$('html, body').css({'max-width': ww});
					// Size offcanvas nav
					$('.nav-container').css({'width': nw});
					// Size header
					$('.site-header').css({'width': ww});
				});
			}
		},

		/*
		 * Header Scroll Function
		 */
		header: function(){
			var $header = $('.site-header'),
				scroll = 0,
				hero = $('.hero').outerHeight(),
				offset = $('.cartToggle').position().top; // accounts for the offset of the menu items

			if (!$('.template-index').length) {
				$header.addClass('has-scrolled').removeClass('header--no-bg');
			} else {
				/* Desktop with hero enabled (wait until after hero to transition header) */
				if ($(window).width() > 1024) {
					

						$(window).scroll(function(){
							scroll = $(window).scrollTop();

							if (scroll > (hero - offset)) {
								$header.addClass('has-scrolled').removeClass('header--no-bg');
							} else {
								$header.removeClass('has-scrolled').addClass('header--no-bg');
							}
						});
					
				} else {
					$(window).scroll(function(){
						scroll = $(window).scrollTop();

						

							if (scroll > (hero - offset)) {
								$header.addClass('has-scrolled').removeClass('header--no-bg');
							} else {
								$header.removeClass('has-scrolled').addClass('header--no-bg');
							}

						
					});
				}
			}

		initPadding();

		  $(document).on('shopify:section:reorder', function(event) {
		  		initPadding();
		  });

			function initPadding(){
				if($('body').hasClass('template-index')){
					var firstSectionParent = $('.bodyWrap').children(":first");
					if (!$(firstSectionParent).hasClass('header--full')){
						$('.bodyWrap').addClass('mo-padding');
					} 
				}
			}

		},

		promo: {
			alert: $('.js-siteAlert'),
			header: $('.site-header'),
			promo_inner: $('.js-siteAlert .block'),

			init: function(){
				var alert = this.alert,
					promo_inner = this.promo_inner,
					content = alert.html(),
					stored_content = localStorage.getItem('mosaic_promo_content') || 'null';
					Site.promo.updateHeader();
					$('.header-fix-cont-inner').css('opacity','1');

				$('.js-alert-close').on('click', function(){
					alert.removeClass('no-transition');
					setTimeout(function(){
						Site.promo.hide();
					}, 500);
				});

				function _updateHeight() {
					var height = promo_inner.innerHeight();
					alert.css('height', height);
				}

				function _setCookie(cname, cvalue, exdays) {
					var d = new Date();
					d.setTime(d.getTime() + (exdays*24*60*60*1000));
					var expires = "expires="+d.toUTCString();
					document.cookie = cname + "=" + cvalue + "; " + expires;
				}

				function _getCookie(cname) {
					var name = cname + "=";
					var ca = document.cookie.split(';');
					for(var i=0; i<ca.length; i++) {
						var c = ca[i];
						while (c.charAt(0)==' ') c = c.substring(1);
						if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
					}
					return "";
				}

				function _checkCookie() {
					var user = getCookie("username");
					if (user != "") {
						alert("Welcome again " + user);
					} else {
						user = prompt("Please enter your name:", "");
						if (user != "" && user != null) {
							setCookie("username", user, 365);
						}
					}
				}
			},
			show: function(){
				var alert = this.alert,
					promo_inner = alert.find('.block'),
					height = promo_inner.innerHeight();

				alert.css({'height': height});

				Site.promo.updateHeader();

				$(window).resize(
					Reqs.throttle(function(event){
						var height = promo_inner.innerHeight();

						alert.css({'height': height});
				}, 500));
			},
			hide: function(){
				var alert = this.alert,
					content = alert.html();

					alert.css({'height': 0});
				setTimeout(function(){
					alert.remove();
				}, 500);
				localStorage.setItem('mosaic_promo_content', content);
			},
			updateHeader: function(){
				var alert = this.alert,
					promo_inner = alert.find('.block'),
					height = promo_inner.innerHeight(),
					header = this.header;

				header.addClass('alert--is-visible');

				header.addClass('shift--alert');

				//header.css('top',height);

				$(window).scroll(function(){
					var height = promo_inner.innerHeight();

					if ($(window).scrollTop() >= height) {
						header.removeClass('shift--alert');
					} else {
						header.addClass('shift--alert');
					}
				});
			}
		},

		video: function(){
			var $video = $('.js-video').find('iframe'),
				$play = $('.js-video-play'),
				$overlay = $play.parent('.video-overlay');

			$play.on('click', function(){
				$video.attr('src', $video.attr('src')+'?autoplay=1');
				$overlay.fadeOut(300);
			});
		},

		/*
		 * Sliders
		 */
		sliders: {
			init: function(){
				this.hero();
				this.blogSlider();
				this.carousel();
				this.gallery();
				this.collection.init();
				this.product();
				this.productTabs();
				this.mosaic();
				this.search();
			},

			/* Homepage Hero Slider */
			hero: function(){
				var hero = $('.js-hero-slider');
				var options = {};

				if ( !Modernizr.cssvhunit || !Modernizr.cssvmaxunit ) hero.css( 'height', $(window).height() );

				hero.each( function () {
		            options = JSON.parse( $( this ).data( 'slick' ).replace(/'/g, '"') );

		            $( this ).slick( options );
		            $( this ).find('.slide-content').css('opacity','1');
				} );
				$('.slick-list').attr('tabindex','-1');

			},

			/* Search */
			search: function(){
				//Insert code as necessary for search template
				
			},

			/* Homepage Featured Blog Slider */
			blogSlider: function(){
				var blogSlider = $('.blogModule-slider');
				var options = {};

				if ( !Modernizr.cssvhunit || !Modernizr.cssvmaxunit ) blogSlider.css( 'height', $(window).height() );

				blogSlider.each( function () {
		            options = JSON.parse( $( this ).data( 'slick' ).replace(/'/g, '"') );
		            $( this ).slick( options );
		            checkForBlanks(blogSlider);
				} );

				$(blogSlider).on('afterChange', function(event, slick, currentSlide){
					checkForBlanks(blogSlider);
				});

				function checkForBlanks(slider){
					var slide = $(slider).find($('.slick-active'));
					if($(slide).hasClass('no-image')){
						$('button.slick-next, button.slick-prev').addClass('buttons--no-image');
					} else {
						$('button.slick-next, button.slick-prev').removeClass('buttons--no-image');
					}
				}
			},

			/* Carousel Slider
			 * Called multiple times throughout site
			 */
			carousel: function(){
				var $carousel = $('.js-carousel-slider');

				$carousel.flickity({
					cellSelector: '.js-slide',
				  	cellAlign: 'center',
				  	watchCSS: true,
				  	prevNextButtons: false,
				  	pageDots: false
				});
			},

			/* Gallery Slider */
			gallery: function(){
				var slider = $('.js-slider');
				var options = {};

				slider.each( function () {
		            options = JSON.parse( $( this ).data( 'slick' ).replace(/'/g, '"') );

		            $( this ).slick( options );
				} );
			},

			/* Collection Grid Slider
			 * No need to intialize unless there is more than one slide.
			 */
			collection: {
				init: function(){
					var collectionGrid = $( '.js-collection-grid' );

					collectionGrid.each( function() {
						var collectionSlider = $( this ).find( '.js-collection-slider' );
						var options = {};

						if ( collectionSlider.find('.js-slide').length > 1 ) {
							var collectionBlock = $( this ).find( '.js-collection' ),
								collectionSelector = $( this ).find( '.js-collection-selector' );

				            options = JSON.parse( collectionSlider.data( 'slick' ).replace(/'/g, '"') );
				            collectionSlider.slick( options );

							// Click the collection title to change the slide
							collectionBlock.each(function(){
								var $this = $(this),
									index = $this.index();

								$this.on('click', function(){
									collectionSlider.slick( 'slickGoTo', index );

									collectionSelector.val(index);

									// Remove .is-active class from all .collection elements
									collectionBlock.removeClass('is-active');

									// Add .is-active to $this
									if ($this.hasClass('is-active')) {
										$this.removeClass('is-active');
									} else {
										$this.addClass('is-active');
									}

									// hide open quickViews
									QuickView.hide();
								});
							});

							collectionSelector.bind('change',function(event) {
								var index = collectionSelector.val();
								collectionSlider.slick( 'slickGoTo', index );
								collectionBlock.removeClass('is-active');
								collectionBlock.eq(index).addClass('is-active');
								QuickView.hide();
							});

							var cancelHide = false;

							$('html, body').on('quickView:show', function(){
								cancelHide = true;
								collectionSlider.find('.slick-list').addClass('slick-list--quickview-open');
							});

							$('html, body').on('quickView:hide', function(){
								cancelHide = false;

								setTimeout(function(){
									if(!cancelHide) {
										collectionSlider.slick('setPosition');
										collectionSlider.find('.slick-list').removeClass('slick-list--quickview-open');
									}
								},1000);
							});
						}
					} );
				},
				resize: function(slider){
					// slider.slick('setOption', null, null, true);
				}
			},

			/* Product Slider - on mobile */
			product: function(){
				var $productImgSlider = $('.js-productImgSlider');
				var activeArrows = $productImgSlider.data('arrows');
				var activeDots = $productImgSlider.data('dots');

				if ( $productImgSlider.find('.js-slide').length > 1 ) {
					$productImgSlider.flickity({
						cellSelector: '.js-slide',
					  	cellAlign: 'center',
					  	watchCSS: true,
					  	prevNextButtons: activeArrows,
					  	pageDots: activeDots,
					  	selectedAttraction: 0.08,
						friction: 0.8,
						adaptiveHeight: true
					});
				}
			},

			/* Product Tabs */
			productTabs: function(){
				var $productTabs = $('.js-product-tabber');

				if ( $productTabs.find('.js-slide').length > 1 ) {
					var $tab = $('.product-tabs .product-tab');

					$productTabs.slick({
						slide: '.js-slide',
						arrows: false,
						infinite: false,
						speed: 300,
						fade: true,
						adaptiveHeight: true,
						draggable: false,
						swipe: false
					});

					// Click the product-tab title to change the tab
					$tab.each(function(){
						var $this = $(this),
							index = $this.index();

						$this.on('click', function(){
							$productTabs.slick( 'slickGoTo', index );

							// Remove .is-active class from all .product-tab elements
							$tab.removeClass('is-active');

							// Add .is-active to $this
							if ($this.hasClass('is-active')) {
								$this.removeClass('is-active');
							} else {
								$this.addClass('is-active');
							}
						});
					});

					var $socialIcons = $('.socialBar a');
					$socialIcons.on('click', function () {
						var $diamond = $(this).children('.diamond');
						$diamond.addClass('ripple-click');
						setTimeout(function(){
							$diamond.removeClass('ripple-click');
						},2000);
					});
				}
			},

			mosaic: function(){

				var $mosaicSliders = $('.mosaic-slider');

				if($mosaicSliders.length) {
					$mosaicSliders.flickity({
						cellSelector: '.mosaic-slide',
						prevNextButtons: false,
						pageDots: 'true' === 'true' ? true : false,
						autoPlay: parseInt('2000' != '' ? '2000' : false, 10),
						setGallerySize: false,
						wrapAround: true
					});
				}

			}
		},

		/*
		 * Main Menu
		 */
		nav: {
			getWidth: function() {
				var ww = $(window).outerWidth();

				if(ww >= 1280) {
					return ww / 3;
				} else if(ww >= 768) {
					return ww * 2 / 3;
				} else {
					return ww;
				}
			},
			init: function(){
				$body = $('body'),
				$overlay = $('.bodyOverlay'),
				$menuToggle = $('.js-menuToggle');
				$hamburger = $('#hamburger-menu');
				$navSocialLink = $('.nav-social-link');

				Site.nav.bindings();
				Site.nav.activeLinks();
			},
			bindings: function(){

				$menuToggle.on('click', function(e){
					e.preventDefault();

					if ($body.hasClass('nav--is-visible')){
						Site.nav.hide();
					} else {
						Site.nav.show();
					}
				});

				$('.bodyWrap').children().first().on('click', function(){
					Site.nav.hide();
				});

				$('.has-submenu > a').on('click', function(e){
					e.preventDefault();
					Site.nav.submenu.open( $(this) );
				});

				$('.submenu-back').on('click', function(e){
					e.preventDefault();
					Site.nav.submenu.close();
				});

				$('.js-searchToggle').on('click', function(){
					if ($('.nav-container').hasClass('search--is-visible')){
						Site.nav.search.close();
					} else {
						Site.nav.search.open();
					}
				});

				$navSocialLink.on('click', function (e) {
					var $diamond = $(this).children('.diamond');
					$diamond.addClass('ripple-click');
					setTimeout(function(){
						$diamond.removeClass('ripple-click');
					},500);
				});
			},
			show: function(){
				$hamburger.addClass('open');

				$('.js-searchToggle').focus();
				$('.js-searchToggle').attr('tabindex','0');
				$('.last-focusable-element').attr('tabindex','0');

				$body.add('html').addClass('nav--is-visible');

				$('.nav-inner').css({
					'transform': 'translateX(100%)'
				});

				$('.header-fix-cont-inner, .bodyWrap, .siteAlert, .main-logo').css({
					'transform': 'translateX('+$('.nav-inner').width()+'px)'
				});

				$(window).on('resize.siteNav', function() {
					$('.header-fix-cont-inner, .bodyWrap').css({
						'transform': 'translateX('+$('.nav-inner').width()+'px)'
					});
				});

				var activeEl = document.activeElement;
				if($(activeEl).hasClass('js-menuToggle ')){
					$('body').on('keydown', function(e) {
						if(e.which == 9){
							$('.js-searchToggle').focus();
						}
					});
				}

				$('body').on('keydown', function(e) {
				    if (e.which == 9) {
				    	var activeEl = document.activeElement;
				    	 if($(document.activeElement).hasClass('last-focusable-element')){
				    	 	Site.nav.hide();
				    	 	$('.last-focusable-element').attr('tabindex','-1');
				    	 }
				     } 
				});	

				$('.visible-nav-link').each(function(){
					$(this).removeAttr('tabindex');
				});

				$('body').on('keydown', function(e) {
					var activeEl = document.activeElement;
					var sibling = $(activeEl).next();
					if($(sibling).hasClass('is-visible') && e.which == 9 ){
						$('.submenu-item--link').each(function(){
							$(this).attr('tabindex','0');
						});
					}
					if($(activeEl).data('last') == true && e.which == 9){
						var menu = $(activeEl).parents().eq(3);
						$(menu).removeClass('submenu--is-visible');
						$('.submenu-item--link').each(function(){
							$(this).attr('tabindex','-1');
						});
					}
				});

				$('.js-searchToggle').attr('tabindex','0');
				$('#shopName').attr('tabindex','-1');
				$('#cartTotal').attr('tabindex','-1');

			},
			hide: function(){
				$hamburger.removeClass('open');
				$body.add('html').addClass('nav--is-hiding');

				$('.nav-inner, .header-fix-cont-inner, .bodyWrap, .siteAlert, .main-logo').add($hamburger).css({
					'transform': 'none'
				});

				$(window).off('resize.siteNav');

				setTimeout(function(){
					$body.add('html').removeClass('nav--is-visible');
					$body.add('html').removeClass('nav--is-hiding');
				}, 300);

				// close search too
				if ($('.nav-container').hasClass('search--is-visible')){
					Site.nav.search.close();
				}

				$('.visible-nav-link').each(function(){
					$(this).attr('tabindex','-1');
				});

				$('.js-searchToggle').removeAttr('tabindex');
				$('#shopName').attr('tabindex','0');
				$('#cartTotal').attr('tabindex','0');

			},

			activeLinks: function(){
				var $menu_items = $(".menu-item"),
						$submenu_items = $('.submenu-item');

				$menu_items.each(function(){
					if ($(this).find('> a').attr('href')=== window.location.pathname) {
						$(this).addClass('is-active');
					}
					// if no top-level link is active, then a submenu link is probably active
					else {
						$submenu_items.each(function(){
							if ($(this).find('> a').attr('href')=== window.location.pathname) {
								$(this).addClass('is-active'); // activate the active submenu link
								$(this).closest('.menu-item.has-submenu').addClass('is-active'); // activate parent as well
							} else {
								return; // must be homepage or page not in menu
							}
						});
					}
				});
			},

			/*
			 * Sub Menus
			 */
			submenu: {
				open: function(el){
					var $menu = $('.menu'),
						menuHeight = $menu.height();
					$menu.addClass('submenu--is-visible');

					var $elSubMenu = el.siblings('.submenu'),
						elSubMenuHeight = $elSubMenu.height();
					$elSubMenu.addClass('is-visible');

					if (menuHeight < elSubMenuHeight) {
						$menu.height(elSubMenuHeight);
					}
					return false;
				},
				close: function(){
					$('.menu').removeClass('submenu--is-visible').removeAttr("style");
					$('.submenu.is-visible').removeClass('is-visible');
					return false;
				}
			},

			/*
			 * Search
			 */
			search: {
				open: function(){
					$('.nav-container').addClass('search--is-visible');
					$('.nav-search-input').focus();
				},
				close: function(){
					$('.nav-container').addClass('search--is-hiding');
					setTimeout(function(){
						$('.nav-container').removeClass('search--is-visible search--is-hiding');
					}, 600);
				}
			}
		},

		images: {
			loadBackgrounds: function() {
				var $elementsToLoad = $('[data-bg-src]').not('.bg-loading, .bg-loaded');

				$elementsToLoad.each(function() {

					var $el = $(this);

					var src = $el.attr('data-bg-src');
					var placeholder = false;

					if(src == '') {
						src = '//cdn.shopify.com/s/files/1/0011/7686/2777/t/3/assets/placeholder-pattern.png?4934406588467452179';
						placeholder = true;
					}

					$el.addClass('bg-loading').prepend(s.spinner);

					var im = new Image();

					$(im).on('load', function() {

						$el.css('background-image', 'url('+src+')').removeClass('bg-loading').addClass('bg-loaded').find('.spinner').fadeOut(300, function() {
								$(this).remove();
							});

						if(placeholder) {
							$el.addClass('bg-placeholder');
						}

						// ensures image is visible in quickView when as it's opened
						if ($('.quickView').length){
							$('.quickView').find('.quickView-img-inner').addClass('quickView-variant-img--is-active');
						}

					});

					$(im).on('error', function() {
						$el.css('background-image', 'url(//cdn.shopify.com/s/files/1/0011/7686/2777/t/3/assets/placeholder-pattern.png?4934406588467452179)')
							.removeClass('bg-loading').addClass('bg-placeholder bg-loaded').find('.spinner').fadeOut(300, function() {
								$(this).remove();
							});
					});

					im.src = src;

					if(im.complete) {
						$(im).trigger('load');
					}

				})
			}
		},

		/*
		 * Form Address Validation
		 */
		addresses: {
			addAddressForm: $(".js-addAddress > form"),
			editAddressForm: $(".js-editAddress > form"),
			init: function () {
				$addAddressForm = this.addAddressForm,
				$editAddressForm = this.editAddressForm;

				Site.addresses.validating();
			},
			validating: function () {
				$addAddressForm.add($editAddressForm).submit(function (e) {
					var isEmpty = true;

					// Display notification if input is empty
					$(this).find('input').not(".optional").each(function () {
						if (!$(this).val()) {
							$(this).next().addClass("validation--showup");
						} else {
							$(this).next().removeClass("validation--showup");
						}
					});

					// Detect whether form is valid
					$(this).find('input').not(".optional").each(function () {
						if (!$(this).val()) {
							isEmpty = false;
						}
					});
					if (!isEmpty) {
						return false;
					}
				});
			}
		}
	}

	var popoverTimer,
	Cart = {
		init: function(){
			var $cart = $('#Cart');

			$('.js-cartToggle').on('click', function(e){
				var $this = $(this);

				if ($(window).width() > 768) {
					e.preventDefault();

					$body.toggleClass('cart--is-visible');
					$('html').css('overflow','hidden');
					if ($body.hasClass('cart--is-visible')) {
						$cart.removeClass('close');
						$cart.addClass('open');
					} else {
						$cart.removeClass('open');
						$cart.addClass('close');
						$('html').css('overflow','initial');
					}
					$('.js-continueShopping').attr('tabindex','0');
					//$('#cartTotal').attr('tabindex','0');
				} else {
					if ($this.hasClass('js-cartToggle-close')) {
						e.preventDefault();
						$('html').css('overflow','initial');
						$body.removeClass('cart--is-visible');
						$cart.removeClass('open');
						$cart.addClass('close');
					}
					$('.js-continueShopping').attr('tabindex','-1');
					//$('#cartTotal').attr('tabindex','0');

				}
			});

			$('body').on('click', '.js-productForm-submit', function(e) {
	        var $form = $(this).closest('form.productForm');

	        if ($form.find('[type="file"]').length) return;

	        e.preventDefault();

				Cart.submit($(this));
			});

			/* Continue Shopping link - hide cart overlay if on desktop */
			if ( ($(window).width() > 768) && !(window.location.href.indexOf('/cart') > -1) ){
				$('.js-continueShopping').on('click', function(e){
					e.preventDefault();
					$('.js-cartToggle').trigger('click');
				});
			}
		},
		submit: function(el){
		var $form = el.closest('form.productForm'),
        	product_handle = el.attr("data-handle"),
        	variant_id = $form.find('select[name="id"] option:selected').attr('value'),
        	quantity = $form.find('.inputCounter').prop('value'),
        	form_array = $form.serializeArray();


        var form_data = {};

        $.map(form_array, function(val, i){
          form_data[val.name] = val.value;
        });

			$.ajax({
				method: 'POST',
				url: '/cart/add.js',
				dataType: 'json',
				data: form_data,
				success: function(product){
					el.html("Added!");
					setTimeout(function(){
						el.html("Add To Cart");
					}, 1000);

					Cart.getCart(Cart.buildCart);

					if ($(window).width() > 550){
						Cart.popover.show(product);
					}
				},
				// If there are no products in the inventory
				error: function(data){
					$.ajax({
						method: 'GET',
						url: '/products/'+product_handle+'.js',
						dataType: 'json',
						success: function(product){
							var variants = product.variants,
									// variants is an array [0{},1{},2{}...]
									variant = $.each(variants, function(i, val){
										// val returns the contents of 0,1,2
										if (val.id == variant_id) {
											return variant_quantity = val.inventory_quantity; // set variant_quantity variable
										}
									}),
									$popover = $('#CartPopoverCont'), // same popover container used to show succesful cart/add.js
									error_details = "Sorry, looks like we don\u0026#39;t have enough of this product. Please try adding fewer items to your cart.", // translation string
									tag = new RegExp('\[\[i\]\]'), // checks for [[i]]
									error = error_details; // set error to just default to error_details

							if (tag.test(error_details) == true){
								// [[i]] is part of the trans string, this can be whatever,
								// but in the tutorial we use [[i]] so leave it
								error = error_details.replace('[[i]]', variant_quantity); // re-set error with new string
							}

							el.html("WOOPS!"); // swap button text
							setTimeout(function(){
								el.html("Add To Cart"); // swap it back
							}, 1000);

							// clear popover timer, set at top of Cart object
							clearTimeout(popoverTimer);

							// empty popover, add error (with inventory), show it, remove click events so it doesn't open cart
							$popover.empty().append('<div class="popover-error">'+error+'</div>').addClass('is-visible').css({'pointer-events': 'none'});
							// set new instance of popoverTimer
							popoverTimer = setTimeout(function(){
								$popover.removeClass('is-visible').css({'pointer-events': 'auto'});
							}, 5000);
						},
						error: function(){
							console.log("Error: product is out of stock. If you're seeing this, Cart.submit.error() must have failed.");
						}
					});
				}
			});
		},
		popover: {
			show: function(product){
				var $popover = $('#CartPopoverCont'),
					item = {},
					source = $('#CartPopover').html(),
					template = Handlebars.compile(source);

				item = {
					item_count: product.quantity,
					img: product.image,
					name: function(){
						name = product.product_title;

						if (name.length > 20){
							name = name.substring(0, 20)+' ...';
						}

						return name;
					},
					variation: product.variant_title == 'Default Title' ? false : product.variant_title,
					price: product.price,
					price_formatted: Shopify.formatMoney(product.price)
				}

				$popover.empty().append(template(item));

				// clear popover timer, set at top of Cart object
				clearTimeout(popoverTimer);

				$popover.addClass('is-visible');

				Site.images.loadBackgrounds();

				// set new instace of popoverTimer
				popoverTimer = setTimeout(function(){
					Cart.popover.hide($popover);
				}, 5000);
			},
			hide: function(el){
				el.removeClass('is-visible');
				setTimeout(function(){
					el.empty();
				}, 300);
			}
		},
		getCart: function(callback) {
		  $.getJSON('/cart.js', function (cart, textStatus) {
		    if ((typeof callback) === 'function') {
		      callback(cart);
		    }
		    else {
		      // ShopifyAPI.onCartUpdate(cart);
		    }
		  });
		},
		buildCart: function (cart) {
			var $cart = $('#Cart');
			// Start with a fresh cart div
			$cart.empty();

			// Show empty cart
			if (cart.item_count === 0) {
				$cart.append('<p>' + "It appears that your cart is currently empty!" + '</p>');
				return;
			}

			// Handlebars.js cart layout
			var items = [],
				item = {},
				data = {},
				source = $("#CartTemplate").html(),
				template = Handlebars.compile(source);

			// Add each item to our handlebars.js data
			$.each(cart.items, function(index, cartItem) {
				var itemAdd = cartItem.quantity + 1,
					itemMinus = cartItem.quantity - 1,
					itemQty = cartItem.quantity;

				/* Hack to get product image thumbnail
				*   - If image is not null
				*     - Remove file extension, add _small, and re-add extension
				*     - Create server relative link
				*   - A hard-coded url of no-image
				*/

				if (cartItem.image != null){
					var prodImg = cartItem.image.replace(/(\.[^.]*)$/, "_small$1").replace('http:', '');
				} else {
					var prodImg = "//cdn.shopify.com/s/assets/admin/no-image-medium-cc9732cb976dd349a0df1d39816fbcc7.gif";
				}

				var prodName = cartItem.product_title,
					prodVariation = cartItem.variant_title;

				if (prodVariation == 'Default Title') {
					prodVariation = false;
				}

				// Create item's data object and add to 'items' array
				item = {
					id: cartItem.variant_id,
					url: cartItem.url,
					img: prodImg,
					name: prodName,
					variation: prodVariation,
					itemAdd: itemAdd,
					itemMinus: itemMinus,
					itemQty: itemQty,
          properties: cartItem.properties,
					price: cartItem.price,
					price_formatted: Shopify.formatMoney(cartItem.price),
					vendor: cartItem.vendor
				};

				items.push(item);
			});

			// Gather all cart data and add to DOM
			data = {
				item_count: cart.item_count,
				items: items,
				note: cart.note,
				totalPrice: Shopify.formatMoney(cart.total_price)
			}

			// update cart slide-out with new cart
			$cart.append(template(data));

			// update cartToggle with new # of items
			$('#CartToggleItemCount').empty().html(cart.item_count);

			Site.images.loadBackgrounds();

	     	/**
	       	 * Re-init the ajax cart buttons.
		     * These are added to the handlebars template, but this
		     * js needs to fire to show them after the new
		     * cart is built and inserted.
		     * @see https://help.shopify.com/themes/customization/cart/add-more-checkout-buttons-to-cart-page
		     */
			if (window.Shopify && Shopify.StorefrontExpressButtons) {
				Shopify.StorefrontExpressButtons.initialize();
	      	}
    	}
	}

	var Collection = {
		init: function(){
			var tagFilter = document.getElementById( 'tagFilter' ) || false;
			var collectionFilter = document.getElementById( 'collectionFilter' ) || false;
			
			if( tagFilter ) {
				tagFilter.addEventListener( 'change', function() {
					document.location.href = this.options[ this.selectedIndex ].value;
				});
			}
			
			if( collectionFilter ) {
				collectionFilter.addEventListener( 'change', function() {
					document.location.href = '?sort_by=' + this.options[ this.selectedIndex ].value;
				} );
			}

			var productLimit = $('.js-collectionGrid').attr('data-products-limit');
			productLimit = parseInt(productLimit);
			$('.js-loadMore').click(function(){
			  $( '.product-in-waiting' ).each(function(index) {
			    if(index < productLimit){
			      $(this).removeClass('mask');
			      $(this).removeClass('product-in-waiting');
			    if( $('.product-in-waiting').length == 0 ){
			      	$('.js-loadMore').hide();
			     }
			    } else {
			      return false;
			    }
			  });
			});			

		},

		/**
		 * Sort collection using the dropdown
		 */
		initSort: function(){
			var	url = window.location.href,
				url_split = url.split('?sort_by='),
				active_filter = url_split[1],

				$selector = $('#collectionFilter'),
				$selected = $selector.find('option[value="'+active_filter+'"]');

			$selected.attr('selected', true);

			$selector.on('click', function() {
				if($selector.hasClass('loading')) {
					event.preventDefault();
				}
			});

			$selector.bind('change', function(event) {
				$selector.addClass('loading');
				$('body').addClass('ajax-sorting');

				var delay = Modernizr.csstransitions ? 200 : 0;

				setTimeout(function() {
					var filter = $selector.val();
					var url = window.location.href;
					var urlBase = url.split('?sort_by=')[0];

					var filterUrl = (filter === '') ? urlBase : urlBase+'?sort_by='+filter;

					if(Modernizr.history) {
						history.replaceState({}, $('title').text(), filterUrl);
						this.ajaxSort(filterUrl);
					} else {
						window.location = filterUrl;
					}
				}.bind(this), delay);
			}.bind(this));
		},

		ajaxSort: function(url) {
			var $loadMoreIcon = $('.collectionGrid-load.load-more-icon');

			$loadMoreIcon.show();
			$('.js-collectionGrid').hide().next('.row').hide();

			$.ajax({
				type: 'GET',
				dataType: "html",
				url: url,
				success: function(data) {
					var products = $(data).find('.js-collectionGrid')[0].outerHTML;
					var nextPage = $(data).find('.js-collectionGrid').next('.row')[0] ? $(data).find('.js-collectionGrid').next('.row')[0].outerHTML : '';

					$('.js-collectionGrid').replaceWith(products);
					$('.js-collectionGrid').next('.row').replaceWith(nextPage);
					$loadMoreIcon.hide();

					$('#collectionFilter').removeClass('loading');
					$('body').removeClass('ajax-sorting');

					Site.images.loadBackgrounds();
				}
			});
		},

		/*
		 * AJAX call to load more products
		 */
		initLoadMore: function() {
			$('body').on('click', '.js-loadMore:not(.loading)', function(event) {

				// hide open quickViews
				QuickView.hide();

				var $el = $(event.target);
				var url = $el.attr('href');

				event.preventDefault();

				$el.addClass('loading');

				// load products
				this.ajaxLoadMore(url);

			}.bind(this));
		},

		ajaxLoadMore: function(url) {
			$.ajax({
				type: 'GET',
				dataType: "html",
				url: url,
				success: function(data) {
					var products = $(data).find('.js-collectionGrid').html(),
						nextPage = $(data).find('.js-loadMore').attr('href');

					$('.js-collectionGrid').find('.gridSpacer').remove();

					$(products).appendTo('.js-collectionGrid');

					if ( typeof(nextPage) !== 'undefined' ){
						$('.js-loadMore').attr('href', nextPage).removeClass('loading');
					} else {
						$('.js-loadMore').remove();
					}

					Ie8.init();

					Site.images.loadBackgrounds();
					collectionBlocks = $('.js-collectionBlock');
				}
			});
		}
	}


	/*
	 * quickView AJAX methods
	 *
	 * Key:
	 * * el = ELEMENT attached to, one or more .js-collectionBlock
	 * * handle = product HANDLE, delivered from the front-end  attached to .js-quickView
	 * * obj = product OBJECT, in JSON
	 */
	var QuickView = {

		// global settings
		collectionBlocks: $('.js-collectionBlock'),

		init: function(){

			// init global settings
			collectionBlocks = this.collectionBlocks;

			/*
			 * Bind .js-quickView
			 */
			$('body').on('click', '.js-quickView', function(e){
				e.preventDefault();

				var $this = $(this), // the .js-quickView button
					product_handle = $this.attr('data-handle'), // [data-handle=""] on the .js-quickView button
					$collectionBlock = $this.closest('.js-collectionBlock'); // the .collectionBlock that contains the product js-quickView

				// if loaded and visible
				if ($collectionBlock.hasClass('is-loaded') && $collectionBlock.hasClass('quickView--is-visible')) {
					QuickView.hide();
				}

				// if loaded but not visible, no other quickViews open
				else if ($collectionBlock.hasClass('is-loaded') && !$collectionBlock.hasClass('quickView--is-visible') && !$('.quickView--is-visible').length) {
					QuickView.show($collectionBlock);
				}

				// if loaded and not visible, other quickViews are open
				else if ($collectionBlock.hasClass('is-loaded') && !$collectionBlock.hasClass('quickView--is-visible') && $('.quickView--is-visible').length) {
					QuickView.hide();
					setTimeout(function(){
						QuickView.show($collectionBlock);
					}, 100);
				}

				// if not loaded yet, other quickViews open
				else if ($('.quickView--is-visible').length) {
					QuickView.hide();
					setTimeout(function(){
						QuickView.ajax($collectionBlock, product_handle);
					}, 100);
				}

				// if not loaded yet, no other quickViews open
				else {
					QuickView.hide();
					QuickView.ajax($collectionBlock, product_handle);
				}
			});
		},

		show: function(el){
			var $el = el,
				sub = ($(window).height() - 600)/2,
				offset = el.children('.quickView').offset().top,
				scroll = offset - sub;

			$el.addClass('quickView--is-active');

			$('html, body').animate({scrollTop: scroll}, function(){
				if ($el.hasClass('is-loaded')) {
					$el.addClass('quickView--is-visible');
				} else {
					$el.addClass('quickView--is-visible is-loaded');
				}
        $el.find('.single-option-selector').eq(0).change();
			});

			$('html, body').trigger('quickView:show');
		},

		hide: function(){
			if (collectionBlocks.hasClass('quickView--is-visible')) {
				collectionBlocks.removeClass('quickView--is-visible quickView--is-active');
				$('html, body').trigger('quickView:hide');
			}
		},

		ajax: function(el, handle){
			var $collectionBlock = el,
				product_handle = handle;

			$.getJSON(
				'/products/'+product_handle+'.js',

				function(product) {
					var id = product.id, // int
						title = product.title, // string
						url = product.url, // string
						options = product.options, // array
						variants = product.variants, // array
						images = product.images, // array of strings
						price = product.price,
						compare_at_price = product.compare_at_price,
						compare_at_price_formatted = Shopify.formatMoney(compare_at_price),
						price_formatted = Shopify.formatMoney(price); // string

					self.ajaxed = true; // set ajaxed variable to true, means that ajax has occurred

					/*
					 * Adding the variant dropdown. This contains ALL variants.
					 * option_selection.js then hooks in, hides this dropdown, and generates
					 * however many dropdowns there are (1, 2, or 3)
					 *
					 * Basic template for this at https://docs.shopify.com/support/your-website/themes/can-i-make-my-theme-use-products-with-multiple-options
					 */
					var variant_avail = false,
						first_avail_variant = '';

					var dropdowns = ''; // declare option dropdowns variable
					// loop over product.options
					for (i = 0; i < options.length; i++) {
						// dropdowns += '<div class="select-wrapper">';
						dropdowns += '<select class="js-product-select" id="product-'+[product['id']]+'-select" name="id">'; // I need a separate id bc each product has a quickView -> has a select
						// loop over product.variants
						for(i = 0; i < variants.length; i++){
							if (variants[i]['available'] == true && variant_avail == false){
								selected = 'selected';
								variant_avail = true;
								first_avail_variant = variants[i]['id'];
							} else {
								selected = '';
							}
							dropdowns += '<option value="'+variants[i]['id']+'"'+selected+'>'+variants[i]['title']+'</option>';
						}
						dropdowns += '</select>';
						// dropdowns += '</div>';
					}

			  	var pricing = '';
			  	if (compare_at_price > price) {
						pricing += '<h2 class="sale">';
								pricing += '<strike class="product-compare-price">'+compare_at_price_formatted+'</strike>&nbsp;';
								pricing += '<span class="product-sale-price">'+price_formatted+'</span>';
	          pricing += '</h2>';
					} else {
						pricing += '<h2 class="product-normal-price">'+price_formatted+'</h2>';
					}

				  	// append data to .js-collectionBlock
				  	$collectionBlock.append(
				  		'<div class="quickView">' +
				  			'<div class="quickView-wrap">' +
				  				'<div class="container">' +
				  					'<div class="row inline">' +
					  					'<div class="quickView-img block s12 xl_s12">' +
		            						'<div class="quickView-img-inner js-imageZoom" data-bg-src="' + images[0] + '"></div>' +
		          						'</div>' +
										'<div class="quickView-info block s12 xl_s12">' +
											'<div class="icon-close quickView-close js-quickView"></div>' +
											'<form class="productForm" action="/cart/add" method="post">' +
          							'<h1 class="bold"><a class="js-productUrl" href="' + url + '">' + title + '</a></h1>' +
          							'<div class="productForm-block">' +
        									dropdowns +
          							'</div>' +
          							'<div class="productForm-block">' +
													'<div class="js-counter counter inputGroup">' +
													  '<label>Quantity</label>' +
													  '<input type="text" class="inputCounter" name="quantity" value="1"/>' +
													  '<span class="inputCounter-up">+&nbsp;</span>' +
													  '<span class="inputCounter-down">&nbsp;–</span>' +
													'</div>' +
												'</div>' +
												'<div class="productForm-block">' +
													'<span class="product-price" data-price="'+price+'">' +
														pricing +
									        '</span>' +
                          '<button class="js-productForm-submit productForm-submit" type="submit" name="checkout" data-handle="'+product_handle+'">'+"Add To Cart"+'</button>' +
                          '<a class="product-link js-productUrl" href="' + url + '">'+"See Details"+' <i class="icon-arrow-right"></i></a>' +
												'</div>' +
            					'</form>' +
            				'</div>' +
          				'</div>' +
            		'</div>' +
            	'</div>' +
            '</div>'
					); // end append

					// hook into option_selection.js remotely
					QuickView.selectOptions($collectionBlock, product);

					Site.images.loadBackgrounds();

				} // end function(product){}
			); // end $.getJSON
		},

		/*
		 * Hook into Shopify's option_select.js remotely
		 * @param el = closest .js-collectionBlock
		 */
		selectOptions: function(el, obj){

			var select = 'product-'+obj['id']+'-select',
				current_product = 'product_'+obj['id'];

			//Initialize the product array
			var product_obj = [];

			$('.product-json').each(function() {
				var data = JSON.parse($(this).html());
				var id = data.id;
				var key = 'product_'+id;
				product_obj[key] = data;
			});

			/*
			 * OptionsSelectors instantiates the chain of functions within option_selection.js that builds the options selectors.
			 * Docs here: https://docs.shopify.com/support/your-website/themes/can-i-make-my-theme-use-products-with-multiple-options
			 */
			new Shopify.OptionSelectors(select, {
				product: product_obj[current_product], // this is the null from the front-end
				onVariantSelected: selectCallback
			});

			function selectCallback(variant, selector) {
				callback({
					money_format: "",
					variant: variant,
					selector: selector
				});
			}

			function callback(options){
				var moneyFormat = options.money_format,
					variant = options.variant,
					selector = options.selector;

				var $submit = el.find('.js-productForm-submit'),
					$price = el.find('.product-price'),
					$normal_price = el.find('.product-normal-price'),
					$sale_price = el.find('.product-sale-price'),
					$compare_price = el.find('.product-compare-price'),
					$counter = el.find('.js-counter').not('.cart-product-quantity .js-counter'),
					$sale_container = $price.find('h2.sale');

				if (variant) {

					if (variant.available) {
						$submit.removeClass('is-disabled').prop('disabled', false).css({'opacity': 1}).html("Add To Cart");
						$counter.css({'opacity': 1, 'pointer-events': 'auto'});
						$price.css({'opacity': 1});

						$price.attr('data-price', variant.price);
						$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));

						if (variant.compare_at_price != null){
							if (variant.compare_at_price > variant.price) {
								if ($sale_container.length){
									$compare_price.html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
									$sale_price.html(Shopify.formatMoney(variant.price, moneyFormat));
								} else {
									$price.append('<h2 class="sale" itemprop="price"><strike class="product-compare-price"></strike>&nbsp;<span class="product-sale-price"></span></h2>');
									$('.product-compare-price').html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
									$('.product-sale-price').html(Shopify.formatMoney(variant.price, moneyFormat));
								}
								$normal_price.hide();
								$sale_container.show();
							} else if (variant.compare_at_price <= variant.price) {
								if($normal_price.length) {
									$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));
								} else {
									$price.append('<h2 class="product-normal-price" itemprop="price">'+Shopify.formatMoney(variant.price, moneyFormat)+'</h2>');
								}
								$sale_container.hide();
								$normal_price.show();
							}
						} else {
							$sale_container.hide();
							$normal_price.show();
						}
					}
					// this variant sold out
					else {
						$submit.addClass('is-disabled').prop('disabled', true).css({'opacity': 0.3}).html("SOLD OUT");
						$counter.css({'opacity': 0.3, 'pointer-events': 'none'});
						$price.css({'opacity': 0.3});

						$price.attr('data-price', variant.price);
						$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));

						if (variant.compare_at_price != null){
							if (variant.compare_at_price > variant.price) {
								if ($sale_container.length){
									$compare_price.html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
									$sale_price.html(Shopify.formatMoney(variant.price, moneyFormat));
								} else {
									$price.append('<h2 class="sale" itemprop="price"><strike class="product-compare-price"></strike>&nbsp;<span class="product-sale-price"></span></h2>');
									$('.product-compare-price').html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
									$('.product-sale-price').html(Shopify.formatMoney(variant.price, moneyFormat));
								}
								$normal_price.hide();
								$sale_container.show();
							} else if (variant.compare_at_price <= variant.price) {
								if($normal_price.length) {
									$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));
								} else {
									$price.append('<h2 class="product-normal-price" itemprop="price">'+Shopify.formatMoney(variant.price, moneyFormat)+'</h2>');
								}
								$sale_container.hide();
								$normal_price.show();
							}
						} else {
							$sale_container.hide();
							$normal_price.show();
						}
					}

					// this will swap images in the quickView
					Product.showVariantImage(variant);
				} else {
					$submit.addClass('is-disabled').prop('disabled', true).css({'opacity': 0.3}).html("UNAVAILABLE");
					$counter.css({'opacity': .3, 'pointer-events': 'none'});
					$price.css({'opacity': 0.3});
				}
			}

			/*
			 * option_selection.js doesn't add a label if there's only one option,
			 * so this logic:
			 * * adds a label (and arrow) if there's only one option and multiple variants
			 * * prepends the arrow if there are more than one option (this is a normal successful call to option_selection.js)
			 * * hides the select element and wrapper if there is only one variant
			 */
			if (obj['options'].length === 1 && obj['variants'].length > 1){
				for (i = 0; i < obj['options'].length; i++) {
					$('#'+select+'-option-'+[i]).closest('.selector-wrapper').prepend('<span class="selectArrow"></span><label>'+obj['options'][0]['name']+'</label>');
				}
			} else if (obj['options'].length > 1){
				for (i = 0; i < obj['options'].length; i++) {
					$('#'+select+'-option-'+[i]).closest('.selector-wrapper').prepend('<span class="selectArrow"></span>');
				}
			} else if (obj['options'].length === 1 && obj['variants'].length === 1){
				$('#'+select+'-option-0').closest('.productForm-block').hide(); // hide wrapper
			}

			QuickView.show(el)
		} // end selectOptions
	} // end QuickView

	Site.init();
	Cart.init();
	Collection.init();
	QuickView.init();
	Product.init();
	Insta.init();
	Sections.init();
});
// end .ready()

var Product = {
	init: function( update ){
		var isZoomEnable = ($('.js-product-template').attr('data-zoom') == 'true') ? true: false;
		var update = (typeof update !== 'undefined') ?  update : false;

		Ie8.init();

		if( !update ) this.counter();

		if ($('.template-product').length){
			this.shopBar();
  		this.productImages();
		}
		var label = $('.selector-wrapper').find('label');
		var labelHeight = $(label).outerHeight();
		var boxHeight = $('.single-option-selector').outerHeight();
		var arrowHeight = $('.selectArrow').outerHeight();
		var offset = labelHeight + boxHeight - arrowHeight;
	},

	/*
	 * Sticky "Shop" Bar in product.liquid
	 * Hidden via CSS under 768px viewport size
	 */
	shopBar: function(){
		var $bar = $('.js-shopBar'),
			$w = $(window);
			scroll = 0,
			$info = $('.js-product-info'),
			offset = ( $info.offset().top - $w.height() );

		if ($w.scrollTop() < offset) {
			setTimeout(function(){
				$bar.addClass('is-visible');
			}, 1500);
		}

		$w.scroll(function(){
			scroll = $w.scrollTop();

			if (scroll > offset) {
				$bar.removeClass('is-visible');
			} else {
				$bar.addClass('is-visible');
			}
		});

		$('.js-shopBar-buy').on('click', function(e){
			e.preventDefault();

			var $info = $('.js-product-info'),
				sub = ( $w.height() - $info.innerHeight() )/2,
				offset = $info.innerHeight() < ($w.height() - 100) ? ($info.offset().top - sub) : ($info.offset().top - 100); // 100 is the height of the fixed header

			$('html, body').animate({scrollTop: offset}, 600);
		});

		$('.js-to-top').on('click', function(e){
			e.preventDefault();

			$('html, body').animate({scrollTop: 0}, 600);
		});
	},

	productImages: function(){
		Reqs.imageSizing();

		var $imagefills = $('.js-imagefill');

		$imagefills.each(function(){
			$(this).imagefill();
		});

		var showImages = setInterval(function(){
			if ($imagefills.find('.product-image-img').attr('style') != ''){
				$imagefills.find('.product-image-img').css('opacity', 1);
				removeTimer();
			}
		}, 100);

		function removeTimer(){
			clearInterval(showImages);
		}
	},

	/*
	 * Form Counter
	 */
	counter: function(){
		var $body = $('body'),
			$counter = $('.inputCounter'),
			$price = $('.product-price');

		// Product/Quick View Product Submit Form
		function inputCounter(el, value) {
		    var $counter = el.siblings('.inputCounter'),
		    	count = $counter.prop('value'),
		   		new_count = parseInt(count,10) + value;

		    if (new_count < 0) {
		        new_count = 0;
		    }

		    $counter.prop('value', new_count);
		    // $counter.attr('value', new_count);
		}

		$counter.on('blur', function(){
	    	var change = $(this).prop('value'),
    			new_count = parseInt(change,10);

	    	$(this).attr('value', new_count);
    	});

		$body.on('click', '.inputCounter-down', function(){
			var el = $(this);
			inputCounter(el, -1);
		}).on('click', '.inputCounter-up', function(){
			var el = $(this);
			inputCounter(el, 1);
		});
	},

	// this is what is being called from the product.liquid
	selectCallback: function(variant, selector) {
		Product.callback({
			money_format: "",
			variant: variant,
			selector: selector
		});
	},

	callback: function(options){
		var moneyFormat = options.money_format,
			variant = options.variant,
			selector = options.selector;

		var $submit = $('.js-productForm-submit'),
			$shopbar_submit = $('.js-shopBar-buy'),
			$price = $('.product-price'),
			$normal_price = $('.product-normal-price'),
			$sale_price = $('.product-sale-price'),
			$compare_price = $('.product-compare-price'),
			$counter = $('.js-counter').not('.cart-product-quantity .js-counter'),
			$sale_container = $price.find('h2.sale');

		if (variant) {

			if (variant.available) {
				$submit.removeClass('is-disabled').prop('disabled', false).css({'opacity': 1}).html("Add To Cart");
				$shopbar_submit.removeClass('is-disabled').html("Buy Now");
				$counter.css({'opacity': 1, 'pointer-events': 'auto'});
				$price.css({'opacity': 1});

				$price.attr('data-price', variant.price);
				$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));

				if (variant.compare_at_price != null){
					if (variant.compare_at_price > variant.price) {
						if ($sale_container.length){
							$compare_price.html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
							$sale_price.html(Shopify.formatMoney(variant.price, moneyFormat));
						} else {
							$price.append('<h2 class="sale" itemprop="price"><strike class="product-compare-price"></strike>&nbsp;<span class="product-sale-price"></span></h2>');
							$('.product-compare-price').html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
							$('.product-sale-price').html(Shopify.formatMoney(variant.price, moneyFormat));
						}
						$normal_price.hide();
						$sale_container.show();
					} else if (variant.compare_at_price <= variant.price) {
						if($normal_price.length) {
							$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));
						} else {
							$price.append('<h2 class="product-normal-price" itemprop="price">'+Shopify.formatMoney(variant.price, moneyFormat)+'</h2>');
						}
						$sale_container.hide();
						$normal_price.show();
					}
				} else {
					$sale_container.hide();
					$normal_price.show();
				}
			}
			// this variant sold out
			else {
				$submit.addClass('is-disabled').prop('disabled', true).css({'opacity': 0.3}).html("SOLD OUT");
				$shopbar_submit.addClass('is-disabled').html("SOLD OUT");
				$counter.css({'opacity': 0.3, 'pointer-events': 'none'});
				$price.css({'opacity': 0.3});

				$price.attr('data-price', variant.price);
				$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));

				if (variant.compare_at_price != null){
					if (variant.compare_at_price > variant.price) {
						if ($sale_container.length){
							$compare_price.html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
							$sale_price.html(Shopify.formatMoney(variant.price, moneyFormat));
						} else {
							$price.append('<h2 class="sale" itemprop="price"><strike class="product-compare-price"></strike>&nbsp;<span class="product-sale-price"></span></h2>');
							$('.product-compare-price').html(Shopify.formatMoney(variant.compare_at_price, moneyFormat));
							$('.product-sale-price').html(Shopify.formatMoney(variant.price, moneyFormat));
						}
						$normal_price.hide();
						$sale_container.show();
					} else if (variant.compare_at_price <= variant.price) {
						if($normal_price.length) {
							$normal_price.html(Shopify.formatMoney(variant.price, moneyFormat));
						} else {
							$price.append('<h2 class="product-normal-price" itemprop="price">'+Shopify.formatMoney(variant.price, moneyFormat)+'</h2>');
						}
						$sale_container.hide();
						$normal_price.show();
					}
				} else {
					$sale_container.hide();
					$normal_price.show();
				}
			}

			Product.showVariantImage(variant);
			// Product.variantPopover.getImage(variant);
			Product.variantPreview.getImage(variant);

		} else {
			$submit.addClass('is-disabled').prop('disabled', true).css({'opacity': 0.3}).html("UNAVAILABLE");
			$counter.css({'opacity': .3, 'pointer-events': 'none'});
			$price.css({'opacity': 0.3});
		}
	},

	// show variant image within quickView or within slideshow (mobile product page)
	showVariantImage: function(variant) {
		var $quickView = $('.quickView--is-active .quickView'),
			variantImage = variant.featured_image ? variant.featured_image.src : false,
			variantID = variant.id;

		if(variantImage) {
			// Remove protocol to match original src markup
			variantImage = variantImage.substring(variantImage.indexOf('//'));
		}

		if($quickView.length) {
			// Show variant image in quick view
			var $imageContainer = $quickView.find('.quickView-img'),
				$variantImages = $imageContainer.children(),
				$URLs = $quickView.find('.js-productUrl');

			$currentVariantImage = variantImage ? $variantImages.filter('[data-bg-src="'+variantImage+'"]') : $();

			if(!$currentVariantImage.length) {

				if(variantImage) {
					$currentVariantImage = $variantImages.first().clone();

					$currentVariantImage
						.attr('data-bg-src', variantImage)
						.removeAttr('style')
						.removeClass('bg-loading bg-loaded quickView-variant-img--is-active')
						.appendTo($imageContainer);

				} else {
					$currentVariantImage = $variantImages.first();
				}

			}

			Site.images.loadBackgrounds();

			setTimeout(function() {
				$currentVariantImage
					.addClass('quickView-variant-img--is-active')
					.siblings().removeClass('quickView-variant-img--is-active');

				// swap URLs to support variant deep-linking
				$URLs.each(function(){
					// if the URL doesn't have a query string, just use the base URL
					// otherwise, remove the query string and add a new one with the new variantID
					var current_url = $(this).attr('href').indexOf('?variant') != -1 ? $(this).attr('href').substring(0, $(this).attr('href').indexOf('?')) : $(this).attr('href');
					$(this).attr('href', current_url + '?variant=' + variantID);
				});
			});

		} else {

			// Show variant image preview in product page

			var $imgSlider = $('.productImgSlider').first();
			var flick = $imgSlider.data('flickity');

			// Activate image slide in mobile view
			if(flick && flick.isActive) {

				var $variantSlide = $imgSlider.find('[data-image="'+variantImage+'"]');

				flick.select($variantSlide.index());
				$('.product-image').removeClass('is-selected-product');
				$variantSlide.addClass('is-selected-product');
			}
		}
	},

	variantPreview: {
		triggeredByUser: false,
		selected_img: $(''),
		selected_img_url: '',
		bind: function(){
			$('.js-variant-preview').on('click', function(){
				Product.variantPreview.scrollTarget(selected_img);
			});
		},
		getImage: function(variant){
			// if there are NO variant images, use the first image on the page
			// if there are NO images at all, return an empty string
			var newImage = variant.featured_image ? variant.featured_image.src :
					$('.product-image').first() ? $('.product-image').first().attr('data-image') : '',
				$container = $('.js-variant-preview'),
				currentImage = $container.attr('data-bg-src'),
				$productImages = $('.product-image');

			if (newImage){
				// need to set this var if we want to add a SELECTED
				// tag to an image on load, which only happens if
				// the url has a ?variant string in it
				selected_img_url = newImage.substring(newImage.indexOf('//'));
			}

			// first page load
			if(!this.triggeredByUser) {
				// IF the URL has a variant already selected
				// get new image url and match it to the corresponding product-image
				if (window.location.href.indexOf('?variant') > -1){
					$productImages.each(function(){
						var image_url = $(this).attr('data-image');
						$(this).removeClass('is-selected-product');
						if (image_url == selected_img_url) {
							$(this).addClass('is-selected-product');
							return selected_img = $(this);
						}
					});
				}

				// either way, init the click event, and set the triggeredByUser
				// var to true so the preview can show, now that initial load
				// is out of the way
				this.bind();
				this.triggeredByUser = true;
				return;
			}

			// replace window.location
			var location = window.location.href,
					current_url = location.indexOf('?variant') > -1 ? location.substring(0, location.indexOf('?')) : location,
					ID = variant.id;

			window.history.replaceState({}, '', current_url + '?variant=' + ID);

			// If we have a new image to display
			if (newImage && (selected_img_url !== currentImage)) {
				if (!$container.hasClass('is-visible')){
					$container.addClass('is-visible');
				}

				// get new image url and match it to the corresponding product-image
				$productImages.each(function(){
					var image_url = $(this).attr('data-image');
					$(this).removeClass('is-selected-product');
					if (image_url == selected_img_url) {
						$(this).addClass('is-selected-product');
						return selected_img = $(this);
					}
				});

				// if image is already in view, we don't really need the preview
				// if (selected_img.offset().top > $(window).scrollTop() && $(window).width() > 768) {
				// 	$container
				// 	.attr('data-bg-src', selected_img_url)
				// 	.removeAttr('style')
				// 	.removeClass('is-visible bg-loading bg-placeholder bg-loaded');
				// 	return;
				// }

				// swap images in the preview
				$container
				.attr('data-bg-src', selected_img_url)
				.removeAttr('style')
				.removeClass('bg-loading bg-placeholder bg-loaded');

				Site.images.loadBackgrounds();

				if ($('html').hasClass('ie8')) {
					Ie8.variantPreview($container, selected_img_url); // fallback for IE8
				}
			}
		},

		// fades all product images except the image passed as the @param
		fade: function(selected_img){
			$('.product-image').not(selected_img).addClass('fadeOut');
			this.fadeTimer = setTimeout(function(){
				$('.product-image').removeClass('fadeOut');
			}, 2000);
		},

		// @param variant = the url of the image
		scrollTarget: function(selected_img){
			var targetOffset = selected_img.offset().top,
				scrollTarget = targetOffset - (($(window).height() - selected_img.outerHeight()) / 2);

			$('html, body').animate({scrollTop: scrollTarget}, 500, function(){
				Product.variantPreview.fade(selected_img);
			});
		}
	},

	variantPopover: {
		triggeredByUser: false,
		popoverTimer: 0,
		fadeTimer: 0,
		selected_img: $(''),
		selected_img_url: '',
		init: function(){
			$('#VariantPopoverContainer').on('click', function(){
				Product.variantPopover.scrollTarget(selected_img);
			});
		},
		getImage: function(variant){
			if(!this.triggeredByUser) {
				this.triggeredByUser = true;
				return;
			}

			var newImage = variant.featured_image ? variant.featured_image.src : false,
				$container = $('#VariantPopoverContainer .popover'),
				currentImage = $container.find('.popover-item-thumb').attr('data-bg-src'),
				$productImages = $('.product-image'),

				// handlebars vars
				data = {},
				source = $('#VariantPopover').html(),
				template = Handlebars.compile(source);

			clearTimeout(this.popoverTimer); // clear popover timer

			// if the variant has a NEW image, that isn't the same as the currently shown variant image
			// initiate popover
			if (newImage && (newImage !== currentImage)) {

				// Create new locally available vars for the selected image and it's src URL
				// Also, add classes to show which product-image is selected
				if (this.triggeredByUser){
					selected_img_url = newImage.substring(newImage.indexOf('//'));
					$productImages.each(function(){
						var image_url = $(this).attr('data-image');
						$(this).removeClass('is-selected-product');
						if (image_url == selected_img_url) {
							$(this).addClass('is-selected-product');
							return selected_img = $(this);
						}
					});
				}

				// if image is fully visible, don't show the popover, just fade out the other products
				// However, *do* swap the image in the popover, since the logic to hide/show it depends
				// on the image being different than what is selected.
				if (selected_img.offset().top > $(window).scrollTop() && $(window).width() > 768) {
					// clearTimeout(this.fadeTimer);
					// Product.variantPopover.fade(selected_img);
					$container.removeClass('is-visible'); // hide popover
					$container.empty(); // if there's a new image, clear the container for the new one
					data = {
						img: newImage, // create data for Handlebars
					};
					$container.append(template(data)); // append the new image via Handlebars
					return;
				}

				$productImages.removeClass('fadeOut');

				$container.empty(); // if there's a new image, clear the container for the new one

				data = {
					img: newImage, // create data for Handlebars
				};

				$container.append(template(data)); // append the new image via Handlebars

				// after template is loaded
				if ($('html').hasClass('ie8')) {
					Ie8.variantPopover($container); // fallback for IE8
				}

				$container.addClass('is-visible'); // show popover

				this.popoverTimer = setTimeout(function(){
					$container.removeClass('is-visible'); // hide popover
				}, 3000);
			}
		},

		// fades all product images except the image passed as the @param
		fade: function(selected_img){
			$('.product-image').not(selected_img).addClass('fadeOut');
			this.fadeTimer = setTimeout(function(){
				$('.product-image').removeClass('fadeOut');
			}, 2000);
		},

		// @param variant = the url of the image
		scrollTarget: function(selected_img){
			var targetOffset = selected_img.offset().top,
				scrollTarget = targetOffset - (($(window).height() - selected_img.outerHeight()) / 2);

			$('html, body').animate({scrollTop: scrollTarget}, 500, function(){
				// Product.variantPopover.fade(selected_img);
			});
		}
	},

	imageZoom: {
				init: function(){
			Reqs.pannZoom();
			
			$('.product-image-img').on('click', function(){
				var image_url = $(this).closest('.product-image').attr('data-bg-src') || $(this).closest('.product-image').attr('data-image');
				imageZoom.image(image_url);
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
				imageZoom.hide(modal);
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
}

/*
 * IE8 Comapability
 */
var Ie8 = {
	init: function () {
		// Turn off in other browsers
		if (!$("html").hasClass('ie8')) {
			return false;
		}

		var self = this;

		self.$rowInline = $('.row.inline'),
		self.$meds12 =  self.$rowInline.children('.med_s12'),
		self.$sms12 = self.$meds12.children('.sm_s12'),
		self.$xls13 = self.$rowInline.children('.xl_s13'),
		self.$xls14 = self.$rowInline.children('.xl_s14'),
		self.$bttCheckout = $('button.cart-checkout'),
		self.$lgs15 = self.$rowInline.children('.lg_s15'),
		self.$mosaiclock = $('.mosaic-block'),
		self.$galleryContent = $('.gallery-content-inner'),
		self.$mosaicContent = $('.mosaic-block.feature .content'),
		self.$closeBttAlert = $('.js-alert-close'),
		self.$alertBox = $('.siteAlert'),
		self.$iconDivider = $('.site-footer .footer-inner .icon-divider'),
		self.$header = $('header'),
		self.$featuredBlock = $('.has-featured-products'),
		self.$aboutImages = $('.two-up-image'),
		self.$productImgs = $('.product-layout-1 .product-image'),
		self.$collectionBlocks = $('.collectionGrid-slider .collectionBlock');

		self.setDomPosition();
		self.centerVertical();
		self.bindings();
		self.supportPlaceholder();
	},

	// To replace function cal()
	setDomPosition: function () {
		var self = this;

		self.$meds12.width(self.$meds12.parent().width()/2 - 10);
		self.$sms12.width(self.$sms12.parent().width()/2 - 10);
		self.$xls13.width(self.$xls13.parent().width()/3 - 12);
		self.$xls14.width(self.$xls14.parent().width()/4 - 15);
		self.$bttCheckout.width(self.$bttCheckout.parent().width()/3 - 12);
		self.$lgs15.width(self.$lgs15.parent().width()/5 - 15);
		self.$mosaiclock.css("padding-top", self.$mosaiclock.parent().width()/2 - 10);
		self.$iconDivider.css("left", self.$iconDivider.parent().width()/2 -28 + "px");

		self.$featuredProducts = self.$featuredBlock.children('.collectionBlock');
		$.each(self.$featuredProducts, function(id, el){
			if (id > 1) return;
			$(el).width($(el).parent().width()/2 - 10);
			self.backgroundCover($(el).children(".collectionBlock-image"));
		});
		$.each(self.$collectionBlocks, function(id, el){
			self.backgroundCover($(el).children(".collectionBlock-image"));
		});
		$.each(self.$aboutImages, function (id, el) {
			self.backgroundCover($(el));
		});
		$.each(self.$productImgs, function (id, el) {
			self.backgroundCover($(el));
			if (id > 0) {
				$(el).width($(el).parent().width()/2 - 20);
				$(el).css("padding-top", "33%");
			}
			if(id % 2 == 1) {
				$(el).css("margin-right", "40px");
			}
		})
	},

	// Align center vertically
	centerVertical: function () {
		var self = this;

		var _items = [self.$galleryContent, self.$mosaicContent];
		$.each(_items, function(idx, $dom){
			$dom.css({
				'position' : 'absolute',
				'top' : '50%',
				'margin-top' : -$dom.height()/2
			});
		});
	},

	// Binding events to buttons
	bindings: function () {
		var self = this;
		// close alert
		self.$closeBttAlert.on('click', function(){
			self.$alertBox.hide();
			self.$header.removeClass('alert--is-visible');
		});
	},

	// Support Placeholder
	supportPlaceholder: function () {
		$('[placeholder]').focus(function() {
			var input = $(this);
			if (input.val() == input.attr('placeholder')) {
				input.val('');
				input.removeClass('placeholder');
			}
		}).blur(function() {
			var input = $(this);
			if (input.val() == '' || input.val() == input.attr('placeholder')) {
				input.addClass('placeholder');
				input.val(input.attr('placeholder'));
			}
		}).blur();

		// Prevent posting the placeholder values to the form action script
		$('[placeholder]').parents('form').submit(function() {
			$(this).find('[placeholder]').each(function() {
				var input = $(this);
				if (input.val() == input.attr('placeholder')) {
					input.val('');
				}
			})
		});
	},

	// Support Background cover
	backgroundCover: function (el) {
		var _bg = (el.css('background-image'));
		_bg = _bg.replace('url(','').replace(')','');
		if (_bg==="none") return;
		el.attr('style', "filter: progid:DXImageTransform.Microsoft.AlphaImageLoader(src=" + _bg + ",sizingMethod='scale');");
	},

	variantPreview: function(container, img_url){
		container.removeAttr('style').addClass('is-visible');
		container.find('img').attr('src', img_url).css('opacity',1);
	},

	variantPopover: function(container){
		var $thumb = container.find('.popover-item-thumb'),
				// this <img> is wrapped in IE8 conditional tags
				// so this will be undefined in any other browser
				$fallbackImage = $thumb.children('img');

		$fallbackImage.load(function(){
			var thumbHeight = $thumb.height(),
				thumbWidth = $thumb.width(),
				imageHeight = $fallbackImage.height(),
				imageWidth = $fallbackImage.width();

			if (imageWidth > imageHeight) {
				$fallbackImage.height(thumbHeight);
				$fallbackImage.css('margin-left', -($fallbackImage.width() - thumbWidth) / 2)
			} else {
				$fallbackImage.width(thumbWidth);
				$fallbackImage.css('margin-top', -($fallbackImage.height() - thumbHeight) / 2)
			}
		});
	}
}

var Reqs = {
	/*
	 * Pan Zoom library
	 * Zoom 1.7.14 – License: MIT – http://www.jacklmoore.com/zoom
	 */
	panZoom: function(){
		(function($){var defaults={url:false,callback:false,target:false,duration:120,on:"mouseover",touch:true,onZoomIn:false,onZoomOut:false,magnify:1};$.zoom=function(target,source,img,magnify){var targetHeight,targetWidth,sourceHeight,sourceWidth,xRatio,yRatio,offset,$target=$(target),position=$target.css("position"),$source=$(source);$target.css("position",/(absolute|fixed)/.test(position)?position:"relative");$target.css("overflow","hidden");img.style.width=img.style.height="";$(img).addClass("zoomImg").css({position:"absolute",top:0,left:0,opacity:0,width:img.width*magnify,height:img.height*magnify,border:"none",maxWidth:"none",maxHeight:"none"}).appendTo(target);return{init:function(){targetWidth=$target.outerWidth();targetHeight=$target.outerHeight();if(source===$target[0]){sourceWidth=targetWidth;sourceHeight=targetHeight}else{sourceWidth=$source.outerWidth();sourceHeight=$source.outerHeight()}xRatio=(img.width-targetWidth)/sourceWidth;yRatio=(img.height-targetHeight)/sourceHeight;offset=$source.offset()},move:function(e){var left=e.pageX-offset.left,top=e.pageY-offset.top;top=Math.max(Math.min(top,sourceHeight),0);left=Math.max(Math.min(left,sourceWidth),0);img.style.left=left*-xRatio+"px";img.style.top=top*-yRatio+"px"}}};$.fn.zoom=function(options){return this.each(function(){var settings=$.extend({},defaults,options||{}),target=settings.target||this,source=this,$source=$(source),$target=$(target),img=document.createElement("img"),$img=$(img),mousemove="mousemove.zoom",clicked=false,touched=false,$urlElement;if(!settings.url){$urlElement=$source.find("img");if($urlElement[0]){settings.url=$urlElement.data("src")||$urlElement.attr("src")}if(!settings.url){return}}(function(){var position=$target.css("position");var overflow=$target.css("overflow");$source.one("zoom.destroy",function(){$source.off(".zoom");$target.css("position",position);$target.css("overflow",overflow);$img.remove()})})();img.onload=function(){var zoom=$.zoom(target,source,img,settings.magnify);function start(e){zoom.init();zoom.move(e);$img.stop().fadeTo($.support.opacity?settings.duration:0,1,$.isFunction(settings.onZoomIn)?settings.onZoomIn.call(img):false)}function stop(){$img.stop().fadeTo(settings.duration,0,$.isFunction(settings.onZoomOut)?settings.onZoomOut.call(img):false)}if(settings.on==="grab"){$source.on("mousedown.zoom",function(e){if(e.which===1){$(document).one("mouseup.zoom",function(){stop();$(document).off(mousemove,zoom.move)});start(e);$(document).on(mousemove,zoom.move);e.preventDefault()}})}else if(settings.on==="click"){$source.on("click.zoom",function(e){if(clicked){return}else{clicked=true;start(e);$(document).on(mousemove,zoom.move);$(document).one("click.zoom",function(){stop();clicked=false;$(document).off(mousemove,zoom.move)});return false}})}else if(settings.on==="toggle"){$source.on("click.zoom",function(e){if(clicked){stop()}else{start(e)}clicked=!clicked})}else if(settings.on==="mouseover"){zoom.init();$source.on("mouseenter.zoom",start).on("mouseleave.zoom",stop).on(mousemove,zoom.move)}if(settings.touch){$source.on("touchstart.zoom",function(e){e.preventDefault();if(touched){touched=false;stop()}else{touched=true;start(e.originalEvent.touches[0]||e.originalEvent.changedTouches[0])}}).on("touchmove.zoom",function(e){e.preventDefault();zoom.move(e.originalEvent.touches[0]||e.originalEvent.changedTouches[0])})}if($.isFunction(settings.callback)){settings.callback.call(img)}};img.src=settings.url})};$.fn.zoom.defaults=defaults})(window.jQuery);
	},
	pannZoom: function(){
		/**
		 * @license jquery.panzoom.js v2.0.5
		 * Updated: Thu Jul 03 2014
		 * Add pan and zoom functionality to any element
		 * Copyright (c) 2014 timmy willison
		 * Released under the MIT license
		 * https://github.com/timmywil/jquery.panzoom/blob/master/MIT-License.txt
		 */
		!function(a,b){"function"==typeof define&&define.amd?define(["jquery"],function(c){return b(a,c)}):"object"==typeof exports?b(a,require("jquery")):b(a,a.jQuery)}("undefined"!=typeof window?window:this,function(a,b){"use strict";function c(a,b){for(var c=a.length;--c;)if(+a[c]!==+b[c])return!1;return!0}function d(a){var c={range:!0,animate:!0};return"boolean"==typeof a?c.animate=a:b.extend(c,a),c}function e(a,c,d,e,f,g,h,i,j){this.elements="array"===b.type(a)?[+a[0],+a[2],+a[4],+a[1],+a[3],+a[5],0,0,1]:[a,c,d,e,f,g,h||0,i||0,j||1]}function f(a,b,c){this.elements=[a,b,c]}function g(a,c){if(!(this instanceof g))return new g(a,c);1!==a.nodeType&&b.error("Panzoom called on non-Element node"),b.contains(l,a)||b.error("Panzoom element must be attached to the document");var d=b.data(a,m);if(d)return d;this.options=c=b.extend({},g.defaults,c),this.elem=a;var e=this.$elem=b(a);this.$set=c.$set&&c.$set.length?c.$set:e,this.$doc=b(a.ownerDocument||l),this.$parent=e.parent(),this.isSVG=r.test(a.namespaceURI)&&"svg"!==a.nodeName.toLowerCase(),this.panning=!1,this._buildTransform(),this._transform=!this.isSVG&&b.cssProps.transform.replace(q,"-$1").toLowerCase(),this._buildTransition(),this.resetDimensions();var f=b(),h=this;b.each(["$zoomIn","$zoomOut","$zoomRange","$reset"],function(a,b){h[b]=c[b]||f}),this.enable(),b.data(a,m,this)}var h="over out down up move enter leave cancel".split(" "),i=b.extend({},b.event.mouseHooks),j={};if(a.PointerEvent)b.each(h,function(a,c){b.event.fixHooks[j[c]="pointer"+c]=i});else{var k=i.props;i.props=k.concat(["touches","changedTouches","targetTouches","altKey","ctrlKey","metaKey","shiftKey"]),i.filter=function(a,b){var c,d=k.length;if(!b.pageX&&b.touches&&(c=b.touches[0]))for(;d--;)a[k[d]]=c[k[d]];return a},b.each(h,function(a,c){if(2>a)j[c]="mouse"+c;else{var d="touch"+("down"===c?"start":"up"===c?"end":c);b.event.fixHooks[d]=i,j[c]=d+" mouse"+c}})}b.pointertouch=j;var l=a.document,m="__pz__",n=Array.prototype.slice,o=!!a.PointerEvent,p=function(){var a=l.createElement("input");return a.setAttribute("oninput","return"),"function"==typeof a.oninput}(),q=/([A-Z])/g,r=/^http:[\w\.\/]+svg$/,s=/^inline/,t="(\\-?[\\d\\.e]+)",u="\\,?\\s*",v=new RegExp("^matrix\\("+t+u+t+u+t+u+t+u+t+u+t+"\\)$");return e.prototype={x:function(a){var b=a instanceof f,c=this.elements,d=a.elements;return b&&3===d.length?new f(c[0]*d[0]+c[1]*d[1]+c[2]*d[2],c[3]*d[0]+c[4]*d[1]+c[5]*d[2],c[6]*d[0]+c[7]*d[1]+c[8]*d[2]):d.length===c.length?new e(c[0]*d[0]+c[1]*d[3]+c[2]*d[6],c[0]*d[1]+c[1]*d[4]+c[2]*d[7],c[0]*d[2]+c[1]*d[5]+c[2]*d[8],c[3]*d[0]+c[4]*d[3]+c[5]*d[6],c[3]*d[1]+c[4]*d[4]+c[5]*d[7],c[3]*d[2]+c[4]*d[5]+c[5]*d[8],c[6]*d[0]+c[7]*d[3]+c[8]*d[6],c[6]*d[1]+c[7]*d[4]+c[8]*d[7],c[6]*d[2]+c[7]*d[5]+c[8]*d[8]):!1},inverse:function(){var a=1/this.determinant(),b=this.elements;return new e(a*(b[8]*b[4]-b[7]*b[5]),a*-(b[8]*b[1]-b[7]*b[2]),a*(b[5]*b[1]-b[4]*b[2]),a*-(b[8]*b[3]-b[6]*b[5]),a*(b[8]*b[0]-b[6]*b[2]),a*-(b[5]*b[0]-b[3]*b[2]),a*(b[7]*b[3]-b[6]*b[4]),a*-(b[7]*b[0]-b[6]*b[1]),a*(b[4]*b[0]-b[3]*b[1]))},determinant:function(){var a=this.elements;return a[0]*(a[8]*a[4]-a[7]*a[5])-a[3]*(a[8]*a[1]-a[7]*a[2])+a[6]*(a[5]*a[1]-a[4]*a[2])}},f.prototype.e=e.prototype.e=function(a){return this.elements[a]},g.rmatrix=v,g.events=b.pointertouch,g.defaults={eventNamespace:".panzoom",transition:!0,cursor:"move",disablePan:!1,disableZoom:!1,increment:.3,minScale:.4,maxScale:5,rangeStep:.05,duration:200,easing:"ease-in-out",contain:!1},g.prototype={constructor:g,instance:function(){return this},enable:function(){this._initStyle(),this._bind(),this.disabled=!1},disable:function(){this.disabled=!0,this._resetStyle(),this._unbind()},isDisabled:function(){return this.disabled},destroy:function(){this.disable(),b.removeData(this.elem,m)},resetDimensions:function(){var a=this.$parent;this.container={width:a.innerWidth(),height:a.innerHeight()};var c,d=a.offset(),e=this.elem,f=this.$elem;this.isSVG?(c=e.getBoundingClientRect(),c={left:c.left-d.left,top:c.top-d.top,width:c.width,height:c.height,margin:{left:0,top:0}}):c={left:b.css(e,"left",!0)||0,top:b.css(e,"top",!0)||0,width:f.innerWidth(),height:f.innerHeight(),margin:{top:b.css(e,"marginTop",!0)||0,left:b.css(e,"marginLeft",!0)||0}},c.widthBorder=b.css(e,"borderLeftWidth",!0)+b.css(e,"borderRightWidth",!0)||0,c.heightBorder=b.css(e,"borderTopWidth",!0)+b.css(e,"borderBottomWidth",!0)||0,this.dimensions=c},reset:function(a){a=d(a);var b=this.setMatrix(this._origTransform,a);a.silent||this._trigger("reset",b)},resetZoom:function(a){a=d(a);var b=this.getMatrix(this._origTransform);a.dValue=b[3],this.zoom(b[0],a)},resetPan:function(a){var b=this.getMatrix(this._origTransform);this.pan(b[4],b[5],d(a))},setTransform:function(a){for(var c=this.isSVG?"attr":"style",d=this.$set,e=d.length;e--;)b[c](d[e],"transform",a)},getTransform:function(a){var c=this.$set,d=c[0];return a?this.setTransform(a):a=b[this.isSVG?"attr":"style"](d,"transform"),"none"===a||v.test(a)||this.setTransform(a=b.css(d,"transform")),a||"none"},getMatrix:function(a){var b=v.exec(a||this.getTransform());return b&&b.shift(),b||[1,0,0,1,0,0]},setMatrix:function(a,c){if(!this.disabled){c||(c={}),"string"==typeof a&&(a=this.getMatrix(a));var d,e,f,g,h,i,j,k,l,m,n=+a[0],o=this.$parent,p="undefined"!=typeof c.contain?c.contain:this.options.contain;return p&&(d=this._checkDims(),e=this.container,l=d.width+d.widthBorder,m=d.height+d.heightBorder,f=(l*Math.abs(n)-e.width)/2,g=(m*Math.abs(n)-e.height)/2,j=d.left+d.margin.left,k=d.top+d.margin.top,"invert"===p?(h=l>e.width?l-e.width:0,i=m>e.height?m-e.height:0,f+=(e.width-l)/2,g+=(e.height-m)/2,a[4]=Math.max(Math.min(a[4],f-j),-f-j-h),a[5]=Math.max(Math.min(a[5],g-k),-g-k-i+d.heightBorder)):(g+=d.heightBorder/2,h=e.width>l?e.width-l:0,i=e.height>m?e.height-m:0,"center"===o.css("textAlign")&&s.test(b.css(this.elem,"display"))?h=0:f=g=0,a[4]=Math.min(Math.max(a[4],f-j),-f-j+h),a[5]=Math.min(Math.max(a[5],g-k),-g-k+i))),"skip"!==c.animate&&this.transition(!c.animate),c.range&&this.$zoomRange.val(n),this.setTransform("matrix("+a.join(",")+")"),c.silent||this._trigger("change",a),a}},isPanning:function(){return this.panning},transition:function(a){if(this._transition)for(var c=a||!this.options.transition?"none":this._transition,d=this.$set,e=d.length;e--;)b.style(d[e],"transition")!==c&&b.style(d[e],"transition",c)},pan:function(a,b,c){if(!this.options.disablePan){c||(c={});var d=c.matrix;d||(d=this.getMatrix()),c.relative&&(a+=+d[4],b+=+d[5]),d[4]=a,d[5]=b,this.setMatrix(d,c),c.silent||this._trigger("pan",d[4],d[5])}},zoom:function(a,c){"object"==typeof a?(c=a,a=null):c||(c={});var d=b.extend({},this.options,c);if(!d.disableZoom){var g=!1,h=d.matrix||this.getMatrix();"number"!=typeof a&&(a=+h[0]+d.increment*(a?-1:1),g=!0),a>d.maxScale?a=d.maxScale:a<d.minScale&&(a=d.minScale);var i=d.focal;if(i&&!d.disablePan){var j=this._checkDims(),k=i.clientX,l=i.clientY;this.isSVG||(k-=(j.width+j.widthBorder)/2,l-=(j.height+j.heightBorder)/2);var m=new f(k,l,1),n=new e(h),o=this.parentOffset||this.$parent.offset(),p=new e(1,0,o.left-this.$doc.scrollLeft(),0,1,o.top-this.$doc.scrollTop()),q=n.inverse().x(p.inverse().x(m)),r=a/h[0];n=n.x(new e([r,0,0,r,0,0])),m=p.x(n.x(q)),h[4]=+h[4]+(k-m.e(0)),h[5]=+h[5]+(l-m.e(1))}h[0]=a,h[3]="number"==typeof d.dValue?d.dValue:a,this.setMatrix(h,{animate:"boolean"==typeof d.animate?d.animate:g,range:!d.noSetRange}),d.silent||this._trigger("zoom",h[0],d)}},option:function(a,c){var d;if(!a)return b.extend({},this.options);if("string"==typeof a){if(1===arguments.length)return void 0!==this.options[a]?this.options[a]:null;d={},d[a]=c}else d=a;this._setOptions(d)},_setOptions:function(a){b.each(a,b.proxy(function(a,c){switch(a){case"disablePan":this._resetStyle();case"$zoomIn":case"$zoomOut":case"$zoomRange":case"$reset":case"disableZoom":case"onStart":case"onChange":case"onZoom":case"onPan":case"onEnd":case"onReset":case"eventNamespace":this._unbind()}switch(this.options[a]=c,a){case"disablePan":this._initStyle();case"$zoomIn":case"$zoomOut":case"$zoomRange":case"$reset":this[a]=c;case"disableZoom":case"onStart":case"onChange":case"onZoom":case"onPan":case"onEnd":case"onReset":case"eventNamespace":this._bind();break;case"cursor":b.style(this.elem,"cursor",c);break;case"minScale":this.$zoomRange.attr("min",c);break;case"maxScale":this.$zoomRange.attr("max",c);break;case"rangeStep":this.$zoomRange.attr("step",c);break;case"startTransform":this._buildTransform();break;case"duration":case"easing":this._buildTransition();case"transition":this.transition();break;case"$set":c instanceof b&&c.length&&(this.$set=c,this._initStyle(),this._buildTransform())}},this))},_initStyle:function(){var a={"backface-visibility":"hidden","transform-origin":this.isSVG?"0 0":"50% 50%"};this.options.disablePan||(a.cursor=this.options.cursor),this.$set.css(a);var c=this.$parent;c.length&&!b.nodeName(c[0],"body")&&(a={overflow:"hidden"},"static"===c.css("position")&&(a.position="relative"),c.css(a))},_resetStyle:function(){this.$elem.css({cursor:"",transition:""}),this.$parent.css({overflow:"",position:""})},_bind:function(){var a=this,c=this.options,d=c.eventNamespace,e=o?"pointerdown"+d:"touchstart"+d+" mousedown"+d,f=o?"pointerup"+d:"touchend"+d+" click"+d,h={},i=this.$reset,j=this.$zoomRange;if(b.each(["Start","Change","Zoom","Pan","End","Reset"],function(){var a=c["on"+this];b.isFunction(a)&&(h["panzoom"+this.toLowerCase()+d]=a)}),c.disablePan&&c.disableZoom||(h[e]=function(b){var d;("touchstart"===b.type?!(d=b.touches)||(1!==d.length||c.disablePan)&&2!==d.length:c.disablePan||1!==b.which)||(b.preventDefault(),b.stopPropagation(),a._startMove(b,d))}),this.$elem.on(h),i.length&&i.on(f,function(b){b.preventDefault(),a.reset()}),j.length&&j.attr({step:c.rangeStep===g.defaults.rangeStep&&j.attr("step")||c.rangeStep,min:c.minScale,max:c.maxScale}).prop({value:this.getMatrix()[0]}),!c.disableZoom){var k=this.$zoomIn,l=this.$zoomOut;k.length&&l.length&&(k.on(f,function(b){b.preventDefault(),a.zoom()}),l.on(f,function(b){b.preventDefault(),a.zoom(!0)})),j.length&&(h={},h[(o?"pointerdown":"mousedown")+d]=function(){a.transition(!0)},h[(p?"input":"change")+d]=function(){a.zoom(+this.value,{noSetRange:!0})},j.on(h))}},_unbind:function(){this.$elem.add(this.$zoomIn).add(this.$zoomOut).add(this.$reset).off(this.options.eventNamespace)},_buildTransform:function(){return this._origTransform=this.getTransform(this.options.startTransform)},_buildTransition:function(){if(this._transform){var a=this.options;this._transition=this._transform+" "+a.duration+"ms "+a.easing}},_checkDims:function(){var a=this.dimensions;return a.width&&a.height||this.resetDimensions(),this.dimensions},_getDistance:function(a){var b=a[0],c=a[1];return Math.sqrt(Math.pow(Math.abs(c.clientX-b.clientX),2)+Math.pow(Math.abs(c.clientY-b.clientY),2))},_getMiddle:function(a){var b=a[0],c=a[1];return{clientX:(c.clientX-b.clientX)/2+b.clientX,clientY:(c.clientY-b.clientY)/2+b.clientY}},_trigger:function(a){"string"==typeof a&&(a="panzoom"+a),this.$elem.triggerHandler(a,[this].concat(n.call(arguments,1)))},_startMove:function(a,d){var e,f,g,h,i,j,k,m,n=this,p=this.options,q=p.eventNamespace,r=this.getMatrix(),s=r.slice(0),t=+s[4],u=+s[5],v={matrix:r,animate:"skip"};o?(f="pointermove",g="pointerup"):"touchstart"===a.type?(f="touchmove",g="touchend"):(f="mousemove",g="mouseup"),f+=q,g+=q,this.transition(!0),this.panning=!0,this._trigger("start",a,d),d&&2===d.length?(h=this._getDistance(d),i=+r[0],j=this._getMiddle(d),e=function(a){a.preventDefault();var b=n._getMiddle(d=a.touches),c=n._getDistance(d)-h;n.zoom(c*(p.increment/100)+i,{focal:b,matrix:r,animate:!1}),n.pan(+r[4]+b.clientX-j.clientX,+r[5]+b.clientY-j.clientY,v),j=b}):(k=a.pageX,m=a.pageY,e=function(a){a.preventDefault(),n.pan(t+a.pageX-k,u+a.pageY-m,v)}),b(l).off(q).on(f,e).on(g,function(a){a.preventDefault(),b(this).off(q),n.panning=!1,a.type="panzoomend",n._trigger(a,r,!c(r,s))})}},b.Panzoom=g,b.fn.panzoom=function(a){var c,d,e,f;return"string"==typeof a?(f=[],d=n.call(arguments,1),this.each(function(){c=b.data(this,m),c?"_"!==a.charAt(0)&&"function"==typeof(e=c[a])&&void 0!==(e=e.apply(c,d))&&f.push(e):f.push(void 0)}),f.length?1===f.length?f[0]:f:this):this.each(function(){new g(this,a)})},g});
	},
	imageSizing: function(){
		/**
		 * imagefill.js
		 * Author & copyright (c) 2013: John Polacek
		 * johnpolacek.com
		 * https://twitter.com/johnpolacek
		 *
		 * Dual MIT & GPL license
		 *
		 * Project Page: http://johnpolacek.github.io/imagefill.js
		 *
		 * The jQuery plugin for making images fill their containers (and be centered)
		 *
		 * EXAMPLE
		 * Given this html:
		 * <div class="container"><img src="myawesomeimage" /></div>
		 * $('.container').imagefill(); // image stretches to fill container
		 *
		 * REQUIRES:
		 * imagesLoaded - https://github.com/desandro/imagesloaded
		 *
		 */
		 ;(function($) {

		  $.fn.imagefill = function(options) {

		    var $container = this,
		        imageAspect = 1/1,
		        containersH = 0,
		        containersW = 0,
		        defaults = {
		          runOnce: false,
		          target: 'img',
		          throttle : 200  // 5fps
		        },
		        settings = $.extend({}, defaults, options);

		    var $img = $container.find(settings.target).addClass('loading').css({'position':'absolute'});

		    // make sure container isn't position:static
		    var containerPos = $container.css('position');
		    $container.css({'overflow':'hidden','position':(containerPos === 'static') ? 'relative' : containerPos});

		    // set containerH, containerW
		    $container.each(function() {
		      containersH += $(this).outerHeight();
		      containersW += $(this).outerWidth();
		    });

		    // wait for image to load, then fit it inside the container
		    $container.imagesLoaded().done(function(img) {
		      imageAspect = $img.width() / $img.height();
		      $img.removeClass('loading');
		      fitImages();
		      if (!settings.runOnce) {
		        checkSizeChange();
		      }
		    });

		    function fitImages() {
		      containersH  = 0;
		      containersW = 0;
		      $container.each(function() {
		        imageAspect = $(this).find(settings.target).width() / $(this).find(settings.target).height();
		        var containerW = $(this).outerWidth(),
		            containerH = $(this).outerHeight();
		        containersH += $(this).outerHeight();
		        containersW += $(this).outerWidth();

		        var containerAspect = containerW/containerH;
		        if (containerAspect < imageAspect) {
		          // taller
		          $(this).find(settings.target).css({
		              width: 'auto',
		              height: containerH,
		              top:0,
		              left:-(containerH*imageAspect-containerW)/2
		            });
		        } else {
		          // wider
		          $(this).find(settings.target).css({
		              width: containerW,
		              height: 'auto',
		              top:-(containerW/imageAspect-containerH)/2,
		              left:0
		            });
		        }
		      });
          $(window).trigger('fit-images');
		    }

		    function checkSizeChange() {
		      var checkW = 0,
		          checkH = 0;
		      $container.each(function() {
		        checkH += $(this).outerHeight();
		        checkW += $(this).outerWidth();
		      });
		      if (containersH !== checkH || containersW !== checkW) {
		        fitImages();
		      }
		      setTimeout(checkSizeChange, settings.throttle);
		    }

		    return this;
		  };

		}(jQuery));
	},
	throttle: function(fn, threshhold, scope) {
		threshhold || (threshhold = 250);

		var last,
		  	deferTimer;

		return function () {
			var context = scope || this;

			var now = +new Date,
			    args = arguments;

			if (last && now < last + threshhold) {
				// hold on to it
				clearTimeout(deferTimer);
				deferTimer = setTimeout(function () {
					last = now;
					fn.apply(context, args);
				}, threshhold);
			} else {
				last = now;
				fn.apply(context, args);
			}
		}
	}
}

var Insta = {
	init: function() {
		if( $('.js-instafeed').length ) {
			$('.js-instafeed').each(function() {
	            var instaFeed = $(this);
	            var error = $(this).find('.js-fallback');
	            var options = {};
	            var slides = '';
	            var valencia = window.valencia.default;
	            var token = $(this).attr( 'data-insta-token' );
	            var count = $(this).attr( 'data-insta-count' ) || 5;
	            var template = '<div class="instagram-img--wrapper"><a style="background-image:url(%%img%%);" class="instagram-img" target="_blank" href="%%link%%"></a></div></div>';

	            if( instaFeed.hasClass( 'insta-loaded' ) ) {

	            }else {
		            var feed = valencia( {
		                token: token,
		                count: count
		            }, function( data ) {
		            	console.log( data );

		                if( !data.images ) {
		                    return console.warn( 'Bad Instagram API request.' );
		                }

		                data.images.forEach( function( a ) {
		                    slides += template.replace( '%%link%%', a.link ).replace( '%%img%%', '\''+a.images.standard_resolution.url+'\'' );
		                } );
		                
		                instaFeed.html( slides );

		                var wrapperWidth = $('.instagram-img--wrapper').width();
		              	$('.instagram-img').css('height',wrapperWidth);

		                $(window).resize(function() {
			                var wrapperWidth = $('.instagram-img--wrapper').width();
			              	$('.instagram-img').css('height',wrapperWidth);
		                });

		                instaFeed.addClass( 'insta-loaded' );

		               // options = JSON.parse( instaFeed.data( 'slick' ).replace(/'/g, '"') );

		                //instaFeed.slick( options );
		            } );
	            }
			});
		}

	}
}

