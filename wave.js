/*File: wave.js */
/*jshint esversion: 6 */

function Wave() {  // podatkovna struktura za grafikon, funkcije: zoom, ID=slide
  zoomf = 0; // 100%  
  txt = "100%";
  
  cycles100 = 50; // ciklov pri 100%  
  viewcycles = cycles100;
  
  wdx = 20;   // pix/cikel
  wline = 2;  // ciklov/pomozno crto
  
  wcycles = 0; // vseh ciklov v signalih
  wnstart = 0; // prvi prikazani cikel
  wnend = 0;   // zadnji prikazani cikel
  
  function dx() {return wdx;}
  function line() {return wline;}
  function cycles() {return wcycles;}
  function setCycles(cy) {wcycles = cy;}
  function nstart() {return wnstart;}
  function nend() {return wnend;}
  
  function setView(n) {
	  wnstart = n;
	  wnend = (wcycles-wnstart>viewcycles) ? wnstart+viewcycles : wcycles;  
  }
    
  function zoom(z) {
	
	var slide = document.getElementById('slide');
  
	switch (z) {
	  case -1: if (zoomf>-2) zoomf--; else return; break;
	  case  1: if (zoomf<2) zoomf++; else return; break;
	  default:
  	   zoomf=0; 
	   slide.value=0; 
	   wnstart=0;
	   document.getElementById("sliderAmount").innerHTML="0";
	}
	 
	switch (zoomf) {    
	    case 2: 
		  txt = "500%"; wdx=100; viewcycles=cycles100/5; line=1; 
		  break;
		case 1: 
		  txt = "200%"; wdx=40; viewcycles=cycles100/2; line=1; 
		  break;
		case -1: 
		  txt = " 50%"; wdx=10; viewcycles=cycles100*2; line=5; 
		  break;
		case -2: 
		  txt = " 25%"; wdx=5; viewcycles=cycles100*4; line=10; 
		  break;
		default: 
		  txt = "100%"; wdx=20; viewcycles=cycles100; line=2;
	}
	
    setView(wnstart);
	
	var k = Math.floor(wcycles/viewcycles);
	//console.log("Z: "+this.zoomf+"MAX:"+k*this.cycles);
	slide.max = k*viewcycles;
	  
	slide.step = 10;//this.viewcycles;
	document.getElementById("zoomf").innerHTML = txt;
	graf();
 }

 return {setView, zoom, dx, line, cycles, setCycles, nstart, nend};
}

var wave = new Wave();
var signals; // vrednosti signalov [][]
var ctx;     // kontekst platna

// ID in funkcije za branje iz vnosnih polj
var canvasID = "wave";

function getSigNum() {  // število priključkov
  return document.getElementById('sigtable').rows.length-1;
}

function getCycles() {  // število ciklov
  return parseInt(document.getElementById("cycles").value);
}

function isSequential() { // sekvenčno vezje 
  return document.getElementById("sequential").checked;
}

function setSignalAll(i, value) {
	var c = 0;
	var cycles = getCycles();
	
	for (c = 0; c < cycles; c++) signals[i][c] = value;
}

//-------------------------------------------------------
var ports = [];   // tabela prikljuckov, elementi razreda Sig

function Sig(name, mode, type) {
  this.name = name;
  this.mode = mode;
  this.type = type;
  
  this.getType = function() {return this.type;}  
  this.getSize = function() {return this.size;}
};
 
function Bit(name, mode) {
 Sig.call(this, name, mode, "std_logic");
 this.size = 1;
 
 this.str = function() { return this.name+","+this.mode+",std_logic"; }
}
 
function Vec(name, mode, type, size) {
 Sig.call(this, name, mode, type);
 this.type = type;
 this.size = size;

 if (type=="signed") {
	this.min = -Math.pow(2,Math.abs(size-1));
	this.max = Math.pow(2,Math.abs(size-1))-1;
 } else {
    this.min = 0;
	this.max = Math.pow(2,Math.abs(size))-1;
 }

 this.str = function() { return this.name+","+this.mode+","+this.type+"("+(this.size-1)+":0)"; }
} 
//-------------------------------------------------------

function graf_init() { // inicializacija, ID=slide, sliderAmount, slide.onchange()
 var canvas = document.getElementById(canvasID);
 canvas.addEventListener('click', graf_click, false); //mousedown, mouseup
 //canvas.addEventListener('mouseup', graf_click, false);
 canvas.addEventListener('keydown', graf_move);
 
 var slide = document.getElementById('slide'),
 sliderDiv = document.getElementById("sliderAmount");
 
 slide.onchange = function() {	 
	wave.setView(parseInt(this.value)); 
    sliderDiv.innerHTML = wave.nstart();
	graf();
 }

 if (canvas.getContext) {
   ctx = canvas.getContext("2d");
 } else {
   throw new Error("Can not get MyCanvas Context");
 }
 
 //var vrstice = getSigNum(); 
 var cycles = wave.cycles();
	
 signals = new Array();   // ustvari globalno tabelo
/* for (var i=0; i < vrstice; i++) {
	signals[i] = new Array();                    
	for (var j=0; j < cycles; j++) signals[i][j] = 0;
 }*/
 console.log("init");
}

