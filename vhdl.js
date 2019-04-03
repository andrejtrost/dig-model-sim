/*File: vhdl.js */
/*jshint esversion: 6 */

function makeBold(input) {
 const keywords=["library","use","all","entity","port","in","out","is","begin",
 "end", "architecture","downto","of", "signal","constant","process",
 "if", "then", "else", "elsif", "null", "case", "when", "others", 
 "map", "time", "wait", "for", "and", "or", "not", "xor"];
 return input.replace(new RegExp('(\\b)(' + keywords.join('|') + ')(\\b)','ig'), '$1<b class="w3-text-indigo">$2</b>$3');
}

function makeColor(input) {	
 const keywords=["std_logic","signed","unsigned"];
 const functions=["rising_edge", "resize", "to_signed", "to_unsigned"];
 const tmp=input.replace(new RegExp('(\\b)(' + keywords.join('|') + ')(\\b)','ig'), '$1<span class="w3-text-purple">$2</span>$3');
 
 return tmp.replace(new RegExp('(\\b)(' + functions.join('|') + ')(\\b)','ig'), '$1<span class="w3-text-blue">$2</span>$3');
}

function range(sz) {
  return "(<span class='w3-text-deep-orange'>" + (sz-1) + "</span> " + "downto <span class='w3-text-deep-orange'>0</span>)";
}

//TODO: use userint swith for vector size
function initValue(variable, value) 
{
  let str = "";
  const size = type(variable).size;
  if (type(variable).size === 1) { // single bit constant
	if (Number(value)%2 === 1) {str += "'1'";}
	else {str += "'0'";}
  } else {
	if (type(variable).size <= setup.maxBinSize) {
		const bin = Number(value).toString(2);
		const numSz = bin.length;
		if (numSz <= size) {
			str +="\""+bin.padStart(size, '0')+"\"";
		} else {		
			str += "\""+bin.slice(-size)+"\"";
		}
	} else {
		if (setup.vhdl2008) {
			str += type(variable).size+"D\""+value+"\"";
		} else {
			if (type(variable).unsigned) {
				str += "to_unsigned("+value+","+type(variable).size+")";
			} else {
				str += "to_signed("+value+","+type(variable).size+")";			
			}
		}
	}
  }
  return str;
}

// VHDL ports and signals code
function VHDLports() {
  if (model===undefined) {return;}
  var namepatt = /^\w+$/
  setLog("VHDL"); 
  
  let s = "library <b class='w3-text-brown'>IEEE</b>;\n";
  s += "use <b class='w3-text-brown'>IEEE.std_logic_1164</b>.all;\n";
  s += "use <b class='w3-text-brown'>IEEE.numeric_std</b>.all;\n\n"; 		
  
  var comp_name = document.getElementById("comp_name").value;
  const sName=comp_name.toLowerCase();
  if (!namepatt.test(comp_name)) {setLog(modelErr("cnam", comp_name));}
  if (VHDLrsv.indexOf(sName)>=0) {setLog(modelErr("cnam",comp_name));}
  // test if circuit name = signal name
  if (model.getVar(sName, true)!==null) {setLog(modelErr("cnam2",comp_name));}
	
  s += "entity" + " " + comp_name + " is\n"; 
  
  s += " port (\n";
  if (model.getSeq()) s += "   clk : in std_logic;\n";
  let prev = 1; // 1 = first port declaration
  
  model.ports.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = val.mode;
	if (mod==="in" || mod==="out") {
		if (val.type.unsigned===false) tip = "signed";
		if (val.type.size===1) {tip = "std_logic";}
			
		// add separators to finish previous declaration
		if (prev===0) { s += ";\n   "; } 
		else if (prev===1) { s += "   "; } 
		else if (prev===2) { s += ", "; }
						
		if (val.type.declared===1) { // single declaration (1) or continue list
			s += id + " " + ":" + " " + val.mode + " " + tip;
			if (val.type.size>1) {s += range(val.type.size);}
			prev = 0;					
	    } else {
			s += id;
			prev = 2;
		}
	}
  });
  s += " );\n";  

  s += "end "+ comp_name +";\n";
  s += "\narchitecture RTL of" + " " + comp_name + " " + "is" + "\n";

  model.vars.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = mode(val);
	if (mod==="") {		
		if (type(val).unsigned===false) tip = "signed";
		if (type(val).size===1) {tip = "std_logic";}
			
		if (hdl(val).mode === "const") {
			s += " constant "+ val.get().name + " " + ": " + tip;
		} else {
			s += " signal "+ val.get().name + " " + ": " + tip;
		}
		if (type(val).size>1) {
		  s += range(type(val).size);
		}
		if (hdl(val).mode === "const") {
			s += " := "+initValue(val, hdl(val).val)+";\n";
		} else if (hdl(val).assignop==="<=") {	// initial register value
			s += " := "+initValue(val, 0)+";\n";
		} else {		
			s += ";\n";
		}
	}
  });
   
  return s;
}

