/*
 * Google Pixel3 Motion Jpeg file viewer ECMAScript implementation.
 *
 * Copyright (c) 2019 DigiSapo(http://www.plaza14.biz/sitio_digisapo/)
 * This software is released under the MIT License:
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

var Const = {
	MAX_FILE_SIZE_INIT: 50*1024*1024,	// 50MB
	LOADING_INTERVAL_MAX: 2000,			// 2[sec]
	LOADING_INTERVAL_MIN: 100,			// 1/10[sec]
};

//-------------------------------------------------------------------
//	The predicate function for find the mp4 header in a Uint8Array.
//-------------------------------------------------------------------
function ckMp4HeaderInMVIMG(elem, i, ar) {
	if (i < 134 || i+14 > ar.length) return false;
	if (ar[i-2] == 0xFF && ar[i-1] == 0xD9	// Jpeg EOI
				// Upper 3 bytes of BOX length == 0
				&& ar[i] == 0 && ar[i+1] == 0 && ar[i+2] == 0
				// Signature 'ftyp'
				&& ar[i+4] == 0x66 && ar[i+5] == 0x74 && ar[i+6] == 0x79 && ar[i+7] == 0x70) {
		if (i+ar[i+3] > ar.length) return false; // An odd BOX length
		console.log('-- Found mp4 --');
		var major_brand = String.fromCharCode(ar[i+8], ar[i+9], ar[i+10], ar[i+11]);
		console.log('major_brand: '+major_brand);
		var minor_version = ar[i+12] + (ar[i+13]<<8) + (ar[i+14]<<16) + (ar[i+15]<<24);
		console.log('minor_version: '+minor_version);
//		compatible_brands[]
		return true;
	}
};

//-------------------------------------------------------------------
//	Initializing of page.
//  (Virtually this is the main program)
//-------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {

	var viewerFrame = document.getElementById('viewer-frame');
	var fileSelector = document.getElementById('file-selector');
	var exportMenu = document.getElementById('export-menu');
	var inputMaxFileSize = document.getElementById('max-file-size');
	
	//-----------------------------------------------
	//	Viewer item object holder class.
	//-----------------------------------------------
	
	var vwr = {
		
		items: [],
		fileEntries: null,
		
		maxFileSize: 0,
		ckMaxFileSize: function(sz) { return this.maxFileSize ? sz > this.maxFileSize : false; },
		
		//
		// Handling select/unselect item.
		//
		selectedItem: null,
		select: function(item) {
			this.unselect();
			if (item.select()) {
				this.selectedItem = item;
				this._showExportMenu(item);
			}
		},
		unselect: function() {
			if (this.selectedItem != null) {
				this.selectedItem.unselect();
				this.selectedItem = null;
				this._hideExportMenu();
			}
		},
		_showExportMenu: function(item) {
			if (item != null && item.oURL != null && item.mvimg) {
				exportMenu.style.display = 'block';
				// Generating download blob.
				var xbtn = document.getElementById("export-button");
				var fnameMp4 = ( (item.file.name).replace(/\.jpg$|\.jpeg$/gi, '') )+'.mp4';
				xbtn.textContent = 'Save as file: '+fnameMp4;
				xbtn.href = item.oURL;
				xbtn.download = fnameMp4;
			} else {
				exportMenu.style.display = 'none';
			}
		},
		_hideExportMenu: function() {
			exportMenu.style.display = 'none';
		},
		
		//
		// Initialize viewer-frame dom.
		//
		clearFrame: function() {
			clearTimeout(this.ckTOTimer);
			this.unselect();
			this.items.forEach(function(item){
				if (item.oURL != null) {
					URL.revokeObjectURL(item.oURL);
					item.oURL = null;
				}
				item.mp4 = null;
				item.dom = null;
			});
			this.items = [];
			viewerFrame.innerHTML = '';
		},
		
		//
		// Add new one.
		//
		newOne: function(file, on_success) {
			var self = this;
			
			// Viewer item class.
			//
			var item = {
				dom: null,
				file: null,
				folderEntries: null,
				oURL: null,
				mp4: null,
				mvimg: false,
				panorama: false,
				onSuccess: on_success,
				videoPlayer: null,
				ckMimeIsJpeg: function() {
					return ( this.file && ( this.file.type.toLowerCase() == 'image/jpeg' || this.file.name.match(/\.jpg$|\.jpeg$/gi) != null ) );
				},
				ckMimeIsMp4: function() {
					return ( this.file && ( this.file.type.toLowerCase() == 'video/mp4' || this.file.name.match(/\.(mp4)$/gi) != null ) );
				},
				getMime: function() {
					if (this.file.type) return this.file.type;
					if (this.ckMimeIsJpeg()) return 'image/jpeg';
					else if (this.ckMimeIsMp4()) return 'vide/mp4';
					return '';
				},
				isSelected: function() {
					return (this == self.selectedItem);
				},
				select: function() {
					if (!this.oURL) return false;
					if (this.panorama) {
						showPanorama360(this);
						return false;
					}
					this.dom.style.background = ( this.mvimg ? '#48f' : '#ffc' );
					this.activate();
					return true;
				},
				unselect: function() {
					this.dom.style.background = '#fff';
					this.inactivate();
				},
				activate: function() {
					if (this.videoPlayer && this.videoPlayer.paused) {
						this.videoPlayer.play();
					}
				},
				inactivate: function() {
					if (this.videoPlayer && !this.videoPlayer.paused) {
						this.videoPlayer.pause();
					}
				},
				addItemTag: function(tagText, bgColor) {
					var fnameTag = document.createElement('div');
					fnameTag.innerHTML = tagText;
					fnameTag.style.position = 'absolute';
					fnameTag.style.width = (this.dom.clientWidth-14)+'px';
					fnameTag.style.top = this.dom.clientHeight+'px';
					fnameTag.style.left = '-1px';
					fnameTag.style.background = bgColor;
					fnameTag.style.color = '#fff';
					fnameTag.style.padding = '0 0.5em';
					this.dom.appendChild(fnameTag);
				},
				onMouseEnter: function(evt) {
					this.activate();
				},
				onMouseLeave: function(evt) {
					if (!this.isSelected()) this.inactivate();
				},
				onMouseDown: function(evt) {
				},
				onMouseUp: function(evt) {
					if (self.selectedItem == this) {
						self.unselect(this);
					} else {
						self.select(this);
					}
				},
			};
			this.items.push(item);
			
			// Making a div element.
			item.dom = document.createElement('div');
			item.dom.className = 'viewer-item';
			item.dom.addEventListener('mouseenter', function(evt){ item.onMouseEnter(evt); }, false);
			item.dom.addEventListener('mouseleave', function(evt){ item.onMouseLeave(evt); }, false);
			item.dom.addEventListener('mousedown', function(evt){ evt.stopPropagation(); item.onMouseDown(evt); }, false);
			item.dom.addEventListener('mouseup', function(evt){ evt.stopPropagation(); item.onMouseUp(evt); }, false);
			viewerFrame.appendChild(item.dom);
			
			if (!file) return item;
			
			item.file = file;
//			if (!item.ckMimeIsMp4() && file.size > Const.MAX_FILE_SIZE) {
			if (this.ckMaxFileSize(file.size)) {
				// Show file size text only when recieved huge size file.
				item.dom.innerHTML = '<div class="viewer-item-img" style="padding: 2em">'+'FILE SIZE: '+file.size+' bytes.</div>';
				item.addItemTag(file.name, '#aaa');
				return item;
			}
			// Sets loading message
			item.dom.innerHTML = '<div class="viewer-item-img" style="padding: 2em">loading...<br/>'+file.name+'</div>';
			
			// Loading process
			var reader = new FileReader();
			reader.onload = function(evt) {
				self.decode(item, new Uint8Array(reader.result));
			}
			reader.readAsArrayBuffer(file);
			return item;
		},
		
		decode: function(item, bin) {
			
			item.mp4 = null;
			item.mvimg = false;
			/* TypedArray.prototype.findIndex() is not supported in IE11. */