function graf_refresh()  /* posodobi tabeli ports[] in signals[][], prikaz zoom(0) */
{
 	var vrstice = 0;
 	var cycles = getCycles();   // beri nove nastavitve
	
	wave.setCycles(cycles);      
	var a=0, i=0;
	
	if (model===undefined) {return;} // return if the model is invalid
	
	// preveri ali so spremembe v ports[]
	var s = model.ports; // getPorts();
	var n = 0;
	var ime = "";
	var tip_sig = "unsigned";
	var portslen = ports.length;
	
	var change = false;  // test, if ports changed
	if (portslen!==s.size) {change=true; console.log("Num difference");}
	else {
	  n = 0;
	  s.forEach(function (val, id) {
		//console.log("PPP: "+id+" "+ports[n].name);
		if (id!==ports[n].name) { change=true; console.log("Name difference"); }
		var tip_sig = "unsigned";
		if (val.type.unsigned===false) {tip_sig = "signed";}
		if (val.type.size===1) {tip_sig = "std_logic";}
		if (tip_sig!==ports[n].type) { change=true; console.log("Type difference "+tip_sig+":"+ports[n].type); }
		if (val.type.size!==ports[n].size) { change=true; console.log("Size difference "+val.type.size+":"+ports[n].size); }
		n += 1;
	  });
	  vrstice = n;  
	}	
	
	//console.log("Ports len: "+portslen+" "+change);
	
	if (change) { // define new ports
		ports = [];
		
		s = getPorts();
		var len = 0;
		s.forEach(function (val, id) {
			len += 1;
			var ime=id;
			var tip_sig = "unsigned";
			if (val.type.unsigned===false)  tip_sig = "signed";
			var in_out = val.mode; 
			var size = val.type.size;
			if (size===1) {p= new Bit(ime, in_out);}
			else {p = new Vec(ime, in_out, tip_sig, size);}			
			ports.push(p);			
		});	
		vrstice = len;
	}
	
	var cur_signals = signals.length;
	
	if (vrstice > cur_signals) { // dodaj vrstico signalov
		for (a=cur_signals; a < vrstice; a++) {
			signals[a] = new Array(cycles);
			for (var b=0; b < cycles; b++) signals[a][b] = 0;
		}
	}		
	if (vrstice < cur_signals) { // odstrani signale
		for (a=vrstice; a < cur_signals; a++) signals.pop();
	}
	 
	var cur_cycles = signals[0].length;
	
	if (cycles > cur_cycles) { // dodaj urne cikle
		for (a=0; a < vrstice; a++) {				
			for (i=0; i < cycles - cur_cycles; i++) signals[a].push(0);
		}
	}
	if (cycles < cur_cycles) { // odstrani cikle
		for (a=0; a < vrstice; a++) {
			for (i=0; i < cur_cycles - cycles; i++) signals[a].pop();
		}
	} 

	if (change) {
		for (i=0; i<portslen; i++) setSignalAll(i, 0);
	}
	
	console.log("refresh: ports="+ports.length+", cyc="+cycles);
		
	var h = 100+30*vrstice; // prilagodi velikost platna
	var canvas = document.getElementById(canvasID);
	if (vrstice >=10 && h != canvas.height) canvas.height=h; 
	
	wave.zoom(0); // prikaz pri zoom=0	
}

/******************************************************************/
function getInValues(i) {
	let id="";
	let val=0;
	let sig = new Map();
	
	if (i >= wave.cycles()) {return undefined;}
	
	console.log("Go sim: "+i);
	
	ports.forEach(function (p, n) {		
		id = p.name;
		val =  signals[n][i].valueOf();
		if (p.mode ==="in") {
			sig.set(id, val);
		}
	});

	return sig;
}

function setSignal(i, name, value) {
	ports.forEach(function (p, n) {		
		if (name===p.name) { 
		 signals[n][i] = value;
		}
		
	});
	
}

/******************************************************************/

function graf_clear()  // pocisti platno 
{
 var canvas = document.getElementById(canvasID);
 var context = canvas.getContext("2d");
 context.clearRect(0, 0, canvas.width, canvas.height);
}

