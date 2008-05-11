var FFFFOUND = {
	URL : 'http://FFFFOUND.com/',
	
	getToken : function(){
		return doXHR(FFFFOUND.URL + 'bookmarklet.js').addCallback(function(res){
			return res.responseText.match(/token='(.*?)'/)[1];
		});
	},
	
	post : function(ps){
		return this.getToken().addCallback(function(token){
			return doXHR(FFFFOUND.URL + 'add_asset', {
				method : 'GET',
				referrer : ps.href,
				queryString : {
					token   : token,
					url     : ps.source,
					referer : ps.href,
					title   : ps.title,
				},
			}).addCallback(function(res){
				if(res.responseText.match('(FAILED:|ERROR:) (.*?)</span>'))
					throw RegExp.$2;
				
				if(res.responseText.match('login'))
					throw 'AUTH_FAILD';
			});
		});
	},
	
	remove : function(id){
		// 200 {"success":false}
		return doXHR(FFFFOUND.URL + 'gateway/in/api/remove_asset', {
			method : 'POST',
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : id,
			},
		});
	},
	
	iLoveThis : function(id){
		return doXHR(FFFFOUND.URL + 'gateway/in/api/add_asset', {
			method : 'POST',
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : 'i'+id,
				inappropriate : false,
			},
		}).addCallback(function(res){
			// NOT_FOUND / EXISTS / AUTH_FAILD
			if(res.responseText.match(/"error":"(.*?)"/))
				throw RegExp.$1;
		});
	},
}

var Amazon = {
	getItem : function(asin){
		return doXHR('http://webservices.amazon.co.jp/onca/xml', {
			queryString : {
				Service        : 'AWSECommerceService',
				SubscriptionId : '0DCQFXHRBNT9GN9Z64R2',
				Operation      : 'ItemLookup',
				ResponseGroup  : 'Small,Images',
				ItemId         : asin,
			},
		}).addCallback(function(res){
			var xml = convertToXML(res.responseText);
			if(xml.Error.length())
				throw res;
			
			return new Amazon.Item(xml.Items.Item);
		});
	},
	
	normalizeUrl : function(asin){
		return  'http://amazon.co.jp/o/ASIN/' + asin + 
			(this.affiliateId ? '/' + this.affiliateId + '/ref=nosim' : '');
	},
	
	get affiliateId(){
		return getPref('amazonAffiliateId');
	},
	
	Item : function(item){
		return {
			get title(){
				return ''+item.ItemAttributes.Title;
			},
			get creators(){
				var creators = [];
				
				// '原著'以外
				for each(var creator in item.ItemAttributes.Creator.(@Role != '\u539F\u8457'))
					creators.push(''+creator);
				return creators;
			},
			get largestImage(){
				return this.largeImage || this.mediumImage || this.smallImage;
			},
			get largeImage(){
				return new Amazon.Image(item.LargeImage);
			},
			get mediumImage(){
				return new Amazon.Image(item.MediumImage);
			},
			get smallImage(){
				return new Amazon.Image(item.SmallImage);
			},
		}
	},
	
	Image : function(img){
		if(!img.length())
			return;
		
		return {
			get size(){
				return (''+img.name()).slice(0, -5).toLowerCase();
			},
			get url(){
				return ''+img.URL;
			},
			get width(){
				return 1*img.Width;
			},
			get height(){
				return 1*img.Height;
			},
		}
	},
}

