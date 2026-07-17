// NIMBUS lock-screen "neural web" background. External file because the site CSP forbids inline <script>.
(function(){
  var cv=document.getElementById('nimbus-web');if(!cv)return;
  var ctx=cv.getContext('2d'),W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2);
  var nodes=[],pulses=[],raf=0,LINK=150;
  function resize(){
    W=cv.clientWidth=window.innerWidth;H=cv.clientHeight=window.innerHeight;
    cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    var target=Math.round(Math.min(90,Math.max(34,(W*H)/22000)));
    while(nodes.length<target)nodes.push(mk());
    nodes.length=target;
  }
  function mk(){return{x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,vx:(Math.random()-.5)*.45,vy:(Math.random()-.5)*.45,r:Math.random()*1.6+1.1,ph:Math.random()*6.28};}
  function step(t){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<nodes.length;i++){var n=nodes[i];
      n.x+=n.vx;n.y+=n.vy;
      if(n.x<0||n.x>W)n.vx*=-1;if(n.y<0||n.y>H)n.vy*=-1;
    }
    for(var i=0;i<nodes.length;i++){var a=nodes[i];
      for(var j=i+1;j<nodes.length;j++){var b=nodes[j];
        var dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<LINK){var o=(1-d/LINK)*.5;
          ctx.strokeStyle='rgba(24,200,255,'+(o*.6).toFixed(3)+')';
          ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
          if(Math.random()<0.002&&pulses.length<50)pulses.push({a:a,b:b,p:0});
        }
      }
    }
    for(var i=0;i<nodes.length;i++){var n=nodes[i];
      var pu=(Math.sin(t*0.0016+n.ph)+1)*.5;
      ctx.beginPath();ctx.arc(n.x,n.y,n.r+pu*1.1,0,6.283);
      ctx.fillStyle='rgba(120,225,255,'+(0.45+pu*0.5).toFixed(3)+')';ctx.fill();
      ctx.beginPath();ctx.arc(n.x,n.y,(n.r+pu*1.1)*2.6,0,6.283);
      ctx.fillStyle='rgba(24,200,255,'+(0.05+pu*0.07).toFixed(3)+')';ctx.fill();
    }
    for(var k=pulses.length-1;k>=0;k--){var ps=pulses[k];ps.p+=0.022;
      if(ps.p>=1){pulses.splice(k,1);continue;}
      var x=ps.a.x+(ps.b.x-ps.a.x)*ps.p,y=ps.a.y+(ps.b.y-ps.a.y)*ps.p;
      var g=ctx.createRadialGradient(x,y,0,x,y,7);
      g.addColorStop(0,'rgba(180,240,255,'+(0.95*(1-ps.p)).toFixed(3)+')');
      g.addColorStop(1,'rgba(24,200,255,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,7,0,6.283);ctx.fill();
    }
    raf=requestAnimationFrame(step);
  }
  function start(){if(!raf&&!document.hidden)raf=requestAnimationFrame(step);}
  function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',function(){document.hidden?stop():start();});
  var lock=document.getElementById('nimbus-lock');
  if(lock&&'MutationObserver'in window){
    new MutationObserver(function(){
      var hidden=lock.style.display==='none'||getComputedStyle(lock).display==='none';
      if(hidden){stop();cv.style.display='none';}
      else{cv.style.display='block';resize();start();}
    }).observe(lock,{attributes:true,attributeFilter:['style','class']});
  }
  resize();start();
})();