function graf_labels()  // prikaz oznak grafikona in ure
{	
	var y1 = 60;
	var sek = document.getElementById("sequential");
	if (sek.checked) y1 = 14;
	
	var x1 = 100; 
    var end = 70+30*ports.length; 
			
	var nstart = wave.nstart(); // zacetek in konec risanja
	var nend = wave.nend();
	 
 	if (ctx) {  
      ctx.beginPath(); 
      ctx.lineWidth = "1px";
	  ctx.strokeStyle="#E9E9E9";
      for (var n = nstart; n < nend; n+=wave.line()) {  // risanje crt za vsak cikel      
        ctx.moveTo(x1,y1);
        ctx.lineTo(x1,end);
        ctx.stroke();                           
        x1 += wave.line()*wave.dx();
      }
	  
	  ctx.font = "12px Verdana"; 
	  ctx.fillStyle = "#000000";
	  ctx.textAlign="end";
      ctx.fillText("t="+100*Math.floor(nstart/100), 85, end);
			  
	  ctx.textAlign="center";
	  
	  x1 = 110;
      for (n = nstart; n < nend; n+=wave.line()) {  // stevilke ciklov na dnu diagrama
        ctx.fillText(n%100, x1, end);
        x1 += wave.line()*wave.dx();
	  }	
    } 
}
		 
function draw_bit(r, nstart, nend, vvs, vns, in_out)  /* risanje enobitnega signala */
{
  if (ctx) {
	ctx.beginPath();
	ctx.lineWidth = 2;
	ctx.strokeStyle = (in_out == "out" || in_out == "buffer") ? "blue" : "black";
        
	var xi = 100;
	var y1 = 0;
	
	for (var i = 0; i < nend-nstart; i++) {
	    y1 = (signals[r][nstart+i] == 0) ? vns : vvs;	
		if (i==0) {
			ctx.moveTo(xi + i*wave.dx(),y1);
			ctx.lineTo(xi + (i+1)*wave.dx(),y1); 
		} else {
			if (signals[r][nstart+i-1] == signals[r][nstart+i]) {
				ctx.lineTo(xi + (i+1)*wave.dx(),y1); 
			} else {
				ctx.lineTo(xi + i*wave.dx(),y1); 
				ctx.lineTo(xi + (i+1)*wave.dx(),y1); 
			}     
	    } 
    }
	ctx.stroke();
  }
}

function draw_bus(r, nstart, nend, vvs, vns, in_out)  // risanje vodila, glob. signals[][]
{ 
 if (ctx) {  
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = (in_out == "out" || in_out == "buffer") ? "blue" : "black";
	
  for (var j=0; j < nend-nstart; j++) {
	if (j == 0) {    
		ctx.moveTo(100,vvs);
		ctx.lineTo(100+wave.dx(),vvs); 
		ctx.moveTo(100,vns);
		ctx.lineTo(100+wave.dx(),vns); 
	} else {
		if (signals[r][nstart+j] != signals[r][nstart+j-1]) {
			ctx.moveTo(100+wave.dx()*j-1,vns);
			ctx.lineTo(100+wave.dx()*j+2,vvs);
			ctx.lineTo(100+wave.dx()*(j+1)-1,vvs);
			
			ctx.moveTo(100+wave.dx()*j-1,vvs);
			ctx.lineTo(100+wave.dx()*j+2,vns);
			ctx.lineTo(100+wave.dx()*(j+1)-1,vns);
		} else {         
			ctx.moveTo(100+wave.dx()*j - 1,vvs);
			ctx.lineTo(100 + wave.dx()*(j+1)-1,vvs);
			ctx.moveTo(100+wave.dx()*j-1,vns);
			ctx.lineTo(100 + wave.dx()*(j+1)-1,vns);
		}
	}
  }
  ctx.stroke();

  var change = 0;
  var last;
  var first = 0;
  var value = signals[r][nstart];
  
  ctx.font = "12px Verdana"; //Vrednosti vodila na grafu
  ctx.textAlign="center";
  ctx.fillStyle = "black";
  
  for (j=1; j < nend-nstart; j++) {
	if (signals[r][nstart+j] != value) {
	    if ((j-first)*wave.dx() > ctx.measureText(value).width) //izpis, ce je dovolj prostora
	      ctx.fillText(value, 100 + ((j-1 - first)/2)*wave.dx() + first*wave.dx() + wave.dx()/2, vns - 5);		
		value = signals[r][nstart+j];
		first = j;
	}
  }
  ctx.fillText(value, 100 + ((j-1 - first)/2)*wave.dx() + first*wave.dx() + wave.dx()/2, vns - 5);
  
 }
}
   
