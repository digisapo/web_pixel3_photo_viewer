# web_pixel3_photo_viewer
A viewer web-app for Google Pixel3 Motion Photo jpeg files. You can view short looped video of motion photo jpeg files taken by Pixel 3 by dropping jpeg files on FF or Chrome browser on PC/Mac. Not only motion photos, the application accepts any images or mp4 videos.

### 【内容】

Google Pixel3 のカメラで撮影したファイルをPCローカルで閲覧するためのブラウザアプリ。

### 【機能】

Google Pixel3 の撮影したモーションフォトは Google フォトのクラウドにあれば PC のブラウザでもムービーとして閲覧できるが、USB 経由などで PC に吸い出すとスチールイメージとしてしか見れない(Googleフォトから MP4 やアニメーションGIFにエクスポートはできる)。このブラウザアプリにモーションフォトjpgファイルをドロップすると、カーソルをマウスオーバーすることでムービー部分をループ再生する。クリックして選択すると MP4 ファイルとしてエクスポート出来る(手ぶれ補正は無い)。またモーションフォトだけでなく各種画像フォーマットおよび MP4 動画ファイルを表示できる簡易ビュワーとして機能する。ファイル名に pano_ のプレフィックスがある場合は A-Frame による WebVR 表示が可能。

### 【注意点】

FF と Chrome で動作確認済みだが IE11 は一部のモーションフォトが読み込めない。Chrome では大量のファイルをドロップされた場合にメモリ不足で終了する場合があるため、デフォルトでは 50MB 以上のサイズのファイルは読み込まない(設定で変更できる)。

モーションフォトの MP4 エクスポートは、Jpeg の EOI 以降のバイナリを切り出してファイルにするだけの機能であるが、この際にマルチトラック MP4 ファイルとして出力される場合が多い。これは Google Pixel3 のモーションフォトの仕様によるものと考えられる。

### 【外部リンク】

ブログ記事: https://plaza14.biz/sitio_digisapo/digimono/20190224-google-pixel3-motion-photo-viewer/

### - LICENSE -

Copyright (c) 2019 DigiSapo.
This software is released under the MIT License.


