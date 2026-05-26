var h=require('http');
h.get('http://localhost:3000/',function(r){
  var d='';
  r.on('data',function(c){d+=c});
  r.on('end',function(){
    var cssMatch=d.match(/href="([^"]+\.css)"/);
    var jsMatch=d.match(/src="([^"]+\.js)"/);
    console.log('CSS ref:', cssMatch ? cssMatch[1] : 'NONE');
    console.log('JS ref:', jsMatch ? jsMatch[1] : 'NONE');
    if(cssMatch){
      h.get('http://localhost:3000'+cssMatch[1],function(r2){
        console.log('CSS status:', r2.statusCode, 'size:', r2.headers['content-length']);
      });
    }
    if(jsMatch){
      h.get('http://localhost:3000'+jsMatch[1],function(r3){
        var buf='';
        r3.on('data',function(c){buf+=c});
        r3.on('end',function(){
          console.log('JS status:', r3.statusCode, 'size:', buf.length);
        });
      });
    }
  });
});
