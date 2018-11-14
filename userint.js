/*File: userint.js (former tabele.js) */
/*jshint esversion: 6 */

const english = false; // Log language
let code=undefined;    // global code

/* GLOBAL setup: 
    ver: version string, sytnaxC: true for C op syntax,
    setup.nPorts: number of ports 
*/
let setup = {ver: 0, syntaxC: false, nPorts: 1}; 

// VHDL keywords or reserved identifiers
const VHDLrsv=["abs","configuration","impure","null","rem","type","access","constant","in","of","report","unaffected","after","disconnect","inertial","on","return","units","alias","downto","inout","open","rol","until","all","else","is","or","ror","use","and","elsif","label","others","select","variable","architecture","end","library","out","severity","wait","array","entity","linkage","package","signal","when","assert","exit","literal","port","shared","while","attribute","file","loop","postponed","sla","with","begin","for","map","procedure","sll","xnor","block","function","mod","process","sra","xor","body","generate","nand","pure","srl","buffer","generic","new","range","subtype","bus","group","next","record","then","case","guarded","nor","register","to","component","if","not","reject","transport","std_logic","signed","unsigned","rising_edge","resize","to_signed","to_unsigned",
"rtl"]; 

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function getSetup() { // read document form settings, display version
	const v = (parseVersion===undefined) ? -1 : parseVersion;
 
	document.getElementById('version').innerHTML = v;
	const synt = document.getElementById("syntaxc").checked;
	setup.syntaxC = synt;
console.log("Syntax: "+synt);

console.log(getUrlParameter('p'));
}

function parsePorts(id, m, s) {
	var typepatt = /^(s|u)([0-9]*)$/;
	var namepatt = /^\w+$/
	
	const sId=id.toLowerCase();
	if (!namepatt.test(id)) {throw modelErr("nam", id);} 
	if (VHDLrsv.indexOf(sId)>=0) { throw modelErr("rsv",id); } 		
	
	if (!(m==="in" || m==="out" || m==="" || m==="sig")) {
		throw modelErr("mode", id);
		m ="";
	}			
	if (!typepatt.test(s)) {
		throw modelErr("type", id);
	}
	let u = (s.slice(0,1)==="u"); 
	let size = parseInt(s.slice(1));
	
	if ((u && !(size>0 && size<65)) || (!u && !(size>1 && size<65))) {
		throw modelErr("size", id);
		size = 1;
	}
	return {type:{unsigned: u, size:size}, mode:m};
}

function getPorts() {  // get Ports data from html form
	let id="";
	let val=0;
	let s="";
	let u=true;
	let size=0;
	let signals = new Map(); //[];
		
	//setLog("GetPorts");
	[...Array(setup.nPorts)].forEach(function(_, i) {
		id = document.getElementById("name"+(i+1)).value; // port name can be a list
		let a = id.split(",");
		//console.log(a);
		a.forEach(function(name) {
			id=name.trim();
			if (id !== "") {
				const m = document.getElementById("mode"+(i+1)).value;
				const s = (document.getElementById("type"+(i+1)).value);
				const obj = parsePorts(id, m, s);
				if (obj!==undefined) {signals.set(id, obj);}
			}
		});
	});
	
	return signals;
}

function copyVHDL() {
	let el = document.getElementById("vhdllog");
    let range = document.createRange();
	range.selectNodeContents(el);
	let sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
	document.execCommand("copy");	
}

function toggleSection(id) {
    var x = document.getElementById(id);
    if (x.className.indexOf("w3-show") == -1) {
        x.className += " w3-show";
    } else { 
        x.className = x.className.replace(" w3-show", "");
    }
}
function show(id, vhdl) {
    document.getElementById(id).style.display = "block";
	if (vhdl===1) {document.getElementById("output").innerHTML = "Output VHDL-2008";}
	if (vhdl===2) {document.getElementById("output").innerHTML = "VHDL TestBench";}
}
function hide(id) {
  document.getElementById(id).style.display = "none";
}


function save()
{
 let data=document.getElementById(textID).value;
 
 parseCode(); // try to parse model
 let p ="";
 if (model) {
	 model.ports.forEach(function (val, id) {
		 p += "["+id+","+val.mode+","+typeToString(val.type)+"]\n";
	 });
 } else {
	 setLog("Warning: Save: model undefined!");
 }
 data = p+data;
 let a = document.createElement("a"),
     file = new Blob([data], {type: "text/plain;charset=utf-8"});
	
 const file_name = document.getElementById("comp_name").value;
	
 if (window.navigator.msSaveOrOpenBlob) // IE10+
	window.navigator.msSaveOrOpenBlob(file, filename);
 else { // Others
	let url = URL.createObjectURL(file);
	a.href = url;
	a.download = file_name;
	document.body.appendChild(a);
	a.click();
	setTimeout(function() {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);  
	}, 0); 
 } 
}

function load(str, name) {
	let lin = str.indexOf("\n");
	let sub;
	let newp = true;	
	let i = 0;
		
	let s1 = "";
	let s2 = "";
	let s3 = "";
	
	while(lin !== -1 && newp) {
		sub = str.substring(0,lin);
		
		if (sub.charAt(0)==="[" && sub.slice(-1)==="]") {
			let a = sub.slice(1, -1).split(",");	
			if (a.length===3 && a[0]!=="") {
				//parsePorts(a[0], a[1], a[2]); // test if ports data is valid
				s1 += htmInput(i+1, "name", 6, a[0]);
				s2 += htmInput(i+1, "mode", 1, a[1]);
				s3 += htmInput(i+1, "type", 1, a[2]);
				i += 1;				
			}			
			str = str.substr(lin+1);			
		} else {
			newp = false;
		}
		
		if (i>0) {
			setup.nPorts = i;	
			document.getElementById("inName").innerHTML = s1;
			document.getElementById("inMode").innerHTML = s2;
			document.getElementById("inType").innerHTML = s3;	
		}
		
		lin = str.indexOf("\n");
	}
	
	document.getElementById(textID).value = str;	
	document.getElementById("comp_name").value = name;
	changeSource();	
}