//			var mp4Index = bin.findIndex(ckMp4HeaderInMVIMG);
			var mp4Index = 0, len = bin.length;
			if (!item.ckMimeIsMp4()) {
				for (; mp4Index < len; mp4Index++) {
					if (ckMp4HeaderInMVIMG(bin[mp4Index], mp4Index, bin)) break;
				}
			}
			if (mp4Index >= len) {
				//
				// Generating still image...
				//
				var img = new Image();
				item.oURL = URL.createObjectURL(new Blob([bin], { type: item.getMime() }));
				img.onload = function() {
					item.panorama = item.file.name.match(/pano_\d{8}_\d{6}/i) != null;
					if (!item.panorama) {
						// Release url object resource.
						URL.revokeObjectURL(item.oURL);
						item.oURL = null;
					}
					if (item.dom) {
						item.dom.innerHTML = '';
						// Sets css-class
						img.className = 'viewer-item-img';
						/* When the onload event fires, the size of the image may not be determined,
						 * depending on the browser...(say it clearly, it occurs in the IE)
						 * So, i solved the issue by slightly delaying the resizing process...
						 * Ref: https://stackoverflow.com/questions/25091589/image-onload-function-not-working-in-internet-explorer
						 */
						setTimeout(function(){
							if (item.dom) {
								// Fitting the image size.
								var w = (item.dom.clientWidth-16);
								var h = (w*img.height)/img.width;
								item.dom.style.height = (h+16)+'px';
								img.width = w;
								img.height = h;
								item.dom.appendChild(img);
								item.addItemTag(item.file.name, '#888');
								if (item.onSuccess) item.onSuccess(item);
							}
						},100);
					}
				}
				img.src = item.oURL;
				
			} else {
				//
				// Generating mp4 movie...
				//
				item.mp4 = new Uint8Array(bin.buffer, mp4Index);
				var vid = document.createElement('video');
				vid.preload = 'auto';
				vid.muted = true;
				vid.autoplay = false;
				vid.loop = true;
				item.mvimg = ( mp4Index > 0 );
				item.oURL = URL.createObjectURL(new Blob([item.mp4], { type: 'video/mp4' }));
				vid.onloadedmetadata = function() {
					// Do NOT release url object resource when looping movie playback.
					// Ref: https://stackoverflow.com/questions/45724195/detect-404-on-video-blobhttps-source
//					URL.revokeObjectURL(item.oURL);
					if (item.dom) {
						item.dom.innerHTML = '';
						// Sets css-class
						vid.className = 'viewer-item-img';
						// Fitting the video size.
						var w = (item.dom.clientWidth-16);
						var h = (w*vid.videoHeight)/vid.videoWidth;
						item.dom.style.height = (h+16)+'px';
						vid.width = w;
						vid.height = h;
						item.dom.appendChild(vid);
						item.videoPlayer = vid;
						item.addItemTag(item.file.name, ( mp4Index > 0 ? '#c8c' : '#a88' ));
						if (item.onSuccess) item.onSuccess(item);
					}
				};
				vid.src = item.oURL;
				
			}
		},
		
		//
		// Add new directory.
		//
		newDirectory: function(ent) {
			var self = this;
			
			var item = this.newOne(null);
			item.dom.innerHTML = '<img class="viewer-item-img" src="./assets/folder-icon.png">';
			var w = (item.dom.clientWidth-16);
			var h = (w*300)/400;
			item.dom.style.height = (h+16)+'px';
			item.addItemTag('&lsaquo;'+ent.name+'&rsaquo; ', '#8c8');
			// Reading entries...
			item.folderEntries = [];
			var reader = ent.createReader();
			function readEntries() {
				reader.readEntries(
					function(results) {
						if (results && results.length > 0) {
							item.folderEntries = item.folderEntries.concat(results);
							readEntries();
						} else {
							item.onMouseDown = function(evt) {
								item.dom.style.background = '#ffc';
							}
							item.onMouseUp = function(evt) {
								self.enterSubDirectory(item.folderEntries);
							}
						}
					},
					function(err) {
						console.log('failed to read directory '+ent.name);
					});
			};
			readEntries();
		},
		
		//
		// Enter sub directory
		//
		enterSubDirectory: function(newEntries) {
			if (newEntries) {
				this.fileEntries.stack.push(this.fileEntries.current);
				this._openDirectory(newEntries);
			}
		},
		
		_backToParentDirectory: function() {
			this._openDirectory(this.fileEntries.stack.pop());
		},
		
		_addBackButton: function() {
			var self = this;
			var item = this.newOne(null);
			item.dom.innerHTML = '<img class="viewer-item-img" src="./assets/back-btn.png">';
			item.dom.style.border = 'none';
			item.onMouseDown = function(evt) {
				item.dom.style.background = '#ffc';
			}
			item.onMouseUp = function(evt) {
				self._backToParentDirectory();
			}
			var w = (item.dom.clientWidth-16);
			var h = (w*300)/400;
			item.dom.style.height = (h+16)+'px';
		},
		
		_openDirectory: function(newEntries) {
			var self = this;
			
			if (!newEntries) return false;
			this.fileEntries.current = newEntries;
			this.clearFrame();
			
			// add back button.
			if (this.fileEntries.stack.length > 0) {
				this._addBackButton();
			}
			// Loading entries...
			//
			_loadEntriesWithInterval(newEntries, function(ent, on_success){
				if (ent.isDirectory) {
					self.newDirectory(ent);
					on_success();
				} else if (ent.isFile) {
					ent.file(function(file) {
						self.newOne(file, on_success);
					},
					function(err) {
						console.log('failed to read file '+file.name);
					});
				}
			});

			return true;
		},

	};

	//
	// Show panorama view using a-frame
	//
	var panoramaView = document.getElementById('panorama-view');
	var panoramaViewClose = document.getElementById('panorama-view-close');
	function showPanorama360(item) {
		panoramaView.style.visibility = 'visible';
		panoramaViewClose.onclick = function() {
			// close button
			panoramaView.style.visibility = 'hidden';
		}
		document.querySelector('a-sky').setAttribute('src', '#loading');
		/* Dynamically changing a skybox texture is a little bit tricky,
		 * and it does not seems to be documented in the official site of Mozilla A-Frame.
		 * Simply switching the 'src' property of the a-sky element works in FF, but does not in Chrome...
		 * So, i solved it with the following code that i found by some trials&errors... */
		var new_img = document.createElement('img');
		new_img.setAttribute('id', 'dynImg');
		new_img.setAttribute('src', item.oURL);
		document.querySelector('a-assets').appendChild(new_img);
		setTimeout(function(){
//			document.querySelector('a-sky').setAttribute('src', item.oURL);
			document.querySelector('a-sky').setAttribute('src', '#dynImg');
		},1000);
	}

	//
	// Loading multiple files.
	//
	function loadImageFiles(files, init_count) {
		var total_count = init_count;
		_loadEntriesWithInterval(files, function(file, on_success){
			if (file != undefined
					// Accepts image or mp4 video files only.
					&& (   file.type.indexOf('image/') >= 0
						|| file.type.indexOf('video/mp4') >= 0 ) ) {
				// Process one file.
				vwr.newOne(file, on_success);
				total_count++;
			}
		});
	}
	
	//
	// Set dropped file entries
	//
	function setFileEntries(items, init_count) {
		if (!items) return 0;
		var dir_count = init_count;
		var i = 0, count = items.length;
		vwr.fileEntries = { stack: [], current: [] };
		vwr.clearFrame();
		for (; i < count; i++) {
			var item = items[i];
			var ent = ( item.webkitGetAsEntry ? item.webkitGetAsEntry()
						: ( item.getAsEntry ? item.getAsEntry() : null ) );
			if (ent){
				vwr.fileEntries.current.push(ent);
				if (ent.isDirectory) {
					// Directory
					vwr.newDirectory(ent);
					dir_count++;
				}
			}
		}
		return dir_count;
	}
	
	function _loadEntriesWithInterval(entries, load_func) {
		var timer_interval = Const.LOADING_INTERVAL_MIN;
		var i = 0, count = entries.length;
		function _loadOne() {
			function _adjustTimerInterval(incr) {
				if (incr) {
					timer_interval += 100;
					if (timer_interval > Const.LOADING_INTERVAL_MAX) timer_interval = Const.LOADING_INTERVAL_MAX;
				} else {
					timer_interval -= 500;
					if (timer_interval < Const.LOADING_INTERVAL_MIN) timer_interval = Const.LOADING_INTERVAL_MIN;
				}
			}
			clearTimeout(self.ckTOTimer);
			var idx = i+1;
			load_func(entries[i], function(){_adjustTimerInterval(idx < i);});
			i++;
			if (i < count) self.ckTOTimer = setTimeout(_loadOne, timer_interval);
		}
		if (count > 0) _loadOne();
	}
	
	
	window.addEventListener("beforeunload", function (evt) {
		// Before leaving page, release all object url resources.
		vwr.clearFrame();
	}, false);

	//-----------------------------------------------
	//	Register event listeners on the viewer.
	//-----------------------------------------------

	viewerFrame.addEventListener('dragstart', function(evt) {
		evt.preventDefault();
		// Avoiding drag objects owned by the viewer itself.
		evt.dataTransfer.effectAllowed = 'none';
	});
	
	viewerFrame.addEventListener('dragover', function(evt) {
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy';
		viewerFrame.classList.add('dragover');
	});
	
	viewerFrame.addEventListener('dragleave', function() {
		viewerFrame.classList.remove('dragover');
	});
	
	viewerFrame.addEventListener('drop', function(evt) {
		evt.preventDefault();
		viewerFrame.classList.remove('dragover');
    	var dir_count = setFileEntries(evt.dataTransfer.items, 0);
    	loadImageFiles(evt.dataTransfer.files, dir_count);
	});
	
	fileSelector.addEventListener('change', function(evt) {
		vwr.clearFrame();
		loadImageFiles(evt.target.files, 0);
		// If you clear the value of the file selector, the evt.target.files object will be lost.
		// Therefore, when reading image synchronously, you can't clear the value.
//		fileSelector.value = '';
	});
	
	viewerFrame.addEventListener('mousedown', function(evt) {
		vwr.unselect();
	});
	
	vwr.maxFileSize = Const.MAX_FILE_SIZE_INIT;
	inputMaxFileSize.value = vwr.maxFileSize/(1024*1024);
	inputMaxFileSize.onchange = function changeMaxFileSize() {
		vwr.maxFileSize = this.value *1024*1024;
	}
});

