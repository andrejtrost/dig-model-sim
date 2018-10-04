/*File: userint.js (former tabele.js) */
/*jshint esversion: 6 */

const english = false; // Log language
let code=undefined;    // global code
let nPorts = 1; // number of ports, port = in, out or internal signal observed in waveform

function parseCode() // defined in parsesim.js
{
  const ta = document.getElementById(textID);
  const k = new Lexer("{\n"+ta.value+"}");
   
  code = new Parse(k);
}

function parseButton(n) {
	if (n===0) {
		document.getElementById("parse").className="w3-button w3-teal";
	} else {
		document.getElementById("parse").className="w3-button w3-green";
	}
}

function changeSource() 
{
	if (model) {
		if (model.changed()===false) {
			model.changed(true);
			if (log) {console.log("Model changed");}
			parseButton(0);
		}
	}
}

function clearLog(str) {
  document.getElementById("errlog").innerHTML = "";
  document.getElementById("stat").innerHTML = "";
}

function setLog(str) {
  document.getElementById("errlog").innerHTML += str+"\n";
}

function errTxt(str, id) {  // compose error log text, use global english
	let s = "";
	
	switch (str) {
		// parse errors
		case "exp": s = (english) ? "Expecting '"+id+"'!" : "Pričakujem '"+id+"'!"; break;
		case "expvn": s = (english) ? "Expected signal or number!" : "Pričakujem signal ali število!"; break;
		case "tin": s = (english) ? "Assignment to input signal '"+id+"'!" : "Prireditev vhodnemu signalu '"+id+"'!"; break;
		case "unexp": s = (english) ? "Unexpected token '"+id+"'!" : "Nepričakovan simbol '"+id+"'!"; break;
		case "mixs": s = (english) ? "Illegal usage of Signed and Unsigned in expression!" : 
		                             "Neveljavna uporaba Signed in Unsigned v izrazu!"; break;
		case "limit": s = (english) ? "Concatenation size > 64 bits!" : "Sestavljen signal > 64 bitov!"; break;
		// simulator errors
		case "inf": s = (english) ? "Simulation infinite loop!" : "Simulacija v neskončni zanki!"; break;
		// input errors
		case "mode": s = (english) ? "Unknown Mode for port '"+id+"'!" : "Neznan Mode priključka '"+id+"'!"; break;
		case "type": s = (english) ? "Illegal Type of signal '"+id+"'!" : "Napačna oznaka tipa signala '"+id+"'!"; break;
		case "size": s = (english) ? "Illegal size of signal '"+id+"' (1-64)!" : "Napačna velikost signala '"+id+"' (1-64)!"; break;
		// visit model errors
		case "vin": s = (english) ? "Signal '"+id+"' should be input!" : "Signal '"+id+"' mora biti vhod!"; break;
		case "cmpsz": s = (english) ? "Compare size mismatch!" : "Neujemanje velikosti primerjave!"; break; 
		case "cmpm": s = (english) ?  "Illegal Signed/Unsigned comparisson!" : "Neveljavna primerjava različno predznačenih vrednosti!"; break;
		case "cmpb": s = (english) ?  "Illegal one-bit comparisson!" : "Neveljavna enobitna primerjava!"; break;
		case "mix": s = (english) ?  "Mixed comb and sequential assignments!" : 
		                             "Mešanje kombinacijsih in sekvenčnih prireditev!"; break;
		case "mult": s = (english) ?  "Multiple assignments to '"+id+"' in same block!" :
									  "Večkratna prireditev signalu '"+id+"' v istem bloku!"; break;
		default: s = str;
	}
	return s;
}

function modelErr(s, id, pos) { // error in model
	const er = (english) ? "Error " : "Napaka ";
	let str = "<span style='color: red;'>"+er+"</span>";
	const er1 = (english) ? "at " : "v ";	
	if (pos!==undefined) {str += er1+pos+": ";}
	else {str += ": ";}
	str += errTxt(s, id);
	return str;
}


function setStat(str) {
  document.getElementById("stat").innerHTML += str+"\n";
}

function getPorts() {  // get Ports data from html form
	let id="";
	let val=0;
	let s="";
	let u=true;
	let size=0;
	let signals = new Map(); //[];
	
	var typepatt = /^(s|u)([0-9]*)$/;
	//setLog("GetPorts");
	[...Array(nPorts)].forEach(function(_, i) {
		id = document.getElementById("name"+(i+1)).value; // port name can be a list
		let a = id.split(",");
		//console.log(a);
		a.forEach(function(name) {
			id=name.trim();
			if (id !== "") {
				let m = document.getElementById("mode"+(i+1)).value;
				if (!(m==="in" || m==="out" || m==="" || m==="sig")) {
					throw modelErr("mode", id);
					m ="";
				}			
				let s = (document.getElementById("type"+(i+1)).value);
				if (!typepatt.test(s)) {
					throw modelErr("type", id);
				}
				let u = (s.slice(0,1)==="u"); 
				size = parseInt(s.slice(1));
				
				if ((u && !(size>0 && size<65)) || (!u && !(size>1 && size<65))) {
					throw modelErr("size", id);
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
	return "<input id='"+id+i+"' size='"+size+"' value='"+value+"' type='text' onchange='changeSource();'><br>";
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
	s1 += htmInput(nPorts, "name", 6, "");
	s2 += htmInput(nPorts, "mode", 1, "");
	s3 += htmInput(nPorts, "type", 1, type);
	document.getElementById("inName").innerHTML = s1;
	document.getElementById("inMode").innerHTML = s2;
	document.getElementById("inType").innerHTML = s3;
	changeSource();
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
	changeSource();
}