function graf_plot()  //izris vseh signalov v razpredelnici
{
  var vvs = 20;
  var vns = 40;
  var sequential = document.getElementById("sequential").checked;

  var nstart = wave.nstart(); // zacetek in konec risanja
  var nend = wave.nend();
  
  console.log("plot: "+nstart+"-"+nend);
  
  if (ctx) { 	
	if (sequential) { // risanje ure
		ctx.font = "15px Verdana";
		ctx.fillStyle = "gray"; //"#0000FF";
		ctx.textAlign="end";
		ctx.fillText("clk", 85, 35);
		  
		ctx.beginPath();
		ctx.strokeStyle="gray";//  "#000000";  // set the color.
		ctx.lineWidth = 2;
		var vvc = vvs; //vertikala signala visokega nivoja
		var vnc = vns; //vertikala signala nizkega nivoja
		var x1 = 100;
			
		ctx.moveTo(x1,vnc);
		
		for (var n = nstart; n < nend; n++) // n-ti urni cikel
		{			
			ctx.lineTo(x1,vvc);
			ctx.lineTo(x1+wave.dx()/2,vvc);
			ctx.lineTo(x1+wave.dx()/2,vnc);
			ctx.lineTo(x1+wave.dx(),vnc);
			x1 += wave.dx();
		}
		 ctx.stroke();
	}

	var vrstice = ports.length;
	
 	for (n=0; n < vrstice; n++) // risanje signalov
    {		
        vvs += 30;
        vns += 30;
                
        ctx.font = "15px Verdana";  // ime signala, desna poravnava
        ctx.fillStyle = "#0000FF";
        ctx.textAlign="end";
        ctx.fillText(ports[n].name, 85, vns - 5);
     
        // v izris posameznega signala               
        ctx.beginPath();

		if (ports[n].type == "std_logic") draw_bit(n, nstart, nend, vvs, vns, ports[n].mode);        
        else draw_bus(n, nstart, nend, vvs, vns, ports[n].mode);
    }
	
  }
}

function graf() {  // risanje grafa
  graf_clear();    // brisanje platna
  graf_labels();   // oprema grafa
  graf_plot();     // risanje signalov
}
    
// servis dogodka click, spremeni vrednost signala
function graf_click(e) { 	
	var rect = document.getElementById(canvasID).getBoundingClientRect(); // okvir
	var cursorX = e.clientX - rect.left;
	var cursorY = e.clientY - rect.top;
	var cx0 = Math.floor((cursorX - 100)/wave.dx());
    var cy = Math.floor((cursorY - 50)/30);
		
    var cycles = wave.cycles();
 	var vrstice = ports.length;
    var bus = document.getElementById("bus").value;
    
	var c = 0;
	
	var nstart = wave.nstart(); // zacetek in konec risanja
	var nend = wave.nend();
	
	var cx = cx0 + nstart;

	console.log("cy="+cy+" cx="+cx+",nstart="+nstart+" nend="+nend);
	
	// Sprememba celotnega signala ob kliku na ime signala
    if (cx0==-1 && cy>=0 && cy<vrstice) {
	  
	  var value=0;
	  var limit=false;
	  if (signals[cy][0] == 0) {
		if (ports[cy] instanceof Vec) {
            if (bus>=ports[cy].min && bus<=ports[cy].max) value = bus;
		    else limit=true;
		} else value=1;
	  }
	  
	  if (limit) { alert("Value out of limits!") }
	  else {	  
	   var r = confirm("SET "+ports[cy].name+" = "+value+" ?");
	  
	   if (r == true) {
		for (c = 0; c < cycles; c++) signals[cy][c] = value;
		graf();
	   }
	  }
	} else // Sprememba vrednosti posameznih ciklov
	
	if (cx>=nstart && cx<nend && cy>=0 && cy<vrstice) {        
        if (ports[cy] instanceof Vec)  {
            if (bus>=ports[cy].min && bus<=ports[cy].max) {
				signals[cy][cx] = bus;
                graf();
			} else {
                alert("Value out of limits: "+ports[cy].min+" .. "+ports[cy].max);
            }
        } else {        
			if (signals[cy][cx] == 0) signals[cy][cx] = 1;
			else signals[cy][cx] = 0;
			graf();
        }             
   }       
}

function graf_move(e) { // servis dogodka onkeydown
  var slide = document.getElementById('slide');
  if (e.key=="6" && parseInt(slide.value) < parseInt(slide.max)) {
	slide.value = parseInt(slide.value)+parseInt(slide.step);
  } else if (e.key=="4" && slide.value > 0) {
	slide.value = parseInt(slide.value)-parseInt(slide.step);
	if (parseInt(slide.value)<0) slide.value=0;		  
  } else return;
  
  wave.setView(parseInt(slide.value)); 
  document.getElementById("sliderAmount").innerHTML = wave.nstart();
  graf();	
}



