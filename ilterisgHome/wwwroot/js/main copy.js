"use strict";
/*window.odometerOptions = {
  auto: true, // Don't automatically initialize everything with class 'odometer'
  selector: '.number.animated-element', // Change the selector used to automatically find things to be animated
  format: '(ddd).dd', // Change how digit groups are formatted, and how many digits are shown after the decimal point
  duration: 2000, // Change how long the javascript expects the CSS animation to take
  theme: 'default', // Specify the theme (if you have more than one theme css file on the page)
  animation: 'count' // Count is a simpler animation method which just increments the value,
                     // use it when you're looking for something more subtle.
};*/
jQuery.fn.serializeArrayAll = function(){
	var rCRLF = /\r?\n/g;
	return this.map( function() {

		// Can add propHook for "elements" to filter or add form elements
		var elements = jQuery.prop( this, "elements" );
		return elements ? jQuery.makeArray( elements ) : this;
	} )
	.map( function( i, elem ) {
		var val = jQuery( this ).val();

		return val == null ?
			null :
			jQuery.isArray( val ) ?
				jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} ) :
				{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
	} ).get();
}
var map = null;
var marker = null;
var menu_position = null;
var modificator = 0;
function gm_authFailure() 
{
	if($("#map").length)
		alert('Please define Google Maps API Key.\nReplace YOUR_API_KEY with the key generated on https://developers.google.com/maps/documentation/javascript/get-api-key\nin below line before the </body> closing tag <script type="text/javascript" src="//maps.google.com/maps/api/js?key=YOUR_API_KEY"></script>');
}
jQuery(document).ready(function($){
	$("body").imagesLoaded({background: true}, function(){
		$(".fp-site-preloader-overlay").css("display", "none");
	});
	var isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
	//odometer
	$('.number.animated-element').each(function(){
		var self = $(this)[0];
		var od = new Odometer({
			el: self,
			format: '(ddd).dd',
			duration: 2000,
			theme: 'default',
			animation: 'count'
		});
	});
	//preloader
	var preloader = function()
	{
		if(!$("body").hasClass("fp-site-preloader"))
		{
			$(".blog a.post-image>img, .post.single .post-image img, .services-list a>img, .projects-list:not('.isotope') a>img, .fp-preload>img").each(function(){
				$(this).before("<span class='fp-preloader'></span>");
				imagesLoaded($(this)).on("progress", function(instance, image){
					$(image.img).prev(".fp-preloader").remove();
					$(image.img).css("display", "block");
					$(image.img).parent().css("opacity", "0");
					$(image.img).parent().fadeTo("slow", 1, function(){
						$(this).css("opacity", "");
					});
				});
			});
		}
	};
	preloader();
	//slider
	$('.revolution-slider').each(function(){
		var height = 610;
		var heightResponsive1 = 550;
		var heightResponsive2 = 500;
		var heightResponsive3 = 450;
		var heightResponsive4 = 400;
		var autoplay = 1;
		var onHoverStop = 1;
		var bulletsNavigation = true;
		var bulletsOffset = 38;
		if(typeof($(this).data("height"))!="undefined")
		{
			height = parseInt($(this).data("height"), 10);
		}
		if(typeof($(this).data("heightresponsive1"))!="undefined")
		{
			heightResponsive1 = parseInt($(this).data("heightresponsive1"), 10);
		}
		if(typeof($(this).data("heightresponsive2"))!="undefined")
		{
			heightResponsive2 = parseInt($(this).data("heightresponsive2"), 10);
		}
		if(typeof($(this).data("heightresponsive3"))!="undefined")
		{
			heightResponsive3 = parseInt($(this).data("heightresponsive3"), 10);
		}
		if(typeof($(this).data("heightresponsive4"))!="undefined")
		{
			heightResponsive4 = parseInt($(this).data("heightresponsive4"), 10);
		}
		if(typeof($(this).data("autoplay"))!="undefined")
		{
			autoplay = parseInt($(this).data("autoplay"), 10);
		}
		if(typeof($(this).data("onhoverstop"))!="undefined")
		{
			onHoverStop = parseInt($(this).data("onhoverstop"), 10);
		}
		if(typeof($(this).data("bulletsnavigation"))!="undefined")
		{
			bulletsNavigation = parseInt($(this).data("bulletsnavigation"), 10);
		}
		if(typeof($(this).data("bulletsoffset"))!="undefined")
		{
			bulletsOffset = parseInt($(this).data("bulletsoffset"), 10);
		}
		$(this).show().revolution({
			dottedOverlay:"none",
			delay:6000,
			sliderLayout:"auto",
			responsiveLevels:[1920,1273,993,751,463],
			gridwidth:[1270,990,750,462,300],
			gridheight:[height,heightResponsive1,heightResponsive2,heightResponsive3,heightResponsive4],
			lazyType:"none",
			navigation: {
				keyboardNavigation:"on",
				onHoverStop: (onHoverStop==1 ? 'on' : 'off'),
				touch:{
					touchenabled:"on",
					swipe_treshold : 75,
					swipe_min_touches : 1,
					drag_block_vertical:false,
					swipe_direction:"horizontal"
				},
				arrows: {
					style:"preview1",
					enable:true,
					hide_onmobile:true,
					hide_onleave:true,
					hide_delay:200,
					hide_delay_mobile:1500,
					hide_under:767,
					hide_over:9999,
					tmp:'',
					left : {
						h_align:"left",
						v_align:"center",
						h_offset:50,
						v_offset:0,
					},
					right : {
						h_align:"right",
						v_align:"center",
						h_offset:50,
						v_offset:0
					}
				},
				bullets: {
					style:"preview1",
					enable:bulletsNavigation,
					hide_onmobile:true,
					hide_onleave:true,
					hide_delay:200,
					hide_delay_mobile:1500,
					hide_under:767,
					hide_over:9999,
					direction:"horizontal",
					h_align:"center",
					v_align:"bottom",
					space:16,
					h_offset:0,
					v_offset:bulletsOffset,
					tmp:''
				},
				parallax:{
				   type:"off",
				   bgparallax:"off",
				   disable_onmobile:"on"
				}
			},
			shadow:0,
			spinner:(!$("body").hasClass("fp-site-preloader") ? "spinner0" : "none"),
			stopLoop: (autoplay==1 ? "off" : "on"),
			stopAfterLoops: (autoplay==1 ? -1 : 0),
			stopAtSlide: (autoplay==1 ? -1 : 1),
			disableProgressBar: "on"
		});
	});
	//search form
	$(document).on("click", ".header-icons-container .template-big-search", function(event){
		event.preventDefault();
		$("body").addClass("search-overlay");
		$(".search-absolute-container").css("z-index", 2).animate({
			top: "0"
		}, 500, "easeInOutCubic", function(){
			$(".search-close").css("opacity", "1");
		});
	});
	$(document).on("click", ".search-overlay .search-absolute-container", function(event){
		if(event.target==this)
		{
			$("body").removeClass("search-overlay");
			$(".search-close").css("opacity", "0");
			$(".search-absolute-container").animate({
				top: "100%"
			}, 500, "easeInOutCubic", function(){
				$(".search-absolute-container").css("z-index", 0);
			});
		}
	});
	$(".search-close").on("click", function(event){
		event.preventDefault();
		$(".search-overlay .search-absolute-container").trigger("click");
	});
	//mobile menu
	$(".mobile-menu-switch").on("click", function(event){
		event.preventDefault();
		$(".header-container:not('#fp-sticky-clone') .mobile-menu-container").appendTo("body");
		$("body").addClass("overlay");
		$(".background-overlay").css("z-index", 2);
		if(!$(".mobile-menu-container nav .mobile-menu").is(":animated"))
		{
			$(".mobile-menu-container nav .mobile-menu").toggle("slide", {direction: "right"}, 500);
		}
	});
	$(document).on("click", ".mobile-menu .template-big-arrow-horizontal-sm, .overlay .background-overlay", function(event){
		event.preventDefault();
		$("body").removeClass("overlay");
		if(!$(".mobile-menu-container nav .mobile-menu").is(":animated"))
		{
			$(".mobile-menu-container nav .mobile-menu").toggle("slide", {direction: "right"}, 500, function(){
				$(".background-overlay").css("z-index", 0);
			});
		}
	});
	$(".collapsible-mobile-submenus .template-plus3").on("click", function(event){
		event.preventDefault();
		$(this).next().slideToggle(300);
		$(this).toggleClass("template-minus3");
	});
	
	//header toggle
	$(".header-toggle").on("click", function(event){
		event.preventDefault();
		$(this).prev().slideToggle({
			start: function(){
				$(this).css("display", "flex");
			}
		});
		$(this).toggleClass("active");
	});
	//cost calculator
	var regex = new RegExp("\\d(?=(\\d{3})+$)", "g");
	$(".cost-slider").each(function(){
		$(this).slider({
			range: "min",
			value: parseFloat($(this).data("value")),
			min: parseFloat($(this).data("min")),
			max: parseFloat($(this).data("max")),
			step: parseFloat($(this).data("step")),
			slide: function(event, ui){
				$("#" + $(this).data("input")).val(ui.value);
				$("." + $(this).data("input") + "-hidden").val(ui.value);
				$(this).find(".cost-slider-tooltip .value").html((typeof($(this).data("currencybefore"))!="undefined" ? $(this).data("currencybefore") : "")+ui.value.toFixed().replace(regex, '$&' + (typeof($(this).data("thousandthseparator"))!="undefined" ? $(this).data("thousandthseparator") : ''))+(typeof($(this).data("currencyafter"))!="undefined" ? $(this).data("currencyafter") : ""));
				$(this).find(".cost-slider-tooltip").css("left", "-" + Math.round(($(this).find(".cost-slider-tooltip .value").outerWidth()-21)/2) + "px");
				if(typeof($(this).data("price"))!="undefined")
					$("#" + $(this).data("value-input")).val(ui.value*$(this).data("price"));
				$(".cost-calculator-price").costCalculator("calculate");
			},
			change: function(event, ui){
				$("#" + $(this).data("input")).val(ui.value);
				$("." + $(this).data("input") + "-hidden").val(ui.value);
				$(this).find(".cost-slider-tooltip .value").html((typeof($(this).data("currencybefore"))!="undefined" ? $(this).data("currencybefore") : "")+ui.value.toFixed().replace(regex, '$&' + (typeof($(this).data("thousandthseparator"))!="undefined" ? $(this).data("thousandthseparator") : ''))+(typeof($(this).data("currencyafter"))!="undefined" ? $(this).data("currencyafter") : ""));
				$(this).find(".cost-slider-tooltip").css("left", "-" + Math.round(($(this).find(".cost-slider-tooltip .value").outerWidth()-21)/2) + "px");
				if(typeof($(this).data("price"))!="undefined")
					$("#" + $(this).data("value-input")).val(ui.value*$(this).data("price"));
				$(".cost-calculator-price").costCalculator("calculate");
			}
		}).find(".ui-slider-handle").append('<div class="cost-slider-tooltip"><div class="value">' + (typeof($(this).data("currencybefore"))!="undefined" ? $(this).data("currencybefore") : "")+$(this).data("value").toFixed().replace(regex, '$&' + (typeof($(this).data("thousandthseparator"))!="undefined" ? $(this).data("thousandthseparator") : ''))+(typeof($(this).data("currencyafter"))!="undefined" ? $(this).data("currencyafter") : "") + '</div></div>');
		var sliderTooltip = $(this).find(".cost-slider-tooltip");
		if(sliderTooltip.is(":visible"))
			sliderTooltip.css("left", "-" + Math.round((sliderTooltip.children(".value").outerWidth()-21)/2) + "px");
	});
	$(".cost-slider-input").on("paste change keyup", function(){
		var self = $(this);
		if(self.attr("type")=="checkbox")
		{	
			if(self.is(":checked"))
				self.val(self.data("value"));
			else
				self.val(0);
		}
		if($("[data-input='" + self.attr("id") + "']").length)
			setTimeout(function(){
				$("[data-input='" + self.attr("id") + "']").slider("value", self.val());
			}, 500);
		else
		{
			$(".cost-calculator-price").costCalculator("calculate");
		}
	});
	$(".cost-dropdown").each(function(){
		$(this).selectmenu({
			/*width: 370,*/
			icons: { button: "template-chev-down2" },
			change: function(event, ui){
				$(".cost-calculator-price").costCalculator("calculate");
				$("." + $(this).attr("id")).val(ui.item.label);
				$("." + $(this).attr("id") + "-hidden").val($(this).val());
			},
			select: function(event, ui){
				$(".cost-calculator-price").costCalculator("calculate");
				$("." + $(this).attr("id")).val(ui.item.label);
				$("." + $(this).attr("id") + "-hidden").val($(this).val());
			},
			create: function(event, ui){
				$(".contact-form").each(function(){
					$(this)[0].reset();
				});
				$("#" + $(this).attr("id") + "-menu").parent().addClass("cost-dropdown-menu").addClass("cost-dropdown-menu-" + $(this).closest("form").attr("id"));
				if($(this).closest("form").hasClass("style-simple"))
				{
					$("#" + $(this).attr("id") + "-menu").parent().addClass("cost-dropdown-menu-style-simple");
				}
				$("#" + $(this).attr("id") + "-menu").parent().addClass("cost-dropdown-menu");
				$(this).selectmenu("refresh");
			}
		});
	});
	/*$.datepicker.regional['nl'] = {clearText: 'Effacer', clearStatus: '',
		closeText: 'sluiten', closeStatus: 'Onveranderd sluiten ',
		prevText: '<vorige', prevStatus: 'Zie de vorige maand',
		nextText: 'volgende>', nextStatus: 'Zie de volgende maand',
		currentText: 'Huidige', currentStatus: 'Bekijk de huidige maand',
		monthNames: ['januari','februari','maart','april','mei','juni',
		'juli','augustus','september','oktober','november','december'],
		monthNamesShort: ['jan','feb','mrt','apr','mei','jun',
		'jul','aug','sep','okt','nov','dec'],
		monthStatus: 'Bekijk een andere maand', yearStatus: 'Bekijk nog een jaar',
		weekHeader: 'Sm', weekStatus: '',
		dayNames: ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'],
		dayNamesShort: ['zo', 'ma','di','wo','do','vr','za'],
		dayNamesMin: ['zo', 'ma','di','wo','do','vr','za'],
		dayStatus: 'Gebruik DD als de eerste dag van de week', dateStatus: 'Kies DD, MM d',
		dateFormat: 'dd/mm/yy', firstDay: 1, 
		initStatus: 'Kies een datum', isRTL: false};
	$.datepicker.setDefaults($.datepicker.regional['nl']);*/
	$(".cost-slider-datepicker").each(function(){
		$(this).datepicker({
			dateFormat: "DD, d MM yy",
			nextText: "",
			prevText: ""
		});
	});
	$(".datepicker-container .ui-icon").on("click", function(){
		$(this).next().datepicker("show");
	});
	//home slider
	$("#final-service-cost").costCalculator({
		formula: "sales-per-month-value+36",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: ".",
		decimalPlaces: 0,
		updateHidden: $("#final-service-cost-total")
	});
	//home 2 slider
	$("#monthly-repayments").costCalculator({
		formula: "loan-amount*{powerstart}1+rate-of-interest/100/12^loan-term{powerend}*(1+rate-of-interest/100/12{-}1)/({powerstart}1+rate-of-interest/100/12^loan-term{powerend}{-}1)",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#monthly-repayments-total")
	});
	$("#total-repeyable").costCalculator({
		formula: "monthly-repayments-total-value*loan-term",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#total-repeyable-total")
	});
	$(".loan-amount-summary").costCalculator({
		formula: "loan-amount",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".loan-term-summary").costCalculator({
		formula: "loan-term",
		currencyBefore: "",
		currencyAfter: " mo.",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".interest-amount-summary").costCalculator({
		formula: "total-repeyable-total-value{-}loan-amount",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".total-repeyable-summary").costCalculator({
		formula: "total-repeyable-total-value",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	//bookkeeping quoting calculator
	$("#startup").costCalculator({
		formula: "sales-per-month-value*business-type+purchase-per-month-value+employees-number*30+foreign-currency*sales-per-month-value+employees-number*annual-tax+sales-per-month-value*invoicing-customers+tax-advisor+tax-optimization+contracts-preparation",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: ".",
		decimalPlaces: 0,
		updateHidden: $("#startup-total")
	});
	$("#timesaver").costCalculator({
		formula: "sales-per-month-value*(business-type+business-type*1.85)+purchase-per-month-value+employees-number*35+foreign-currency*sales-per-month-value*1.5+employees-number*annual-tax+sales-per-month-value*invoicing-customers+tax-advisor+tax-optimization+contracts-preparation",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: ".",
		decimalPlaces: 0,
		updateHidden: $("#timesaver-total")
	});
	$("#enterprise").costCalculator({
		formula: "sales-per-month-value*(business-type+business-type*5.65)+purchase-per-month-value*1.2+employees-number*45+foreign-currency*sales-per-month-value*2+employees-number*annual-tax+sales-per-month-value*invoicing-customers+tax-advisor+tax-optimization+contracts-preparation",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: ".",
		decimalPlaces: 0,
		updateHidden: $("#enterprise-total")
	});
	//loan cost calculator monthly
	$("#monthly-repayments-loan").costCalculator({
		formula: "loan-amount*{powerstart}1+rate-of-interest/100/12^loan-term{powerend}*(1+rate-of-interest/100/12{-}1)/({powerstart}1+rate-of-interest/100/12^loan-term{powerend}{-}1)",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#monthly-repayments-total")
	});
	//loan cost calculator larger loan
	$("#larger-loan").costCalculator({
		formula: "2*loan-amount*{powerstart}1+larger-rate-of-interest/100/12^loan-term{powerend}*(1+larger-rate-of-interest/100/12{-}1)/({powerstart}1+larger-rate-of-interest/100/12^loan-term{powerend}{-}1)",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#larger-loan-total")
	});
	$("#larger-total-repeyable").costCalculator({
		formula: "larger-loan-total-value*loan-term",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#larger-total-repeyable-total")
	});
	$(".larger-loan-amount-summary").costCalculator({
		formula: "2*loan-amount",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".larger-interest-amount-summary").costCalculator({
		formula: "larger-total-repeyable-total-value{-}2*loan-amount",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".larger-total-repeyable-summary").costCalculator({
		formula: "larger-total-repeyable-total-value",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	//longer cost calculator larger loan
	$("#longer-loan").costCalculator({
		formula: "loan-amount*{powerstart}1+longer-rate-of-interest/100/12^(2*loan-term){powerend}*(1+longer-rate-of-interest/100/12{-}1)/({powerstart}1+longer-rate-of-interest/100/12^(2*loan-term){powerend}{-}1)",
		currencyBefore: "$",
		currencyAfter: "/ month",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#longer-loan-total")
	});
	$("#longer-total-repeyable").costCalculator({
		formula: "longer-loan-total-value*2*loan-term",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0,
		updateHidden: $("#longer-total-repeyable-total")
	});
	$(".longer-loan-term-summary").costCalculator({
		formula: "2*loan-term",
		currencyBefore: "",
		currencyAfter: " mo.",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".longer-interest-amount-summary").costCalculator({
		formula: "longer-total-repeyable-total-value{-}loan-amount",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	$(".longer-total-repeyable-summary").costCalculator({
		formula: "longer-total-repeyable-total-value",
		currencyBefore: "$",
		thousandthSeparator: ",",
		decimalSeparator: "",
		decimalPlaces: 0
	});
	
	//parallax
	if(!navigator.userAgent.match(/(iPod|iPhone|iPad|Android)/))
	{
		$(".moving-parallax").each(function(){
			$(this).parallax({
				speed: -50
			});
		});
	}
	else
		$(".fp-parallax").addClass("attachment-scroll");
	
	//isotope
	$(".isotope").each(function(index){
		var self = $(this);
		self.isotope({
			itemSelector: 'li:not(.gutter-sizer)',
			layoutMode: 'fitRows',
			fitRows: {
				gutter: '.gutter-sizer'
			}
		});
		// layout Isotope after each image loads
		self.imagesLoaded().progress( function() {
		  self.isotope('layout');
		});
	});
	
	//testimonials
	$(".testimonials-carousel").each(function(){
		var self = $(this);
		var length = $(this).children().length;
		var elementClasses = $(this).attr('class').split(' ');
		var autoplay = 0;
		var pause_on_hover = 0;
		var visible = 1;
		var scroll = 1;
		var effect = "scroll";
		var easing = "easeInOutQuint";
		var duration = 750;
		for(var i=0; i<elementClasses.length; i++)
		{
			if(elementClasses[i].indexOf('autoplay-')!=-1)
				autoplay = elementClasses[i].replace('autoplay-', '');
			if(elementClasses[i].indexOf('pause_on_hover-')!=-1)
				pause_on_hover = elementClasses[i].replace('pause_on_hover-', '');
			if(elementClasses[i].indexOf('visible-')!=-1)
				visible = elementClasses[i].replace('visible-', '');
			if(elementClasses[i].indexOf('scroll-')!=-1)
				scroll = elementClasses[i].replace('scroll-', '');
			if(elementClasses[i].indexOf('effect-')!=-1)
				effect = elementClasses[i].replace('effect-', '');
			if(elementClasses[i].indexOf('easing-')!=-1)
				easing = elementClasses[i].replace('easing-', '');
			if(elementClasses[i].indexOf('duration-')!=-1)
				duration = elementClasses[i].replace('duration-', '');
		}
		var length = self.children().length;
		self.data("scroll", parseInt(scroll, 10));
		if(length<parseInt(visible, 10))
			visible = length;
		if($(".header").width()<=462)
		{
			scroll = 1;
			visible = 1;
		}
		self.carouFredSel({
			items: {
				start: 0,
				visible: parseInt(visible, 10)
			},
			scroll: {
				items: parseInt(scroll, 10),
				fx: effect,
				easing: easing,
				duration: parseInt(duration, 10),
				pauseOnHover: (parseInt(pause_on_hover, 10) ? true : false),
				onAfter: function(){
					$(this).trigger('configuration', [{scroll :{
						easing: "easeInOutQuint",
						duration: 750
					}}, true]);
				}
			},
			auto: {
				items: parseInt(scroll, 10),
				play: (parseInt(autoplay, 10) ? true : false),
				fx: effect,
				easing: easing,
				duration: parseInt(duration, 10),
				pauseOnHover: (parseInt(pause_on_hover, 10) ? true : false),
				onAfter: null
			},
			pagination: {
				items: parseInt(scroll, 10),
				container: $(self).prev(".fp-carousel-pagination")
			},
			'prev': {button: self.prev()},
			'next': {button: self.next()}
		},
		{
			wrapper: {
				classname: "caroufredsel-wrapper caroufredsel-wrapper-testimonials"
			}
		});
		var base = "x";
		var scrollOptions = {
			scroll: {
				easing: "easeInOutQuint",
				duration: 750
			}
		};
		self.swipe({
			fallbackToMouseEvents: true,
			allowPageScroll: "vertical",
			excludedElements:"button, input, select, textarea, .noSwipe",
			swipeStatus: function(event, phase, direction, distance, fingerCount, fingerData ) {
				//if(!self.is(":animated") && (!$(".control-for-" + self.attr("id")).length || ($(".control-for-" + self.attr("id")).length && !$(".control-for-" + self.attr("id")).is(":animated"))))
				if(!self.is(":animated"))
				{
					self.trigger("isScrolling", function(isScrolling){
						if(!isScrolling)
						{
							if (phase == "move" && (direction == "left" || direction == "right") && effect=="scroll") 
							{
								if(base=="x")
								{
									self.trigger("configuration", scrollOptions);
									self.trigger("pause");
								}
								if (direction == "left") 
								{
									if(base=="x")
										base = 0;
									self.css("left", parseInt(base, 10)-distance + "px");
								} 
								else if (direction == "right") 
								{	
									if(base=="x" || base==0)
									{
										self.children().slice(-self.data("scroll")).prependTo(self);
										base = -self.data("scroll")*self.children().first().width()-self.data("scroll")*parseInt(self.children().first().css("margin-right"), 10);
									}
									self.css("left", base+distance + "px");
								}

							} 
							else if (phase == "cancel" && effect=="scroll") 
							{
								if(distance!=0)
								{
									self.trigger("play");
									self.animate({
										"left": base + "px"
									}, 750, "easeInOutQuint", function(){
										if(base==-self.data("scroll")*self.children().first().width()-self.data("scroll")*parseInt(self.children().first().css("margin-right"), 10))
										{
											self.children().slice(0, self.data("scroll")).appendTo(self);
											self.css("left", "0px");
											base = "x";
										}
										self.trigger("configuration", {scroll: {
											easing: "easeInOutQuint",
											duration: 750
										}});
									});
								}
							} 
							else if (phase == "end") 
							{
								self.trigger("play");
								if (direction == "right") 
								{
									if(effect=="scroll")
									{
										self.trigger('ql_set_page_nr', self.data("scroll"));
										self.animate({
											"left": 0 + "px"
										}, 750, "easeInOutQuint", function(){
											self.trigger("configuration", {scroll: {
												easing: "easeInOutQuint",
												duration: 750
											}});
											base = "x";
										});
									}
									else
									{
										self.trigger("prevPage");
									}
								} 
								else if (direction == "left") 
								{
									if(effect=="scroll")
									{
										if(base==-self.children().first().width()-parseInt(self.children().first().css("margin-right"), 10))
										{
											self.children().first().appendTo(self);
											self.css("left", (parseInt(self.css("left"), 10)-base)+"px");
										}
										self.trigger("nextPage");
										self.trigger("configuration", {scroll: {
											easing: "easeInOutQuint",
											duration: 750
										}});
										base = "x";
									}
									else
									{
										self.trigger("nextPage");
									}
								}
							}
						}
					});
				}
			}
		});
	});
	setTimeout(function(){
		$(".testimonials-carousel").trigger('configuration', ['debug', false, true]);
	}, 1);
	//our-clients
	$(".our-clients-list:not('.type-list')").each(function(index){
		$(this).addClass("fp-preloader_" + index);
		$(".fp-preloader_" + index).before("<span class='fp-preloader'></span>");
		$(".fp-preloader_" + index).imagesLoaded(function(){
			$(".fp-preloader_" + index).prev(".fp-preloader").remove();
			$(".fp-preloader_" + index).fadeTo("slow", 1, function(){
				$(this).css("opacity", "");
			});
			var self = $(".fp-preloader_" + index);
			self.carouFredSel({
				items: {
					visible: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2)))
				},
				scroll: {
					items: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2))),
					easing: "easeInOutQuint",
					duration: 750
				},
				auto: {
					play: false
				},
				pagination: {
					items: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2))),
					container: $(self).next()
				}
			});
			var base = "x";
			var scrollOptions = {
				scroll: {
					easing: "easeInOutQuint",
					duration: 750
				}
			};
			self.swipe({
				fallbackToMouseEvents: true,
				allowPageScroll: "vertical",
				excludedElements:"button, input, select, textarea, .noSwipe",
				swipeStatus: function(event, phase, direction, distance, fingerCount, fingerData ) {
					//if(!self.is(":animated") && (!$(".control-for-" + self.attr("id")).length || ($(".control-for-" + self.attr("id")).length && !$(".control-for-" + self.attr("id")).is(":animated"))))
					if(!self.is(":animated"))
					{
						self.trigger("isScrolling", function(isScrolling){
							if(!isScrolling)
							{
								if (phase == "move" && (direction == "left" || direction == "right")) 
								{
									if(base=="x")
									{
										self.trigger("configuration", scrollOptions);
										self.trigger("pause");
									}
									if (direction == "left") 
									{
										if(base=="x")
											base = 0;
										self.css("left", parseInt(base, 10)-distance + "px");
									} 
									else if (direction == "right") 
									{	
										if(base=="x" || base==0)
										{
											self.children().last().prependTo(self);
											base = -self.children().first().width()-parseInt(self.children().first().css("margin-right"), 10);
										}
										self.css("left", base+distance + "px");
									}

								} 
								else if (phase == "cancel") 
								{
									if(distance!=0)
									{
										self.trigger("play");
										self.animate({
											"left": base + "px"
										}, 750, "easeInOutQuint", function(){
											if(base==-self.children().first().width()-parseInt(self.children().first().css("margin-right"), 10))
											{
												self.children().first().appendTo(self);
												self.css("left", "0px");
												base = "x";
											}
											self.trigger("configuration", {scroll: {
												easing: "easeInOutQuint",
												duration: 750
											}});
										});
									}
								} 
								else if (phase == "end") 
								{
									self.trigger("play");
									if (direction == "right") 
									{
										self.trigger("prevPage");
										self.children().first().appendTo(self);
										self.animate({
											"left": 0 + "px"
										}, 200, "linear", function(){
											self.trigger("configuration", {scroll: {
												easing: "easeInOutQuint",
												duration: 750
											}});
											base = "x";
										});
									} 
									else if (direction == "left") 
									{
										if(base==-self.children().first().width()-parseInt(self.children().first().css("margin-right"), 10))
										{
											self.children().first().appendTo(self);
											self.css("left", (parseInt(self.css("left"), 10)-base)+"px");
										}
										self.trigger("nextPage");
										self.trigger("configuration", {scroll: {
											easing: "easeInOutQuint",
											duration: 750
										}});
										base = "x";
									}
								}
							}
						});
					}
				}
			});
		});
	});
	
	//horizontal carousel
	var horizontalCarousel = function()
	{
		$(".horizontal-carousel").each(function(index){
			$(this).addClass("fp-preloader-hr-carousel_" + index);
			$(".fp-preloader-hr-carousel_" + index).before("<span class='fp-preloader'></span>");
			$(".fp-preloader-hr-carousel_" + index).imagesLoaded(function(instance){
				$(".fp-preloader-hr-carousel_" + index).prev(".fp-preloader").remove();
				$(".fp-preloader-hr-carousel_" + index).fadeTo("slow", 1, function(){
					$(this).css("opacity", "");
				});
				
				//caroufred
				var visible = 3;
				var autoplay = 0;
				var pause_on_hover = 0;
				var scroll = 3;
				var effect = "scroll";
				var easing = "easeInOutQuint";
				var duration = 750;
				var navigation = 0;
				var pagination = 1;
				var control_for = "";
				var elementClasses = $(".fp-preloader-hr-carousel_" + index).attr('class').split(' ');
				for(var i=0; i<elementClasses.length; i++)
				{
					if(elementClasses[i].indexOf('visible-')!=-1)
						visible = elementClasses[i].replace('visible-', '');
					if(elementClasses[i].indexOf('autoplay-')!=-1)
						autoplay = elementClasses[i].replace('autoplay-', '');
					if(elementClasses[i].indexOf('pause_on_hover-')!=-1)
						pause_on_hover = elementClasses[i].replace('pause_on_hover-', '');
					if(elementClasses[i].indexOf('scroll-')!=-1)
						scroll = elementClasses[i].replace('scroll-', '');
					if(elementClasses[i].indexOf('effect-')!=-1)
						effect = elementClasses[i].replace('effect-', '');
					if(elementClasses[i].indexOf('easing-')!=-1)
						easing = elementClasses[i].replace('easing-', '');
					if(elementClasses[i].indexOf('duration-')!=-1)
						duration = elementClasses[i].replace('duration-', '');
					if(elementClasses[i].indexOf('navigation-')!=-1)
						navigation = elementClasses[i].replace('navigation-', '');
					if(elementClasses[i].indexOf('pagination-')!=-1)
						pagination = elementClasses[i].replace('pagination-', '');
					/*if(elementClasses[i].indexOf('threshold-')!=-1)
						var threshold = elementClasses[i].replace('threshold-', '');*/
					if(elementClasses[i].indexOf('control-for-')!=-1)
						control_for = elementClasses[i].replace('control-for-', '');
				}
				var self = $(".fp-preloader-hr-carousel_" + index);
				if($(".header").width()<=462)
				{
					scroll = 1;
					if(self.hasClass("features-list") && self.hasClass("type-big"))
					{
						visible = 3;
					}
					else
					{
						visible = 1;
					}
				}
				else if($(".header").width()<=300)
				{
					if(self.hasClass("features-list") && self.hasClass("type-big"))
					{
						visible = 2;
					}
				}
				else if(parseInt(scroll, 10)>3)
					scroll = 3;
				
				var length = self.children().length;
				self.data("scroll", scroll);
				if(length<parseInt(visible, 10))
					visible = length;
				self.data("visible", parseInt(visible, 10));
				var carouselOptions = {
					items: {
						start: 0,
						visible: parseInt(visible, 10)
					},
					scroll: {
						items: parseInt(scroll, 10),
						fx: effect,
						easing: easing,
						duration: parseInt(duration, 10),
						pauseOnHover: (parseInt(pause_on_hover, 10) ? true : false),
						onAfter: function(){
							$(this).trigger('configuration', [{scroll :{
								easing: "easeInOutQuint",
								duration: 750
							}}, true]);
						}
					},
					auto: {
						items: parseInt(scroll, 10),
						play: (parseInt(autoplay, 10) ? true : false),
						fx: effect,
						easing: easing,
						duration: parseInt(duration, 10),
						pauseOnHover: (parseInt(pause_on_hover, 10) ? true : false),
						onAfter: null
					}
				};
				if(parseInt(pagination, 10))
				{
					carouselOptions.pagination = {
						items: parseInt(scroll, 10),
						container: $(self).next()
					};
				}
				if(parseInt(navigation, 10))
				{
					carouselOptions.prev = {
						button: $(self).next(".carousel-navigation").children().first()
					};
					carouselOptions.next = {
						button: $(self).next(".carousel-navigation").children().last()
					};
				}
				self.carouFredSel(carouselOptions,{
					wrapper: {
						classname: "caroufredsel-wrapper"
					}
				});
				var base = "x";
				var scrollOptions = {
					scroll: {
						easing: "linear",
						duration: 200
					}
				};
				self.swipe({
					fallbackToMouseEvents: true,
					allowPageScroll: "vertical",
					excludedElements:"button, input, select, textarea, .noSwipe",
					swipeStatus: function(event, phase, direction, distance, fingerCount, fingerData ) {
						//if(!self.is(":animated") && (!$(".control-for-" + self.attr("id")).length || ($(".control-for-" + self.attr("id")).length && !$(".control-for-" + self.attr("id")).is(":animated"))))
						if(!self.is(":animated"))
						{
							self.trigger("isScrolling", function(isScrolling){
								if(!isScrolling)
								{
									if (phase == "move" && (direction == "left" || direction == "right")) 
									{
										if(base=="x")
										{
											self.trigger("configuration", scrollOptions);
											self.trigger("pause");
										}
										if (direction == "left") 
										{
											if(base=="x")
												base = 0;
											self.css("left", parseInt(base, 10)-distance + "px");
										} 
										else if (direction == "right") 
										{	
											if(base=="x" || base==0)
											{
												//self.children().last().prependTo(self);
												self.children().slice(-self.data("scroll")).prependTo(self);
												base = -self.data("scroll")*self.children().first().width()-self.data("scroll")*parseInt(self.children().first().css("margin-right"), 10);
											}
											self.css("left", base+distance + "px");
										}

									} 
									else if (phase == "cancel") 
									{
										if(distance!=0)
										{
											self.trigger("play");
											self.animate({
												"left": base + "px"
											}, 750, "easeInOutQuint", function(){
												if(base==-self.data("scroll")*self.children().first().width()-self.data("scroll")*parseInt(self.children().first().css("margin-right"), 10))
												{
													//self.children().first().appendTo(self);
													self.children().slice(0, self.data("scroll")).appendTo(self);
													self.css("left", "0px");
													base = "x";
												}
												self.trigger("configuration", {scroll: {
													easing: "easeInOutQuint",
													duration: 750
												}});
											});
										}
									} 
									else if (phase == "end") 
									{
										self.trigger("play");
										if (direction == "right") 
										{
											self.trigger('ql_set_page_nr', self.data("scroll"));
											self.animate({
												"left": 0 + "px"
											}, 200, "linear", function(){
												self.trigger("configuration", {scroll: {
													easing: "easeInOutQuint",
													duration: 750
												}});
												base = "x";
											});
										} 
										else if (direction == "left") 
										{
											if(base==-self.children().first().width()-parseInt(self.children().first().css("margin-right"), 10))
											{
												self.children().first().appendTo(self);
												self.css("left", (parseInt(self.css("left"), 10)-base)+"px");
											}
											self.trigger("nextPage");
											self.trigger("configuration", {scroll: {
												easing: "easeInOutQuint",
												duration: 750
											}});
											base = "x";
										}
									}
								}
							});
						}
					}
				});
			});
		});
	};
	horizontalCarousel();
	
	//counters
	var counters = function()
	{
		$(".counters-group").each(function(){
			var topValue = 0, currentValue = 0;
			var counterBoxes = $(this).find(".counter-box");
			if($(this).hasClass("type-percentage"))
			{
				topValue = 100;
			}
			counterBoxes.each(function(index){
				var self = $(this);
				if(self.find("[data-value]").length)
				{
					currentValue = parseInt(self.find("[data-value]").data("value").toString().replace(" ",""), 10);
					if(currentValue>topValue)
						topValue = currentValue;
				}
			});
			counterBoxes.each(function(index){
				var self = $(this);
				currentValue = parseInt(self.find("[data-value]").data("value").toString().replace(" ",""), 10);
				self.find(".counter-box-path").data("dashoffset", 439-(currentValue/topValue*439));
			});
		});
		$(".single-counter-box").each(function(){
			var self = $(this);
			var currentValue = parseInt(self.find("[data-value]").data("value").toString().replace(" ",""), 10);
			var topValue = 100;
			if(self.find("[data-top-value]").length)
			{
				topValue = parseInt(self.find("[data-top-value]").data("top-value").toString().replace(" ",""), 10);
			}
			self.find(".counter-box-path").data("dashoffset", 439-(currentValue/topValue*439));
		});
	}
	counters();
	
	//accordion
	$(".accordion").accordion({
		event: 'change',
		heightStyle: 'content',
		icons: {"header": "template-plus3", "activeHeader": "template-minus3"},
		/*active: false,
		collapsible: true*/
		create: function(event, ui){
			$(window).trigger('resize');
			$(".horizontal-carousel").trigger('configuration', ['debug', false, true]);
			ui.header.parent().addClass("accordion-active");
		},
		beforeActivate: function(event, ui)
		{
			ui.oldHeader.parent().removeClass("accordion-active");
			ui.newHeader.parent().addClass("accordion-active");
		}
	});
	$(".accordion.wide").on("accordionchange", function(event, ui){
		$("html, body").animate({scrollTop: $("#"+$(ui.newHeader).attr("id")).offset().top}, 400);
	});
	$(".tabs:not('.no-scroll')").on("tabsbeforeactivate", function(event, ui){
		$("html, body").animate({scrollTop: $("#"+$(ui.newTab).children("a").attr("id")).offset().top}, 400);
	});
	$(".tabs").tabs({
		event: 'change',
		show: 200,
		hide: 200,
		create: function(){
			$("html, body").scrollTop(0);
		},
		activate: function(event, ui){
			ui.oldPanel.find(".submit-contact-form, [name='submit'], [name='name'], [name='email'], [name='message']").qtip('hide');
		}
	});
	
	//browser history
	$(".tabs .ui-tabs-nav a").on("click", function(){
		if($(this).attr("href").substr(0,4)!="http")
			$.bbq.pushState($(this).attr("href"));
		else
			window.location.href = $(this).attr("href");
	});
	$(".ui-accordion .ui-accordion-header").on("click", function(){
		$.bbq.pushState("#" + $(this).attr("id").replace("accordion-", ""));
	});
	
	$(".scroll-to-comments").on("click", function(event){
		event.preventDefault();
		var offset = $("#comments-list").offset();
		if(typeof(offset)!="undefined")
			$("html, body").animate({scrollTop: offset.top-90}, 400);
	});
	$(".scroll-to-comment-form").on("click", function(event){
		event.preventDefault();
		var offset = $("#comment-form").offset();
		if(typeof(offset)!="undefined")
			$("html, body").animate({scrollTop: offset.top-90}, 400);
	});
	//hashchange
	$(window).on("hashchange", function(event){
		var hashSplit = $.param.fragment().split("-");
		var hashString = "";
		for(var i=0; i<hashSplit.length-1; i++)
			hashString = hashString + hashSplit[i] + (i+1<hashSplit.length-1 ? "-" : "");
		if(hashSplit[0].substr(0,11)!="prettyPhoto")
		{
			if(hashSplit[0].substr(0,7)!="filter=")
			{
				$('.ui-accordion .ui-accordion-header#accordion-' + decodeURIComponent($.param.fragment())).trigger("change");
				$('.ui-accordion .ui-accordion-header#accordion-' + decodeURIComponent(hashString)).trigger("change");
			}
			$('.tabs .ui-tabs-nav [href="#' + decodeURIComponent(hashString) + '"]').trigger("change");
			$('.tabs .ui-tabs-nav [href="#' + decodeURIComponent($.param.fragment()) + '"]').trigger("change");
			if(hashSplit[0].substr(0,7)!="filter=")
				$('.tabs .ui-accordion .ui-accordion-header#accordion-' + decodeURIComponent($.param.fragment())).trigger("change");
			$(".testimonials-carousel, .our-clients-list:not('.type-list')").trigger('configuration', ['debug', false, true]);
			$(document).scroll();
		}
		if(hashSplit[0].substr(0,7)=="comment")
		{
			if($(location.hash).length)
			{
				var offset = $(location.hash).offset();
				$("html, body").animate({scrollTop: offset.top-90}, 400);
			}
		}
		
		// get options object from hash
		var hashOptions = $.deparam.fragment();

		if(hashSplit[0].substr(0,7)=="filter")
		{
			var filterClass = decodeURIComponent($.param.fragment()).substr(7, decodeURIComponent($.param.fragment()).length);
			// apply options from hash
			$(".isotope-filters a").removeClass("selected");
			if($('.isotope-filters a[href="#filter-' + filterClass + '"]').length)
				$('.isotope-filters a[href="#filter-' + filterClass + '"]').addClass("selected");
			else
				$(".isotope-filters li:first a").addClass("selected");
			
			$(".isotope").isotope({filter: (filterClass!="*" ? "." : "") + filterClass});
		}
	}).trigger("hashchange");
	
	$('body.dont-scroll').on("touchmove", {}, function(event){
	  event.preventDefault();
	});
	
	if($("#map").length && typeof(google)!="undefined")
	{
		//google map
		var coordinate = new google.maps.LatLng(($("#map").data("map-center-lat") ? $("#map").data("map-center-lat") : 45.4005763), ($("#map").data("map-center-lng") ? $("#map").data("map-center-lng") : -75.6837527));
		var mapOptions = {
			zoom: ($("#map").data("zoom") ? $("#map").data("zoom") : 13),
			center: coordinate,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			streetViewControl: false,
			mapTypeControl: false,
			scrollwheel: (parseInt($("#map").data("scroll-wheel"), 10) ? true : false),
			draggable: parseInt($("#map").data("draggable"), 10),
			styles: [
			  {
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#f2f4f8"
				  }
				]
			  },
			  {
				"elementType": "labels.icon",
				"stylers": [
				  {
					"visibility": "off"
				  }
				]
			  },
			  {
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#616161"
				  }
				]
			  },
			  {
				"elementType": "labels.text.stroke",
				"stylers": [
				  {
					"color": "#f5f5f5"
				  }
				]
			  },
			  {
				"featureType": "administrative",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#8b909d"
				  }
				]
			  },
			  {
				"featureType": "administrative.land_parcel",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#bdbdbd"
				  }
				]
			  },
			  {
				"featureType": "poi",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#e3e6ec"
				  }
				]
			  },
			  {
				"featureType": "poi",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#8b909d"
				  }
				]
			  },
			  {
				"featureType": "poi.park",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#e5e5e5"
				  },
				  {
					"visibility": "off"
				  }
				]
			  },
			  {
				"featureType": "poi.park",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#9e9e9e"
				  }
				]
			  },
			  {
				"featureType": "road",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#ffffff"
				  }
				]
			  },
			  {
				"featureType": "road",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#8b909d"
				  }
				]
			  },
			  {
				"featureType": "road",
				"elementType": "labels.text.stroke",
				"stylers": [
				  {
					"color": "#ffffff"
				  }
				]
			  },
			  {
				"featureType": "road.arterial",
				"elementType": "geometry",
				"stylers": [
				  {
					"weight": 1
				  }
				]
			  },
			  {
				"featureType": "road.highway",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#d5d9e0"
				  },
				  {
					"weight": 1
				  }
				]
			  },
			  {
				"featureType": "road.highway",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#8b909d"
				  }
				]
			  },
			  {
				"featureType": "road.local",
				"elementType": "geometry",
				"stylers": [
				  {
					"weight": 1
				  }
				]
			  },
			  {
				"featureType": "transit",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#8b909d"
				  }
				]
			  },
			  {
				"featureType": "transit.line",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#e5e5e5"
				  }
				]
			  },
			  {
				"featureType": "transit.station",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#eeeeee"
				  }
				]
			  },
			  {
				"featureType": "transit.station.airport",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#e3e6ec"
				  }
				]
			  },
			  {
				"featureType": "water",
				"elementType": "geometry",
				"stylers": [
				  {
					"color": "#d5e4fe"
				  }
				]
			  },
			  {
				"featureType": "water",
				"elementType": "labels.text.fill",
				"stylers": [
				  {
					"color": "#ffffff"
				  },
				  {
					"visibility": "off"
				  }
				]
			  }
			]
		};
		
		map = new google.maps.Map(document.getElementById("map"),mapOptions);
		marker = new google.maps.Marker({
			position: new google.maps.LatLng(($("#map").data("marker-lat") ? $("#map").data("marker-lat") : 45.4005763), ($("#map").data("marker-lng") ? $("#map").data("marker-lng") : -75.6837527)),
			map: map,
			icon: new google.maps.MarkerImage("images/map-marker.svg", new google.maps.Size(42, 50), null, new google.maps.Point(21, 50))
		});
	}
	
	//features click
	$(".features-list.type-big li").on("click", function(){
		var href = $(this).find(".more-submit").attr("href");
		if(typeof(href)!="undefined")
		{
			window.location.href = href;
		}
	});

	//window resize
	function windowResize()
	{
		if(map!=null)
			map.setCenter(coordinate);
		if($(".fp-smart-column").length && $(".header").width()>462)
		{
			var topOfWindow = $(window).scrollTop();
			$(".fp-smart-column").each(function(){
				var row = $(this).parent();
				var wrapper = $(this).children().first();
				var childrenHeight = 0;
				wrapper.children().each(function(){
					childrenHeight += $(this).outerHeight(true);
				});
				if(childrenHeight<$(window).height() && row.offset().top-20<topOfWindow && row.offset().top-20+row.outerHeight()-childrenHeight>topOfWindow)
				{
					wrapper.css({"position": "fixed", "bottom": "auto", "top": "20px", "width": $(this).width() + "px"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight<$(window).height() && row.offset().top-20+row.outerHeight()-childrenHeight<=topOfWindow && (row.outerHeight()-childrenHeight>0))
				{
					wrapper.css({"position": "absolute", "bottom": "0", "top": (row.outerHeight()-childrenHeight) + "px", "width": "auto"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight>=$(window).height() && row.offset().top+20+childrenHeight<topOfWindow+$(window).height() && row.offset().top+20+row.outerHeight()>topOfWindow+$(window).height())
				{	
					wrapper.css({"position": "fixed", "bottom": "20px", "top": "auto", "width": $(this).width() + "px"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight>=$(window).height() && row.offset().top+20+row.outerHeight()<=topOfWindow+$(window).height() && (row.outerHeight()-childrenHeight>0))
				{
					wrapper.css({"position": "absolute", "bottom": "0", "top": (row.outerHeight()-childrenHeight) + "px", "width": "auto"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else
				{
					wrapper.css({"position": "static", "bottom": "auto", "top": "auto", "width": "auto"});
					$(this).css({"height": childrenHeight + "px"});
				}
			});
		}
		$(".horizontal-carousel").each(function(){
			var self = $(this);
			var scroll = 3;
			var visible = 3;
			var elementClasses = self.attr('class').split(' ');
			for(var i=0; i<elementClasses.length; i++)
			{
				if(elementClasses[i].indexOf('visible-')!=-1)
					visible = elementClasses[i].replace('visible-', '');
				if(elementClasses[i].indexOf('scroll-')!=-1)
					scroll = elementClasses[i].replace('scroll-', '');
			}
			if($(".header").width()<=462)
				{
					scroll = 1;
					if(self.hasClass("features-list") && self.hasClass("type-big"))
					{
						visible = 3;
					}
					else
					{
						visible = 1;
					}
				}
				else if($(".header").width()<=300)
				{
					if(self.hasClass("features-list") && self.hasClass("type-big"))
					{
						visible = 2;
					}
				}
			self.data("scroll", (scroll==1 || $(".header").width()<=462 ? 1 : 3));
			self.data("visible", (visible==1 || $(".header").width()<=462 ? (self.hasClass("features-list") && self.hasClass("type-big") ? ($(".header").width()<=300 ? 2 : 3) : 1) : 3));
			self.trigger("configuration", {
				items: {
					visible: self.data("visible")
				},
				scroll: {
					items: self.data("scroll")
				},
				pagination: {
					items: self.data("scroll")
				}
			});
		});
		$(".our-clients-list:not('.type-list')").each(function(){
			var self = $(this);
			self.trigger("configuration", {
				items: {
					visible: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2)))
				},
				scroll: {
					items: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2)))
				},
				pagination: {
					items: ($(".header").width()>750 ? 6 : ($(".header").width()>462 ? 4 : ($(".header").width()>300 ? 3 : 2)))
				}
			});
		});
		$(".testimonials-carousel").each(function(){
			var self = $(this);
			//caroufred
			var scroll = 1;
			var visible = 1;
			var elementClasses = self.attr('class').split(' ');
			for(var i=0; i<elementClasses.length; i++)
			{
				if(elementClasses[i].indexOf('scroll-')!=-1)
					scroll = elementClasses[i].replace('scroll-', '');
				if(elementClasses[i].indexOf('visible-')!=-1)
					visible = elementClasses[i].replace('visible-', '');
			}
			if($(".header").width()<=462)
			{
				scroll = 1;
				visible = 1;
			}
			else if(parseInt(scroll, 10)>3)
				scroll = 3;
			self.trigger("configuration", {
				items: {
					visible: parseInt(visible, 10)
				},
				scroll: {
					items: parseInt(scroll, 10)
				},
				pagination: {
					items: parseInt(scroll, 10)
				}
			});
		});
		//isotope
		$(".isotope").each(function(index){
			$(this).isotope('layout');
		});
		$(".flex-box .column-1-2 .ui-selectmenu-button").each(function(){
			$(this).css("max-width", $(this).parent().parent().width()/2);
		});
		if($(".header").width()>462)
		{
			if(!$(".header-top-bar").is(":visible"))
				$(".header-toggle").trigger("click");
		}
		if($(".sticky").length)
		{
			if($(".header-container").hasClass("sticky"))
				menu_position = $(".header-container").offset().top;
			var topOfWindow = $(window).scrollTop();
				
			if(menu_position!=null && $(".header-container .sf-menu").is(":visible"))
			{
				if($(".transparent-header-container").length)
					modificator = 7;
				if(menu_position+modificator<topOfWindow)
				{
					if(!$("#fp-sticky-clone").hasClass("move"))
					{
						$("#fp-sticky-clone").addClass("move");
						if($(".transparent-header-container").length)
						{
							$('.header-container.sticky:not("#fp-sticky-clone")').css("visibility", "hidden");
							setTimeout(function(){
								if($("#fp-sticky-clone").hasClass("move"))
									$("#fp-sticky-clone").addClass("disable-transition");
							}, 300);
						}
						else
							$(".header-container").addClass("transition");
						$(".template-big-search").off("click");
						$(".template-big-search").on("click", function(event){
							event.preventDefault();
							$(this).parent().children(".search").toggle();
						});
					}
				}
				else
				{
					$("#fp-sticky-clone").removeClass("move");
					if($(".transparent-header-container").length)
					{
						$('.header-container.sticky:not("#fp-sticky-clone")').css("visibility", "visible");
						$("#fp-sticky-clone").removeClass("disable-transition");
					}
					else
						$(".header-container").removeClass("transition");
				}
			}
			else
			{
				$("#fp-sticky-clone").removeClass("move");
				if($(".transparent-header-container").length)
				{
					$('.header-container.sticky:not("#fp-sticky-clone")').css("visibility", "visible");
					$("#fp-sticky-clone").removeClass("disable-transition");
				}
				else
					$(".header-container").removeClass("transition");
			}
		}
	}
	$(window).resize(windowResize);
	window.addEventListener('orientationchange', windowResize);	
	
	//scroll top
	$("a[href='#top']").on("click", function() {
		$("html, body").animate({scrollTop: 0}, 1200, 'easeInOutQuint');
		return false;
	});
	
	//reply scroll
	$(".comment .author-box .read-more").on("click", function(event){
		event.preventDefault();
		var offset = $("#comment-form").offset();
		$("html, body").animate({scrollTop: offset.top-90}, 400);
		$("#cancel-comment").css('display', 'inline');
	});
	
	//cancel comment button
	$("#cancel-comment").on("click", function(event){
		event.preventDefault();
		$(this).css('display', 'none');
	});
	
	//fancybox
	$(".prettyPhoto").prettyPhoto({
		show_title: false,
		slideshow: 3000,
		overlay_gallery: true,
		social_tools: ''
	});
	$("[rel^='prettyPhoto']").prettyPhoto({
		show_title: false,
		slideshow: 3000,
		overlay_gallery: true,
		social_tools: ''
	});
	
	$(".submit-comment-form").on("click", function(event){
		event.preventDefault();
		$("#comment-form").submit();
	});
	
	$("[data-plan]").on("click", function(event){
		event.preventDefault();
		var self = $(this);
		$("[data-plan]").removeClass("selected");
		if($(self.attr("href") + ' form [name="plan"]').length)
		{
			$(self.attr("href") + ' form [name="plan"]').val(self.data("plan"));
		}
		self.addClass("selected");
		if(self.attr("href").length)
		{
			$(self.attr("href")).slideDown(200, function()
			{
				$("html, body").animate({scrollTop: $(self.attr("href")).offset().top-120}, 400);
			});
		}
	});
	
	$(".cost-calculator-submit-form").on("click", function(event){
		event.preventDefault();
		$(this).closest(".cost-calculator-form").submit();
	});
	
	//cost calculator form
	if($("form.cost-calculator-container").length)
	{
		$("form.cost-calculator-container").each(function(){
			$(this)[0].reset();
			$(this).find("input[type='hidden']").each(function(){
				if(typeof($(this).data("default"))!="undefined")
					$(this).val($(this).data("default"));
			});
			$(this).find(".cost-calculator-price").costCalculator("calculate");
		});
		$("form.cost-calculator-container .more-submit").on("click", function(event){
			event.preventDefault();
			$(this).closest("form.cost-calculator-container").submit();
		});
	}
	$(".prevent-submit").on("submit", function(event){
		event.preventDefault();
		return false;
	});
	//contact form
	if($(".contact-form").length)
	{
		$(".contact-form").each(function(){
			$(this)[0].reset();
			$(this).find("input[type='hidden']").each(function(){
				if(typeof($(this).data("default"))!="undefined")
					$(this).val($(this).data("default"));
			});
			$(this).find(".cost-calculator-price").costCalculator("calculate");
		});
		$(".submit-contact-form").on("click", function(event){
			event.preventDefault();
			$(this).closest(".contact-form").submit();
		});
	}
	$(".contact-form").on("submit", function(event){
		event.preventDefault();
		var data = $(this).serializeArray();
		var self = $(this);
		var id = $(this).attr("id");
		//if($(this).find(".total-cost").length)
		//	data.push({name: 'total-cost', value: $(this).find(".total-cost").val()});
		if(parseInt($("#"+id+" [name='name']").data("required"), 10))
			data.push({name: 'name_required', value: 1});
		if(parseInt($("#"+id+" [name='email']").data("required"), 10))
			data.push({name: 'email_required', value: 1});
		if(parseInt($("#"+id+" [name='phone']").data("required"), 10))
			data.push({name: 'phone_required', value: 1});
		if(parseInt($("#"+id+" [name='message']").data("required"), 10))
			data.push({name: 'message_required', value: 1});
		if(parseInt($("#"+id+" [name='subject']").data("required"), 10))
			data.push({name: 'subject_required', value: 1});
		if(typeof(self.data("append"))!="undefined" && $("#" + self.data("append")).length)
		{
			var calculationData = $("#" + self.data("append")).serializeArrayAll();
			$.each(calculationData, function(index, object) {
				if(object["name"]!="")
				{
					data.push(object);
				}
			});
		}
		self.find(".block").block({
			message: false,
			overlayCSS: {
				opacity:'0.3',
				"backgroundColor": "#FFF"
			}
		});
		
		$.ajax({
			url: self.attr("action"),
			data: data,
			type: "post",
			dataType: "json",
			success: function(json){
				self.find(".submit-contact-form, [name='submit'], [name='name'], [name='email'], [name='phone'], [name='subject'], [name='message']").qtip('destroy');
				if(typeof(json.isOk)!="undefined" && json.isOk)
				{
					if(typeof(json.submit_message)!="undefined" && json.submit_message!="")
					{
						$("#"+id+" .submit-contact-form").qtip(
						{
							style: {
								classes: 'ui-tooltip-success'
							},
							content: { 
								text: json.submit_message 
							},
							hide: false,
							position: { 
								my: "right center",
								at: "left center" 
							}
						}).qtip('show');
						setTimeout(function(){
							$("#"+id+" .submit-contact-form").qtip("api").hide();
						}, 5000);
						self[0].reset();
						self.find(".cost-slider-input").trigger("change");
						self.find(".cost-dropdown").selectmenu("refresh");
						self.find("input[type='text'], textarea").trigger("focus").trigger("blur");
						if(typeof(self.data("append"))!="undefined" && $("#" + self.data("append")).length)
						{
							$("#" + self.data("append"))[0].reset();
							$("#" + self.data("append") + " [data-plan]").removeClass("selected");
							$("#" + self.data("append") + " .cost-slider-input").trigger("change");
							$("#" + self.data("append") + " .cost-dropdown").selectmenu("refresh");
							$("#" + self.data("append") + " input[type='text'], #" + self.data("append") + " textarea").trigger("focus").trigger("blur");
						}
					}
				}
				else
				{
					if(typeof(json.submit_message)!="undefined" && json.submit_message!="")
					{
						self.find(".submit-contact-form").qtip(
						{
							style: {
								classes: 'ui-tooltip-error'
							},
							content: { 
								text: json.submit_message 
							},
							position: { 
								my: "right center",
								at: "left center" 
							}
						}).qtip('show');
					}
					if(typeof(json.error_name)!="undefined" && json.error_name!="")
					{
						$("#"+id+" [name='name']").qtip(
						{
							style: {
								classes: 'ui-tooltip-error'
							},
							content: { 
								text: json.error_name 
							},
							position: { 
								my: "bottom center",
								at: "top center" 
							}
						}).qtip('show');
					}
					if(typeof(json.error_email)!="undefined" && json.error_email!="")
					{
						$("#"+id+" [name='email']").qtip(
						{
							style: {
								classes: 'ui-tooltip-error'
							},
							content: { 
								text: json.error_email 
							},
							position: { 
								my: "bottom center",
								at: "top center" 
							}
						}).qtip('show');
					}
					if(typeof(json.error_phone)!="undefined" && json.error_phone!="")
					{
						$("#"+id+" [name='phone']").qtip(
						{
							style: {
								classes: 'ui-tooltip-error'
							},
							content: { 
								text: json.error_phone 
							},
							position: { 
								my: "bottom center",
								at: "top center" 
							}
						}).qtip('show');
					}
					if(typeof(json.error_subject)!="undefined" && json.error_subject!="")
					{
						if($("#"+id+" [name='subject']").is("select"))
						{
							$("#"+id+" #" + $("#"+id+" [name='subject']").attr("id") + "-button").qtip(
							{
								style: {
									classes: 'ui-tooltip-error'
								},
								content: { 
									text: json.error_subject 
								},
								position: { 
									my: "bottom center",
									at: "top center" 
								}
							}).qtip('show');
						}
						else
						{
							$("#"+id+" [name='subject']").qtip(
							{
								style: {
									classes: 'ui-tooltip-error'
								},
								content: { 
									text: json.error_subject 
								},
								position: { 
									my: "bottom center",
									at: "top center" 
								}
							}).qtip('show');
						}
					}
					if(typeof(json.error_message)!="undefined" && json.error_message!="")
					{
						$("#"+id+" [name='message']").qtip(
						{
							style: {
								classes: 'ui-tooltip-error'
							},
							content: { 
								text: json.error_message 
							},
							position: { 
								my: "bottom center",
								at: "top center" 
							}
						}).qtip('show');
					}
				}
				self.find(".block").unblock();
			}
		});
	});
	$(".flex-box .column-1-2 .ui-selectmenu-button").each(function(){
		$(this).css("max-width", $(this).parent().parent().width()/2);
	});

	if($(".header-container").hasClass("sticky"))
	{
		menu_position = $(".header-container").offset().top;
		$(".header-container.sticky").after($(".header-container.sticky").clone().attr("id", "fp-sticky-clone"));
	}
	function animateElements()
	{
		$('.animated-element, .header-container.sticky:not("#fp-sticky-clone"), .fp-smart-column, .has-counter-box-path').each(function(){
			var elementPos = $(this).offset().top;
			var topOfWindow = $(window).scrollTop();
			var animationStart = (typeof($(this).data("animation-start"))!="undefined" ? parseInt($(this).data("animation-start"), 10) : 0);
			if($(this).hasClass("fp-smart-column"))
			{
				var row = $(this).parent();
				var wrapper = $(this).children().first();
				var childrenHeight = 0;
				wrapper.children().each(function(){
					childrenHeight += $(this).outerHeight(true);
				});
				if(childrenHeight<$(window).height() && row.offset().top-20<topOfWindow && row.offset().top-20+row.outerHeight()-childrenHeight>topOfWindow)
				{
					wrapper.css({"position": "fixed", "bottom": "auto", "top": "20px", "width": $(this).width() + "px"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight<$(window).height() && row.offset().top-20+row.outerHeight()-childrenHeight<=topOfWindow && (row.outerHeight()-childrenHeight>0))
				{
					wrapper.css({"position": "absolute", "bottom": "0", "top": (row.outerHeight()-childrenHeight) + "px", "width": "auto"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight>=$(window).height() && row.offset().top+20+childrenHeight<topOfWindow+$(window).height() && row.offset().top+20+row.outerHeight()>topOfWindow+$(window).height())
				{	
					wrapper.css({"position": "fixed", "bottom": "20px", "top": "auto", "width": $(this).width() + "px"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else if(childrenHeight>=$(window).height() && row.offset().top+20+row.outerHeight()<=topOfWindow+$(window).height() && (row.outerHeight()-childrenHeight>0))
				{
					wrapper.css({"position": "absolute", "bottom": "0", "top": (row.outerHeight()-childrenHeight) + "px", "width": "auto"});
					$(this).css({"height": childrenHeight+"px"});
				}
				else
					wrapper.css({"position": "static", "bottom": "auto", "top": "auto", "width": "auto"});
			}
			else if($(this).hasClass("sticky"))
			{
				if(menu_position!=null && $(".header-container .sf-menu").is(":visible"))
				{
					if($(".transparent-header-container").length)
						modificator = 7;
					if(menu_position+modificator<topOfWindow)
					{
						if(!$("#fp-sticky-clone").hasClass("move"))
						{
							$("#fp-sticky-clone").addClass("move");
							if($(".transparent-header-container").length)
							{
								$(this).css("visibility", "hidden");
								setTimeout(function(){
									if($("#fp-sticky-clone").hasClass("move"))
										$("#fp-sticky-clone").addClass("disable-transition");
								}, 300);
							}
							else
								$(".header-container").addClass("transition");
							$(".template-big-search").off("click");
							$(".template-big-search").on("click", function(event){
								event.preventDefault();
								$(this).parent().children(".search").toggle();
							});
						}
					}
					else
					{
						$("#fp-sticky-clone").removeClass("move");
						if($(".transparent-header-container").length)
						{
							$(this).css("visibility", "visible");
							$("#fp-sticky-clone").removeClass("disable-transition");
						}
						else
							$(".header-container").removeClass("transition");
					}
				}
			}
			else if(elementPos<topOfWindow+$(window).height()-20-animationStart) 
			{
				if($(this).hasClass("number") && !$(this).hasClass("progress") && $(this).is(":visible"))
				{
					var self = $(this);
					self.addClass("progress");
					if(typeof(self.data("value"))!="undefined")
					{
						var value = parseFloat(self.data("value").toString().replace(" ",""));
						self.text(0);
						self.text(value);
					}
				}
				else if($(this).hasClass("bar") && !$(this).hasClass("progress") && $(this).is(":visible"))
				{
					var self = $(this);
					self.addClass("progress");
					if(typeof(self.data("steps"))!="undefined")
					{
						self.parent().parent().css("width", (parseInt(self.data("step"), 10)/parseInt(self.data("steps"), 10)*100)+"%");
						self.css("left", 100/parseInt(self.data("step"), 10)*(parseInt(self.data("step"), 10)-1) + "%");
						self.css("width", (100/parseInt(self.data("step"), 10)) + "%");
					}
					else if(typeof(self.data("percentage-value"))!="undefined")
					{
						self.css("width", parseFloat(self.data("percentage-value")) + "%");
					}
					setTimeout(function(){
						self.prev().css("opacity", 1);
					}, 200);
				}
				else if(($(this).hasClass("counter-box-path") || (isSafari && $(this).hasClass("has-counter-box-path"))) && !$(this).hasClass("progress") && $(this).is(":visible"))
				{
					var self = (isSafari ? $(this).children("svg").children().first() : $(this));
					self.addClass("progress");
					var dashoffset = self.data("dashoffset");
					var duration = (typeof(self.data("duration"))!="undefined" ? self.data("duration") : 2000);
					self.animate({
						"stroke-dashoffset": dashoffset
					}, duration, "easeInOutQuad");
				}
				else if(!$(this).hasClass("progress") && !$(this).hasClass("has-counter-box-path"))
				{
					var elementClasses = $(this).attr('class').split(' ');
					var animation = "fadeIn";
					var duration = 600;
					var delay = 0;
					if($(this).hasClass("scroll-top"))
					{
						var height = ($(window).height()>$(document).height()/2 ? $(window).height()/2 : $(document).height()/2);
						if(topOfWindow+80<height)
						{
							if($(this).hasClass("fadeIn") || $(this).hasClass("fadeOut"))
								animation = "fadeOut";
							else
								animation = "";
							$(this).removeClass("fadeIn")
						}
						else
							$(this).removeClass("fadeOut")
					}
					for(var i=0; i<elementClasses.length; i++)
					{
						if(elementClasses[i].indexOf('animation-')!=-1)
							animation = elementClasses[i].replace('animation-', '');
						if(elementClasses[i].indexOf('duration-')!=-1)
							duration = elementClasses[i].replace('duration-', '');
						if(elementClasses[i].indexOf('delay-')!=-1)
							delay = elementClasses[i].replace('delay-', '');
					}
					$(this).addClass(animation);
					$(this).css({"animation-duration": duration + "ms"});
					$(this).css({"animation-delay": delay + "ms"});
					$(this).css({"transition-delay": delay + "ms"});
				}
			}
		});
	}
	setTimeout(animateElements, 100);
	$(window).scroll(animateElements);
	if(isSafari)
	{
		var observer = new MutationObserver(function(mutations){
			mutations.forEach(function(mutationRecord){
				var intervalCounter = 0;
				var progressBarInterval = setInterval(function(){
					$(mutationRecord.target).next().css("max-width", (100+intervalCounter) + "%");
					intervalCounter++;
					if(intervalCounter>1500)
					{
						clearInterval(progressBarInterval);
						$(mutationRecord.target).next().css("max-width", "none");
					}
				}, 1);
			});    
		});
		$(".progress-bar .bar").each(function(){
			var target = $(this)[0];
			observer.observe(target, {attributes: true, attributeFilter: ['style']});
		});
	}
});