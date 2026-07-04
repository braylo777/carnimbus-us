document.addEventListener("DOMContentLoaded",function(){
  var cv=document.getElementById("orbit"),g=cv.getContext("2d"),P=[];
  function size(){cv.width=innerWidth;cv.height=innerHeight;} size(); addEventListener("resize",size);
  for(var i=0;i<140;i++)P.push({r:0.22+0.14*(i%3)+Math.random()*0.03,a:Math.random()*Math.PI*2,
    s:(0.0018+Math.random()*0.0022)*((i%2)?1:-1),z:0.4+Math.random()*0.6});
  (function draw(){ g.clearRect(0,0,cv.width,cv.height);
    var cx=cv.width/2,cy=cv.height*0.45,R=Math.min(cv.width,cv.height);
    P.forEach(function(p){ p.a+=p.s;
      var x=cx+Math.cos(p.a)*R*p.r*1.35, y=cy+Math.sin(p.a)*R*p.r*0.55;
      g.beginPath(); g.arc(x,y,1.6*p.z,0,7);
      g.fillStyle="rgba(24,200,255,"+(0.25+0.5*p.z)+")"; g.fill(); });
    requestAnimationFrame(draw); })();
  function load(){ fetch("/api/ai/pulse").then(function(r){return r.json();}).then(function(d){
    if(!d.ok)return; ["cars","riders","drives","embeddings","chats"].forEach(function(k){
      var el=document.getElementById("ai-"+k); if(el)el.textContent=d[k]; }); }).catch(function(){}); }
  load(); setInterval(load,30000);
});