var Flickr = {
	callMethod : function(params){
		return doXHR('http://flickr.com/services/rest/', {
			queryString : update({
				api_key        : 'ecf21e55123e4b31afa8dd344def5cc5',
				nojsoncallback : 1,
				format         : 'json',
			}, params),
		}).addCallback(function(res){
			eval('var json=' + res.responseText);
			if(json.stat!='ok')
				throw json.message;
			return json;
		});
	},
	callAuthMethod : function(params){
		return this.getToken(params.photo_id).addCallback(function(page){
			params = update(update({
				nojsoncallback : 1,
				format         : 'json',
				src            : 'js',
				cb             : new Date().getTime(),
			}, page.token), params);
			params.api_sig = (page.secret + keys(params).sort().map(function(key){
				return key + params[key]
			}).join('')).md5();
			
			return doXHR('http://flickr.com/services/rest/', {
				sendContent : params,
			});
		}).addCallback(function(res){
			eval('var json=' + res.responseText);
			if(json.stat!='ok')
				throw json.message;
			return json;
		});
	},
	getToken : function(id){
		return this.getInfo(id).addCallback(function(photo){
			return doXHR(photo.urls.url[0]._content);
		}).addCallback(function(res){
			var html = res.responseText;
			return {
				secret : html.extract(/global_flickr_secret[ =]+'(.*?)'/),
				token  : {
					api_key    : html.extract(/global_magisterLudi[ =]+'(.*?)'/),
					auth_hash  : html.extract(/global_auth_hash[ =]+'(.*?)'/),
					auth_token : html.extract(/global_auth_token[ =]+'(.*?)'/),
				},
			};
		});
	},
	addFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.add',
			photo_id : id,
		});
	},
	removeFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.remove',
			photo_id : id,
		});
	},
	getSizes : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getSizes',
			photo_id : id,
		}).addCallback(function(json){
			return json.sizes.size;
		});
	},
	getInfo : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getInfo',
			photo_id : id,
		}).addCallback(function(json){
			return json.photo;
		});
	},
}

var WeHeartIt = {
	URL : 'http://weheartit.com/',
	
	post : function(ps){
		return doXHR(WeHeartIt.URL + 'add.php', {
			method : 'GET',
			referrer : ps.clickThrough,
			queryString : {
				title : ps.title,
				via : ps.clickThrough,
				img : ps.source,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw 'AUTH_FAILD';
		});
	},
	
	iHeartIt : function(id){
		return doXHR(WeHeartIt.URL + 'inc_heartedby.php', {
			method : 'GET',
			referrer : ps.clickThrough,
			queryString : {
				do : 'heart',
				entry : id,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw 'AUTH_FAILD';
		});
	},
}

var HatenaBookmark = {
	POST_URL : 'http://b.hatena.ne.jp/add',
	
	getToken : function(){
		return doXHR(HatenaBookmark.POST_URL).addCallback(function(res){
			if(res.responseText.match(/Hatena\.rkm\s*=\s*['"](.+?)['"]/) )
				return RegExp.$1;
			
			throw 'AUTH_FAILD';
		});
	},
	post : function(ps){
		return HatenaBookmark.getToken().addCallback(function(token){
			var content = {
				mode    : 'enter',
				rkm     : token,
				url     : ps.source,
				comment : ps.body,
			};
			if(ps.title)
				content.title = ps.title;
			return doXHR(HatenaBookmark.POST_URL, {
				sendContent : content,
			});
		});
	},
}

// copied from http://userscripts.org/scripts/show/19741
var GoogleWebHistory = {
	getCh : function(url){
		function r(x,y){
			return Math.floor((x/y-Math.floor(x/y))*y+.1);
		}
		function m(c){
			var i,j,s=[13,8,13,12,16,5,3,10,15];
			for(i=0;i<9;i+=1){
				j=c[r(i+2,3)];
				c[r(i,3)]=(c[r(i,3)]-c[r(i+1,3)]-j)^(r(i,3)==1?j<<s[i]:j>>>s[i]);
			}
		}
		
		url='info:'+url;
		
		var c = [0x9E3779B9,0x9E3779B9,0xE6359A60],i,j,k=0,l,f=Math.floor;
		for(l=url.length ; l>=12 ; l-=12){
			for(i=0 ; i<16 ; i+=1){
				j=k+i;c[f(i/4)]+=url.charCodeAt(j)<<(r(j,4)*8);
			}
			m(c);
			k+=12;
		}
		c[2]+=url.length;
		for(i=l;i>0;i--)
			c[f((i-1)/4)]+=url.charCodeAt(k+i-1)<<(r(i-1,4)+(i>8?1:0))*8;
		m(c);
		return'6'+c[2];
	},
	post : function(url){
		return doXHR('http://www.google.com/search?client=navclient-auto&ch=' + GoogleWebHistory.getCh(url) + '&features=Rank&q=info:' + escape(url));
	},
}