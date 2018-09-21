/*File: tabele.js */
/*jshint esversion: 6 */

let nPorts = 1; // number of ports, port = in, out or internal signal observed in waveform

function getPorts() {  // get Ports data from html form
	let id="";
	let val=0;
	let s="";
	let u=true;
	let size=0;
	let signals = new Map(); //[];
	
	var typepatt = /^(s|u)([0-9]*)$/;
	setLog("GetPorts");
	[...Array(nPorts)].forEach(function(_, i) {
		id = document.getElementById("name"+(i+1)).value; // port name can be a list
		let a = id.split(",");
		//console.log(a);
		a.forEach(function(name) {
			id=name.trim();
			if (id !== "") {
				let m = document.getElementById("mode"+(i+1)).value;
				if (!(m==="in" || m==="out" || m==="" || m==="sig")) {
					setLog("getPorts: Unknown Mode "+m+" for signal: "+id);
					m ="";
				}
				
				
				let s = (document.getElementById("type"+(i+1)).value);
				let u = (s.slice(0,1)==="u"); 
				size = parseInt(s.slice(1));			
				if (!typepatt.test(s) || !(size>0 && size<100)) {
					console.log("Input: "+id+" type error!");				
					size = 1;
				}						
				signals.set(id, {type:{unsigned: u, size:size}, mode:m});
			}
		});
	});
	
	return signals;

}

function getDefaultType() {  // oldgetType -> getDefaultType
	let unsigned= document.getElementById("type").value==="u" ? true : false;
	let size = parseInt(document.getElementById("width").value);
	if (size===1) {return {id:"bit", unsigned:unsigned, size:size};}
	else {return {id:"sig", unsigned:unsigned, size:size};}
	//return document.getElementById("type").value+document.getElementById("width").value;
}

function htmInput(i, id, size, value) {
	return "<input id='"+id+i+"' size='"+size+"' value='"+value+"' type='text'><br>";
}

function addPort() {	
	let s1 = "";
	let s2 = "";
	let s3 = "";
	let name = "";
	let mode = "";
	let type = "";
	[...Array(nPorts)].forEach(function(_, i) {		
		name = document.getElementById("name"+(i+1)).value;
		s1 += htmInput(i+1, "name", 6, name);
		mode = document.getElementById("mode"+(i+1)).value;
		s2 += htmInput(i+1, "mode", 1, mode);
		type = document.getElementById("type"+(i+1)).value;
		s3 += htmInput(i+1, "type", 1, type);
	});
	
	nPorts += 1;
	s1 += htmInput(nPorts, "name", 6, "n");
	s2 += htmInput(nPorts, "mode", 1, mode);
	s3 += htmInput(nPorts, "type", 1, type);
	document.getElementById("inName").innerHTML = s1;
	document.getElementById("inMode").innerHTML = s2;
	document.getElementById("inType").innerHTML = s3;
}

function removePort() {
	if (nPorts<2) {return;}
	
	nPorts -= 1;
	let s = document.getElementById("inName").innerHTML;
	var n = s.lastIndexOf("<input");
	document.getElementById("inName").innerHTML = s.substring(0, n);
	
	s = document.getElementById("inMode").innerHTML;
	n = s.lastIndexOf("<input");
	document.getElementById("inMode").innerHTML = s.substring(0, n);
	
	s = document.getElementById("inType").innerHTML;
	n = s.lastIndexOf("<input");
	document.getElementById("inType").innerHTML = s.substring(0, n);
}



function clearLog(str) {
  document.getElementById("errlog").innerHTML = "";
  document.getElementById("stat").innerHTML = "";
}

function setLog(str) {
  document.getElementById("errlog").innerHTML += str+"\n";
}

function setStat(str) {
  document.getElementById("stat").innerHTML += str+"\n";
}

let code=undefined;

function parse_script()
{
  const ta = document.getElementById(textID);
  const k = new Lexer("{\n"+ta.value+"}");
   
  //return Parse(k);
  code = new Parse(k);
}
