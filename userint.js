/*File: userint.js (former tabele.js) */
/*jshint esversion: 6 */

let english = false; // Log language
let markErr = true;
let defName= "";     // Default entity name

/* GLOBAL setup: 
    ver: version string, sytnaxC: true for C op syntax,
    nPorts: initial number of ports in HTML table
	maxBinSize: max size of binary bit string for unspecified literals
*/
let setup = {ver: 0, syntaxC: false, nPorts: 1, maxBinSize: 8, vhdl2008: true, stdlogic: true, convUnused: false};

// VHDL keywords or reserved identifiers
const VHDLrsv=["abs","configuration","impure","null","rem","type","access","constant","in","of","report","unaffected","after","disconnect","inertial","on","return","units","alias","downto","inout","open","rol","until","all","else","is","or","ror","use","and","elsif","label","others","select","variable","architecture","end","library","out","severity","wait","array","entity","linkage","package","signal","when","assert","exit","literal","port","shared","while","attribute","file","loop","postponed","sla","with","begin","for","map","procedure","sll","xnor","block","function","mod","process","sra","xor","body","generate","nand","pure","srl","buffer","generic","new","range","subtype","bus","group","next","record","then","case","guarded","nor","register","to","component","if","not","reject","transport","std_logic","signed","unsigned","rising_edge","resize","to_signed","to_unsigned",
"rtl"]; 