function parseCode() // get setup and source, run Lexer and Parse
{
  getSetup();
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
		case "explit": s = (english) ? "Expected numeric literal!" : "Pričakujem številsko vrednost!"; break;
		case "sizeov": s = (english) ? "Operation size overflow (1-64)!" : "Napačna velikost operacije (1-64)!"; break;
		case "tin": s = (english) ? "Assignment to input signal '"+id+"'!" : "Prireditev vhodnemu signalu '"+id+"'!"; break;
		case "unexp": s = (english) ? "Unexpected token '"+id+"'!" : "Nepričakovan simbol '"+id+"'!"; break;
		case "mixs": s = (english) ? "Illegal usage of Signed and Unsigned in expression!" : 
		                             "Neveljavna uporaba Signed in Unsigned v izrazu!"; break;
		case "slice": s = (english) ? "Slice range error!" : "Napaka v območju podvektorja!"; break;
		case "limit": s = (english) ? "Concatenation size > 64 bits!" : "Sestavljen signal > 64 bitov!"; break;
		case "unsh": s = (english) ? "Shift right unsupported in this expression!" : "Pomik desno ni podprt v tem izrazu!"; break;
		case "cuse": s = (english) ? "Operator not supported in VHDL syntax!" : "Operator ni podprt v sintaksi VHDL!"; break;
		case "vuse": s = (english) ? "Operator not supported in C syntax!" : "Operator ni podprt v sintaksi C!"; break;
		// simulator errors
		case "inf": s = (english) ? "Simulation infinite loop!" : "Simulacija v neskončni zanki!"; break;
		// input errors
		case "rsv": s = (english) ? "Illegal use of reserved word '"+id+"'!" : "Napačna raba rezervirane besede '"+id+"'!"; break;
		case "nam": s = (english) ? "Illegal signal name '"+id+"'!" : "Neveljavno ime signala '"+id+"'!"; break;
		case "cnam": s = (english) ? "Illegal circuit name '"+id+"'!" : "Neveljavno ime vezja '"+id+"'!"; break;
		case "cnam2": s = (english) ? "Circuit name used as signal name '"+id+"'!" : "Ime vezja je uporabljeno za ime signala '"+id+"'!"; break;
		case "mixc": s = (english) ? "Illegal use of mixed case in signal name '"+id+"'!" : "Napačna raba velikih in malih črk v imenu signala '"+id+"'!"; break;
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
	if (pos!==undefined) {
		str += er1+pos+": ";
		const line = Number(pos.substr(0, pos.indexOf(':')));
		selectLine(line);
	}
	else {str += ": ";}
	str += errTxt(s, id);
	return str;
}


function setStat(str) {
  document.getElementById("stat").innerHTML += str+"\n";
}

function getDefaultType() {  // oldgetType -> getDefaultType
	let unsigned= document.getElementById("type").value==="u" ? true : false;
	let size = parseInt(document.getElementById("width").value);
	if ((unsigned && !(size>0 && size<65)) || (!unsigned && !(size>1 && size<65))) {
		throw modelErr("size", "Default data type");
		size = 1;
	}	
	if (size===1) {return {id:"bit", unsigned:true, size:1};}
	else {return {id:"sig", unsigned:unsigned, size:size, def:true};}
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
	[...Array(setup.nPorts)].forEach(function(_, i) {		
		name = document.getElementById("name"+(i+1)).value;
		s1 += htmInput(i+1, "name", 6, name);
		mode = document.getElementById("mode"+(i+1)).value;
		s2 += htmInput(i+1, "mode", 1, mode);
		type = document.getElementById("type"+(i+1)).value;
		s3 += htmInput(i+1, "type", 1, type);
	});
	
	setup.nPorts += 1;
	s1 += htmInput(setup.nPorts, "name", 6, "");
	s2 += htmInput(setup.nPorts, "mode", 1, "");
	s3 += htmInput(setup.nPorts, "type", 1, type);
	document.getElementById("inName").innerHTML = s1;
	document.getElementById("inMode").innerHTML = s2;
	document.getElementById("inType").innerHTML = s3;
	changeSource();
}

function removePort() {
	if (setup.nPorts<2) {return;}
	
	setup.nPorts -= 1;
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


// From: http://lostsource.com/2012/11/30/selecting-textarea-line.html
function selectLine(lineNum) {
	const tarea = document.getElementById(textID);
    lineNum--; // array starts at 0
	if (lineNum<0) return false;
	
    let lines = tarea.value.split("\n");

    // calculate start/end
    let startPos = 0, endPos = tarea.value.length;
    for(let x = 0; x < lines.length; x++) {
        if(x == lineNum) {break;}
        startPos += (lines[x].length+1);
    }

    endPos = lines[lineNum].length+startPos;

    // do selection
    // Chrome / Firefox

    if(typeof(tarea.selectionStart) != "undefined") {
        tarea.focus();
        tarea.selectionStart = startPos;
        tarea.selectionEnd = endPos;
        return true;
    }

    // IE
    if (document.selection && document.selection.createRange) {
        tarea.focus();
        tarea.select();
        let range = document.selection.createRange();
        range.collapse(true);
        range.moveEnd("character", endPos);
        range.moveStart("character", startPos);
        range.select();
        return true;
    }

    return false;
}