function VHDLcomb(proc) {	
	let s ="";
	
	// write comb single assignments in the first level block
	let b = model.getBlok();
	b.statements.forEach(function(st) {
		
		if (!st.get().translated) {
			if (st.get().id==="=" && hdl(st.get().target).assignments===1) {				
console.log("VHDLcomb: "+hdl(st.get().target).assignments);			
				st.set({translated: true});
				s += st.emitVHD(0, true);
			} 
		}
	});
	
	
	if (proc) { // need comb process
	    s1 = "";
		process.initList();
		b.statements.forEach(function(st) {
			if (!st.get().translated) {
				if (st.get().id==="=") {
					s1 += st.emitVHD(2, true);
				} else if (st.get().id==="if") {
					s1 += st.emitVHD(2, true);
				}
			}
		});
		
		if (setup.vhdl2008) { s +="\nprocess(all)\nbegin\n"; }
		else { s+= "\nprocess("+process.sensList()+")\nbegin\n"; }
		s+=s1;
		s+= "end process;\n";
	}
	
	
	return s;
}

function VHDLseq() {
	let s ="\nprocess(clk)\nbegin\n if rising_edge(clk) then\n";
	
	let b = model.getBlok();
	b.statements.forEach(function(st) {
//console.log("VHDLseq: "+(st.get().id)+st.get().translated);					
		if (!st.get().translated) {			
			s += st.emitVHD(2, false);
		}
	});
	
	s += " end if;\nend process;\n";
	return s;
}

// traverse model tree, search and mark comb blocks
function searchComb(b, level) {  // traverse code block
	let combProc = false;

	b.statements.forEach(function(st) {
//console.log("TR "+level+" st:"+st.get().id+" "+combProc);
		  if (st.get().id==="if") {
			let setIfComb = false;   // change 0611  
			let b1 = st.get().ifBlock;
			let b2 = st.get().elseBlock;
			if (b1.get().combCnt > 0) {combProc = true; setIfComb = true;}
			if (searchComb(b1, level+1)) {combProc = true; setIfComb = true;}
			if (b2!== null) {
				if (b2.get().combCnt > 0) {combProc = true; setIfComb = true;}
				if (searchComb(b2, level+1)) {combProc = true; setIfComb = true;}
			}
			st.set({combProc: setIfComb});  // mark if statement !
//console.log("POP IF "+b1.get().combCnt+combProc);
		  }
	  });
	return combProc;
}

function searchSeq(b) {
	let seqProc = false;

	b.statements.forEach(function(st) {
		  let setIfSeq = false;
		  if (st.get().id==="if") {
			let b1 = st.get().ifBlock;
			let b2 = st.get().elseBlock;
			if (b1.get().seqCnt > 0) {seqProc = true; setIfSeq = true}
			if (searchSeq(b1)) {seqProc = true; setIfSeq = true}
			if (b2!== null) {
				if (b2.get().seqCnt > 0) {seqProc = true; setIfSeq = true}
				if (searchSeq(b2)) {seqProc = true; setIfSeq = true}
			}

			st.set({seqProc: setIfSeq});  // mark if statement !
		  }
	  });
	return seqProc;
}

function VHDLout() {
	let combProc = false;
	parseCode(); // try to parse model

	if (model) {
	  //if (model.changed()) {parseCode();}	// recompile on change
		
	  // mark comb if statements
	  let b = model.getBlok();
	  combProc = searchComb(b, 0);	  
console.log("BLOK comb: "+combProc);	  
	  searchSeq(b);
			
	  model.visit(2); // visit, second pass	  
	  console.log("VHDL pass 2");
  	  model.vars.forEach(function(v) {	
			console.log(v.visit()+" val="+vec.out(v.val(), type(v).unsigned)+" mode="+mode(v)+" type="+typeToString(type(v))+
			" "+type(v).id+" hdl="+hdl(v).mode+" "+hdl(v).val);
	  });	 
	  
	} else {
		return;
	}
	
	let vver="Output VHDL";
	if (setup.vhdl2008) {vver="Output VHDL-2008";}
	document.getElementById("output").innerHTML = vver;
	
	let s = VHDLports();
	
	// deklaracije
	s += "begin\n";
	if (model) {s += VHDLcomb(combProc);}
	
	if (model.getSeq()) {s += VHDLseq();}
	
	s += "\nend RTL;";
	document.getElementById("vhdllog").innerHTML = makeColor(makeBold(s));
}