function HDLinit() {
 getSetup();
	
	//Check File API support (from wave.js)
 if (window.File && window.FileList && window.FileReader) {
	var filesInput = document.getElementById("infile");

	filesInput.addEventListener("change", function(event) {
		var files = event.target.files; //FileList object
		var output = document.getElementById("result");

		var file = files[0];

		var picReader = new FileReader();

		picReader.addEventListener("load", function(event) {
			var textFile = event.target;	
			load(textFile.result, file.name);
		});		
		picReader.readAsText(file); //Read the text file
	});
 } else {
	console.log("Your browser does not support File API");
 }
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function getSetup() { // read document form settings, display version
    //setInterval(checkInputCode, 2000);  
	const v = (parseVersion===undefined) ? -1 : parseVersion;
 
	document.getElementById('version').innerHTML = v;
	const synt = document.getElementById("syntaxc").checked;
	setup.syntaxC = synt;

	setup.vhdl2008 = document.getElementById("lang2008").checked;
	setup.stdlogic = document.getElementById("stdlogic").checked;
	english = document.getElementById("english").checked;
	markErr = document.getElementById("mark").checked;
	defName = document.getElementById("comp_name").value;
	
	if (!(/^[a-zA-Z]\w+$/.test(defName)) || (VHDLrsv.indexOf(defName)>=0)) {
		console.log("Error in Setup Circuit name: '"+defName+"' !");
		defName = "Vezje";
		console.log("Revert to default name: "+defName);
		document.getElementById("comp_name").value = defName;
	}
	
console.log(getUrlParameter('p'));
}

function parsePorts(id, m, s, decl) {
	var typepatt = /^(s|u)([0-9]*)$/;
	var namepatt = /^\w+$/
	
	const sId=id.toLowerCase();
	if (!namepatt.test(id)) {throw modelErr("nam", id);} 
	if (VHDLrsv.indexOf(sId)>=0) { throw modelErr("rsv",id); } 		
	
	if (!(m==="in" || m==="out" || m==="" || m==="sig")) {
		throw modelErr("mode", id);
		m ="";
	}			
	
	// check if type is array
	let i = 0;	
	let ch = s.charAt(0);
	let anum = "";
	let array = false;
	let asize = 0;
	
	while (ch >= "0" && ch <= "9") {
		anum += ch;
		i += 1;
		ch = s.charAt(i);		
	}
	if (anum !== "") {	
		s = s.slice(anum.length);
		asize = Number(anum);
		if (asize<=0 || asize>1023) {
			asize=1;
			modelErr("Unsupported size of array declaration (1-1024)!"); // TODO: unreachable?
			//console.log("Error: Declared array size out of bounds 1...1023");
		}
		array = true;
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
	return {type:{unsigned: u, size:size, array:array, asize:asize, declared:decl}, mode:m};
}

function getPorts() {  // get Ports data from html form
	let id="";
	let signals = new Map(); //[];
		
	[...Array(setup.nPorts)].forEach(function(_, i) {
		id = document.getElementById("name"+(i+1)).value; // id name or id list
		let idArray = id.split(",");
		const modeStr = document.getElementById("mode"+(i+1)).value;
		var typeStr = (document.getElementById("type"+(i+1)).value);
		if (typeStr==="") typeStr="u1";

		idArray.forEach(function(name, j) {			
			id=name.trim();
			if (id !== "") {
				let declared = (j === idArray.length-1) ? 1 : 2;				
				const obj = parsePorts(id, modeStr, typeStr, declared);
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
 let data=editor.getValue();
 let file_name = document.getElementById("comp_name").value;
 
 parseCode(); // try to parse model
 let p ="";
 if (model) {
	file_name = model.name(); // set name to model name
	ptable = getPorts();
	 
	if (ptable.size > 0) {
		p += "[\n";	 
		ptable.forEach(function (val, id) {
			if (val.type.declared===1) { // single declaration			
				p += id+": "+val.mode+" "+typeToString(val.type)+"\n";
			} else {
				p += id+", ";
			}
		});
		p += "]\n";
	}
 } else {
	 setLog("Warning: Save: model undefined!");
 }
 data = p+data;
 let a = document.createElement("a"),
     file = new Blob([data], {type: "text/plain;charset=utf-8"});
	
 
 //const file_name = document.getElementById("comp_name").value;
	
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
 unmarkSave();
 editor.on("inputRead", markSave); 
}

function load(str, name) {
	let newp = true;	
	let i = 0;
	let j = 0;
		
	let s1 = "";
	let s2 = "";
	let s3 = "";
	
	//prvi podniz = "[\n"
	let lin = 0;
	let sub = ""
	
	let portsStr = str.substring(str.indexOf("[") + 1, str.indexOf("]")).trim();	
	str = str.substring(str.indexOf("]")+1).trim();
	console.log("***"+portsStr+"***");
	
	if (portsStr!=="") { //(sub.charAt(0)==="[") {
		sub = portsStr;
		do {
			
			lin = portsStr.indexOf("\n"); // poišči prvi \n in skrajšaj portsStr
			if (lin !== -1) {
				sub = portsStr.substring(0,lin+1).trim();
				portsStr = portsStr.substring(lin+1);
			}
			else {sub = portsStr; portsStr = "";}
			
			j = sub.indexOf(":");
			if (j !== -1) {
				names = sub.substring(0,j);
				let tmp = sub.substring(j+1).trim();
				let modeStr = "";
				if (tmp.startsWith("in")) {
					modeStr = "in";
					tmp = tmp.substring(2);
				} else if (tmp.startsWith("out")) {
					modeStr = "out";
					tmp = tmp.substring(3);
				}
				
				s1 += htmInput(i+1, "name", 6, names);
				s2 += htmInput(i+1, "mode", 1, modeStr);
				s3 += htmInput(i+1, "type", 1, tmp.trim());
				i += 1;
			}
		} while (portsStr!=="");
	
		if (i>0) {
			setup.nPorts = i;
			document.getElementById("inName").innerHTML = s1;
			document.getElementById("inMode").innerHTML = s2;
			document.getElementById("inType").innerHTML = s3;
		} else {
			setup.nPorts = 1;
			s1 += htmInput(i+1, "name", 6, "");
			s2 += htmInput(i+1, "mode", 1, "");
			s3 += htmInput(i+1, "type", 1, "");
		}
		
	}
	
	editor.setValue(str);
	unmarkSave();	
	document.getElementById("comp_name").value = name;
	changeSource();	
}

function parseCode() // get setup and source, run Lexer and Parse
{
  getSetup();
  const ta = editor.getValue(); 
  const k = new Lexer(ta); //Lexer("test: begin\n"+ta.value+"end");
   
  Parse(k);
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

function clearLog() {
  document.getElementById("errlog").innerHTML = "";
  document.getElementById("stat").innerHTML = "";
}

function setLog(str) {
  document.getElementById("errlog").innerHTML += str+"\n";
}

function errTxt(str, id) {  // compose error log text, use global english
	let s = "";
	
	switch (str) {
		// parse errors (12)
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
		// input errors (9)
		case "rsv": s = (english) ? "Illegal use of reserved word '"+id+"'!" : "Napačna raba rezervirane besede '"+id+"'!"; break;
		case "nam": s = (english) ? "Illegal signal name '"+id+"'!" : "Neveljavno ime signala '"+id+"'!"; break;
		case "cnam": s = (english) ? "Illegal circuit name '"+id+"'!" : "Neveljavno ime vezja '"+id+"'!"; break;
		case "cnam2": s = (english) ? "Circuit name used as signal name '"+id+"'!" : "Ime vezja je uporabljeno za ime signala '"+id+"'!"; break;
		case "mixc": s = (english) ? "Illegal use of mixed case in signal name '"+id+"'!" : "Napačna raba velikih in malih črk v imenu signala '"+id+"'!"; break;
		case "mode": s = (english) ? "Unknown Mode for port '"+id+"'!" : "Neznan Mode priključka '"+id+"'!"; break;
		case "type": s = (english) ? "Illegal Type of signal '"+id+"'!" : "Napačna oznaka tipa signala '"+id+"'!"; break;
		case "size": s = (english) ? "Illegal size of signal '"+id+"' (1-64)!" : "Napačna velikost signala '"+id+"' (1-64)!"; break;
		case "decl": s = (english) ? "Signal '"+id+"' is already declared!" : "Signal '"+id+"' je ponovno deklariran!"; break;
		// visit model errors (6)
		case "vin": s = (english) ? "Signal '"+id+"' should be input!" : "Signal '"+id+"' mora biti vhod!"; break;
		case "cmpsz": s = (english) ? "Compare size mismatch!" : "Neujemanje velikosti primerjave!"; break; 
		case "cmpm": s = (english) ?  "Illegal Signed/Unsigned comparisson!" : "Neveljavna primerjava različno predznačenih vrednosti!"; break;
		case "cmpb": s = (english) ?  "Illegal one-bit comparisson!" : "Neveljavna enobitna primerjava!"; break;
		case "mix": s = (english) ?  "Mixed comb and sequential assignments!" : 
		                             "Mešanje kombinacijsih in sekvenčnih prireditev!"; break;
		case "mult": s = (english) ?  "Multiple assignments to '"+id+"' in same block!" :
									  "Večkratna prireditev signalu '"+id+"' v istem bloku!"; break;
		case "rel": s = (english) ?  "Relation operator is not allowed in assignment statement!" :
									  "Relacijski operator ni dovoljen v prireditvenem stavku!"; break;
		case "str": s = (english) ?  "Illegal bit string format!" :
									 "Neveljaven zapis niza bitov!"; break;
									  
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


function modelWarn(s, pos) {  //0104
	let str = "<span style='color: blue;'>Warning </span>";
	
	if (pos!==undefined) {
		str += "at "+pos+": ";
	}
	str += s;
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
		s1 += htmInput(i+1, "name", 10, name);
		mode = document.getElementById("mode"+(i+1)).value;
		s2 += htmInput(i+1, "mode", 1, mode);
		type = document.getElementById("type"+(i+1)).value;
		s3 += htmInput(i+1, "type", 1, type);
	});
	
	setup.nPorts += 1;
	s1 += htmInput(setup.nPorts, "name", 10, "");
	s2 += htmInput(setup.nPorts, "mode", 1, "");
	s3 += htmInput(setup.nPorts, "type", 1, type);
	document.getElementById("inName").innerHTML = s1;
	document.getElementById("inMode").innerHTML = s2;
	document.getElementById("inType").innerHTML = s3;
	changeSource();
}

function removePort() {
	if (setup.nPorts===1) {
		document.getElementById("inName").innerHTML = htmInput(1, "name", 10, "");
		document.getElementById("inMode").innerHTML = htmInput(1, "mode", 1, "");
		document.getElementById("inType").innerHTML = htmInput(1, "type", 1, "");		
    } else if (setup.nPorts>1) {	
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
	}
	changeSource();
}


function selectLine(lineNum) { // select a line in CodeMirror
	const len = editor.getLine(lineNum-1).length;
	editor.setSelection({line: lineNum-1, ch:0}, {line: lineNum-1, ch:len});
}

function newEntity()
{
	const r = confirm("New HDL description ?"); 

	if (r == true) {
		clearLog();
		const defName = document.getElementById("comp_name").value;
		let str = "entity "+defName+"\n";

		try {
			getPorts();
			
			[...Array(setup.nPorts)].forEach(function(_, i) {
				id = document.getElementById("name"+(i+1)).value; // id name or id list
				const modeStr = document.getElementById("mode"+(i+1)).value;
				var typeStr = (document.getElementById("type"+(i+1)).value);
				if (typeStr==="") typeStr="u1";
				
				if (id!=="") {str += " "+id+": "+modeStr+" "+typeStr+";\n";}
			}); 
		} catch (er) {
			setLog(er);			
		}		
		
		str += "begin\n\nend\n";
		editor.setValue(str);
	}
}