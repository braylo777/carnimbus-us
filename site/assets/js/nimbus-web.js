// NIMBUS lock-screen background — a layered, firing neural network (not a constellation). External file: the
// site CSP forbids inline <script>. Depth-cued layers, weighted synapses, directional signal pulses travelling
// left→right, and periodic full-depth firing cascades. Pauses when hidden; stops when the lock is dismissed.
(function(){
  var cv=document.getElementById('nimbus-web');if(!cv)return;
  var ctx=cv.getContext('2d'),W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2);
  var layers=[],syn=[],pulses=[],raf=0,t0=0,nextCascade=0,lastW=-1;

  function rnd(a,b){return a+Math.random()*(b-a);}

  function build(){
    layers=[];syn=[];pulses=[];
    var L=Math.max(5,Math.min(8,Math.round(W/260)));           // depth scales with width
    for(var l=0;l<L;l++){
      var depth=l/(L-1);                                        // 0 (front) .. 1 (back)
      var count=Math.round(rnd(5,9)+(1-Math.abs(depth-0.5))*4); // fuller in the middle layers
      var col=[], x=(l+0.5)/L*W;
      for(var i=0;i<count;i++){
        col.push({
          x:x+rnd(-18,18),
          y:(i+0.5)/count*H+rnd(-H*0.04,H*0.04),
          r:rnd(1.4,2.8)*(1-depth*0.4),                         // nearer = larger
          a:0.35+(1-depth)*0.5,                                 // nearer = brighter
          ph:rnd(0,6.28), yv:rnd(-0.08,0.08), fire:0
        });
      }
      layers.push(col);
    }
    for(var l2=0;l2<layers.length-1;l2++){                      // sparse weighted synapses to the next layer
      var A=layers[l2],B=layers[l2+1];
      for(var ai=0;ai<A.length;ai++){
        var links=Math.round(rnd(1.6,3.4));
        for(var k=0;k<links;k++){
          var bi=Math.floor(Math.random()*B.length);
          syn.push({l:l2,ai:ai,bi:bi,w:rnd(0.25,1)});
        }
      }
    }
  }
  function resize(){
    W=cv.clientWidth=window.innerWidth;H=cv.clientHeight=window.innerHeight;
    cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    // R4: only rebuild on a WIDTH change. Height-only changes (mobile URL-bar collapse on scroll) must NOT
    // reshuffle the network — that was the "background moves when I scroll" jump.
    if(W!==lastW){ lastW=W; build(); }
  }
  function node(s){return layers[s.l][s.ai];}
  function tgt(s){return layers[s.l+1][s.bi];}

  function spawnPulse(s,bright){pulses.push({s:s,p:0,sp:rnd(0.010,0.02),b:bright||0.8});}
  function cascade(){                                           // a signal fires through every layer, front to back
    var col=layers[0]; if(!col.length)return;
    var start=Math.floor(Math.random()*col.length); col[start].fire=1;
    var frontier=[start];
    for(var l=0;l<layers.length-1;l++){
      var next=[];
      for(var f=0;f<frontier.length;f++){
        var outs=syn.filter(function(s){return s.l===l&&s.ai===frontier[f];});
        for(var o=0;o<Math.min(2,outs.length);o++){
          spawnPulse(outs[o],1);
          if(next.indexOf(outs[o].bi)<0)next.push(outs[o].bi);
        }
      }
      frontier=next; if(!frontier.length)break;
    }
  }

  function step(ts){
    if(!t0)t0=ts; var t=ts-t0;
    ctx.clearRect(0,0,W,H);

    // R4: no vertical drift — the net holds still (calm heartbeat only). Just decay the firing glow.
    for(var l=0;l<layers.length;l++){var col=layers[l];
      for(var i=0;i<col.length;i++){var n=col[i]; if(n.fire>0)n.fire-=0.02; }
    }
    // synapse lines
    for(var si=0;si<syn.length;si++){var s=syn[si],a=node(s),b=tgt(s);
      var o=0.04+s.w*0.10;
      ctx.strokeStyle='rgba(24,200,255,'+o.toFixed(3)+')';
      ctx.lineWidth=0.4+s.w*0.7;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      if(Math.random()<0.0016*s.w)spawnPulse(s,0.65);           // ambient chatter
    }
    // travelling pulses
    for(var k=pulses.length-1;k>=0;k--){var pu=pulses[k];pu.p+=pu.sp;
      if(pu.p>=1){var end=tgt(pu.s);end.fire=Math.max(end.fire,pu.b);pulses.splice(k,1);continue;}
      var a2=node(pu.s),b2=tgt(pu.s),x=a2.x+(b2.x-a2.x)*pu.p,y=a2.y+(b2.y-a2.y)*pu.p;
      var g=ctx.createRadialGradient(x,y,0,x,y,8*pu.b);
      g.addColorStop(0,'rgba(190,244,255,'+(0.95*pu.b).toFixed(3)+')');
      g.addColorStop(1,'rgba(24,200,255,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,8*pu.b,0,6.283);ctx.fill();
    }
    // neurons (glow + firing flash)
    for(var l3=0;l3<layers.length;l3++){var col3=layers[l3];
      for(var j=0;j<col3.length;j++){var n2=col3[j];
        var pulse=(Math.sin(t*0.0016+n2.ph)+1)*0.5, fire=n2.fire;
        var rad=n2.r+pulse*0.9+fire*2.2;
        ctx.beginPath();ctx.arc(n2.x,n2.y,rad,0,6.283);
        ctx.fillStyle='rgba('+(150+fire*90|0)+','+(225+fire*30|0)+',255,'+(n2.a*(0.55+pulse*0.35)+fire*0.4).toFixed(3)+')';
        ctx.fill();
        ctx.beginPath();ctx.arc(n2.x,n2.y,rad*(2.4+fire*1.5),0,6.283);
        ctx.fillStyle='rgba(24,200,255,'+(0.04+pulse*0.05+fire*0.12).toFixed(3)+')';ctx.fill();
      }
    }
    if(t>nextCascade){cascade();nextCascade=t+rnd(2600,4200);}   // R4: calmer firing cadence
    raf=requestAnimationFrame(step);
  }

  function start(){if(!raf&&!document.hidden){t0=0;nextCascade=0;raf=requestAnimationFrame(step);}}
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