function pad(bits, dolzina) {    
    let str = '' + bits;
    while (str.length < dolzina) {
        str = '0' + str;
    }
    return str;
}

function TBout() {
  let s = "";
  
  if (model) {
	if (model.changed()) {parseCode();}	// recompile on change
  } else {
	 document.getElementById("vhdllog").innerHTML = "";
	 return;
  }
	  
  const clk_per = document.getElementById("clk_per").value;
  
  s += "library <b class='w3-text-brown'>IEEE</b>;\n";
  s += "use <b class='w3-text-brown'>IEEE.std_logic_1164</b>.all;\n";
  s += "use <b class='w3-text-brown'>IEEE.numeric_std</b>.all;\n\n"; 		
  
  var comp_name = document.getElementById("comp_name").value;
  s += "entity" + " " + comp_name + "_tb is\n"; 
  s += "end "+ comp_name +"_tb;\n";
  s += "\narchitecture sim of" + " " + comp_name + "_tb " + "is" + "\n";
  
  if (isSequential()) {
	s += " signal clk : std_logic:= '1';\n"
  }
    
  let first=true;
  
  model.ports.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = val.mode; 
	if (mod==="in" || mod==="out") {
		if (val.type.unsigned===false) tip = "signed";
		if (val.type.size===1) {tip = "std_logic";}
			
		s += " signal "; 
		s += id + " " + ": " + tip;
		if (val.type.size>1) {
		  s += range(val.type.size); 
		}
		if (mod==="in") {
			if (val.type.size===1) {s += " := '0';\n";}
			else {s += " := (others=>'0');\n";}
		} else {s += ";\n";}
	}
  });
  
  s += " constant T : time := " + clk_per + " ns;\n";
  s += "begin\n" + "\nuut: entity <b class='w3-text-brown'>work</b>."+comp_name+" port map(\n";
    
  if (isSequential()) s += "     clk => clk,\n"
  model.ports.forEach(function (val, id) {
	var tip = "unsigned";
	var mod = val.mode;
	if (mod==="in" || mod==="out") {
		if (val.type.unsigned===false) tip = "signed";
		if (val.type.size===1) {tip = "std_logic";}
		if (first) { first=false; }
		else {s += ",\n"; }
		
		s += "     "+id+" => "+id;
	}
  });   
  s += "\n);\n";

  if (isSequential()) {
    s += "<span class='w3-text-green'>-- Clock generator\n</span>";
	s += "clk_gen: process\nbegin\n clk <= '1';  wait for T/2;\n clk <= '0';  wait for T/2;\nend process;\n";
  }

  s += "\nstim_proc: process\nbegin\n";  
  if (isSequential()) { s += " wait for T/20;\n"; }
	  
  const cycles = getCycles();
  const vrstice = ports.length;
  let repeat = 0;
  let change = false;
  let wait = false;
  
  for (let c = 0; c < cycles; c++) {   
    change = false;
	wait = false;

	for (let v = 0; v < vrstice; v++) {
		// koda le ob spremembi vrednosti pri in ali inOut signalih 
		if (c==0 ||
		   ((ports[v].mode == "in" || ports[v].mode == "inOut") && signals[v][c] != signals[v][c-1])) {
//console.log("Cy: "+c+" change "+repeat);				
		  if (c>0 && wait===false) {
			  if (repeat===0) {s += "\n wait for T;\n";}
			  else {s += "\n wait for "+(repeat+1)+"*T;\n";}
			  repeat = 0;
			  wait = true;
		  }
          if (ports[v].mode == "in" || ports[v].mode == "inOut") {					  
			if (c>0) {change = true;}
            if(ports[v] instanceof Bit) s += " " + ports[v].name + " <= " + "'" + signals[v][c].valueOf()+ "'" +";";
            else {
				bits = Number(signals[v][c])
				if (bits<0) bits = bits & ( Math.pow(2, ports[v].size) - 1); 
				bits = bits.toString(2);
            
				s += " " + ports[v].name + " <= " + "&quot" + pad(bits, ports[v].size) + "&quot" +"&#59;";
            }
          }
		}
	}
	if (c>0 && change===false) {repeat += 1;}
	
  }
  s += "\n wait;\nend process;\nend sim;";  
  
  document.getElementById("vhdllog").innerHTML = makeColor(makeBold(s));
}